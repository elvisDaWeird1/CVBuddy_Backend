import { createHash } from "crypto";
import mongoose, { Types } from "mongoose";

import {
  AI_CREDIT_COSTS,
  AI_FEATURE_KEYS,
  type AiFeatureKey
} from "../../config/planCatalog";
import ApiError from "../../utils/apiError";
import {
  getEffectiveEntitlement
} from "../entitlements/entitlement.service";
import EntitlementGrant, {
  ENTITLEMENT_STATUSES
} from "../entitlements/entitlementGrant.model";
import AiUsage, { AI_USAGE_STATES } from "./aiUsage.model";
import AIResult from "../ai/aiResult.model";
import { AI_STATUSES } from "../../constants/enums";
import { writeOperationalLog } from "../../utils/operationalLogger";

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const DEFAULT_RESERVATION_TTL_MS = 10 * 60 * 1000;

type UsageMetadata = {
  provider?: string;
  providerModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  estimatedCostCurrency?: string;
};

const normalizeIdempotencyKey = (value: string) => {
  const normalized = value.trim();
  if (!IDEMPOTENCY_KEY_PATTERN.test(normalized)) {
    throw new ApiError(
      400,
      "A valid idempotency key is required",
      [{ field: "idempotencyKey", message: "Use 8-128 safe characters" }],
      "INVALID_IDEMPOTENCY_KEY"
    );
  }
  return normalized;
};

const getCreditCost = (featureKey: AiFeatureKey) => {
  const cost = AI_CREDIT_COSTS[featureKey];
  if (!cost) {
    throw new ApiError(400, "Unsupported AI feature", [], "UNSUPPORTED_AI_FEATURE");
  }
  return cost;
};

const stableSerialize = (value: unknown): string => {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) =>
    `${JSON.stringify(key)}:${stableSerialize(record[key])}`
  ).join(",")}}`;
};

const createRequestFingerprint = (value: unknown) => createHash("sha256")
  .update(stableSerialize(value))
  .digest("hex");

const getReservationTtlMs = () => {
  const value = Number.parseInt(process.env.AI_USAGE_RESERVATION_TTL_MS || "", 10);
  return Number.isInteger(value) && value >= 60_000 ? value : DEFAULT_RESERVATION_TTL_MS;
};

const assertIdempotentMatch = (
  usage,
  featureKey: AiFeatureKey,
  credits: number,
  requestFingerprint: string
) => {
  if (usage.requestFingerprint !== requestFingerprint) {
    throw new ApiError(
      409,
      "Idempotency key was already used for different request data",
      [],
      "IDEMPOTENCY_PAYLOAD_MISMATCH"
    );
  }
  if (usage.featureKey !== featureKey || usage.credits !== credits) {
    throw new ApiError(
      409,
      "Idempotency key was already used for a different AI action",
      [],
      "IDEMPOTENCY_CONFLICT"
    );
  }
};

const reserveAiUsage = async ({
  accountId,
  featureKey,
  idempotencyKey,
  requestFingerprint,
  now = new Date()
}: {
  accountId: Types.ObjectId | string;
  featureKey: AiFeatureKey;
  idempotencyKey: string;
  requestFingerprint: string;
  now?: Date;
}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const credits = getCreditCost(featureKey);
  if (!/^[a-f0-9]{64}$/.test(requestFingerprint)) {
    throw new ApiError(400, "Invalid AI request fingerprint", [], "INVALID_IDEMPOTENCY_FINGERPRINT");
  }
  const existing = await AiUsage.findOne({ accountId, idempotencyKey: normalizedKey });
  if (existing) {
    assertIdempotentMatch(existing, featureKey, credits, requestFingerprint);
    return { usage: existing, created: false };
  }

  const session = await mongoose.startSession();
  let outcome;
  try {
    await session.withTransaction(async () => {
      const transactionExisting = await AiUsage.findOne({
        accountId,
        idempotencyKey: normalizedKey
      }).session(session);
      if (transactionExisting) {
        assertIdempotentMatch(transactionExisting, featureKey, credits, requestFingerprint);
        outcome = { usage: transactionExisting, created: false };
        return;
      }

      const entitlement = await getEffectiveEntitlement(accountId, now, session);
      const grant = await EntitlementGrant.findOneAndUpdate(
        {
          _id: entitlement.grantId,
          accountId,
          status: ENTITLEMENT_STATUSES.ACTIVE,
          startsAt: { $lte: now },
          endsAt: { $gt: now },
          $expr: {
            $lte: [
              { $add: ["$creditsConsumed", credits] },
              "$creditsGranted"
            ]
          }
        },
        { $inc: { creditsConsumed: credits } },
        { new: true, session }
      );

      if (!grant) {
        throw new ApiError(
          429,
          "AI credit allowance has been exhausted",
          [{ field: "featureKey", message: featureKey }],
          "USAGE_LIMIT_REACHED"
        );
      }

      const [usage] = await AiUsage.create([{
        accountId,
        entitlementGrantId: grant._id,
        featureKey,
        credits,
        state: AI_USAGE_STATES.RESERVED,
        idempotencyKey: normalizedKey,
        requestFingerprint,
        reservationExpiresAt: new Date(now.getTime() + getReservationTtlMs())
      }], { session });
      outcome = { usage, created: true };
    });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrentUsage = await AiUsage.findOne({
        accountId,
        idempotencyKey: normalizedKey
      });
      if (concurrentUsage) {
        assertIdempotentMatch(concurrentUsage, featureKey, credits, requestFingerprint);
        return { usage: concurrentUsage, created: false };
      }
    }
    throw error;
  } finally {
    await session.endSession();
  }

  if (!outcome) throw new Error("AI usage reservation transaction produced no result");
  return outcome;
};

const consumeAiUsage = async ({
  accountId,
  idempotencyKey,
  aiResultId,
  metadata = {}
}: {
  accountId: Types.ObjectId | string;
  idempotencyKey: string;
  aiResultId: Types.ObjectId | string;
  metadata?: UsageMetadata;
}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const usage = await AiUsage.findOneAndUpdate(
    {
      accountId,
      idempotencyKey: normalizedKey,
      state: AI_USAGE_STATES.RESERVED
    },
    {
      $set: {
        aiResultId,
        state: AI_USAGE_STATES.CONSUMED,
        ...metadata
      }
    },
    { new: true, runValidators: true }
  );

  if (usage) return usage;
  const existing = await AiUsage.findOne({ accountId, idempotencyKey: normalizedKey });
  if (existing?.state === AI_USAGE_STATES.CONSUMED) return existing;
  throw new ApiError(409, "AI usage reservation is not consumable", [], "USAGE_STATE_CONFLICT");
};

const attachAiResultToReservation = async ({
  accountId,
  idempotencyKey,
  aiResultId
}: {
  accountId: Types.ObjectId | string;
  idempotencyKey: string;
  aiResultId: Types.ObjectId | string;
}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const usage = await AiUsage.findOneAndUpdate(
    {
      accountId,
      idempotencyKey: normalizedKey,
      state: AI_USAGE_STATES.RESERVED,
      $or: [
        { aiResultId: { $exists: false } },
        { aiResultId: null },
        { aiResultId }
      ]
    },
    { $set: { aiResultId } },
    { new: true }
  );

  if (usage) return usage;
  throw new ApiError(409, "AI usage reservation is already linked", [], "USAGE_STATE_CONFLICT");
};

const refundAiUsage = async ({
  accountId,
  idempotencyKey,
  aiResultId
}: {
  accountId: Types.ObjectId | string;
  idempotencyKey: string;
  aiResultId?: Types.ObjectId | string;
}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const session = await mongoose.startSession();
  let refundedUsage;

  try {
    await session.withTransaction(async () => {
      const usage = await AiUsage.findOne({
        accountId,
        idempotencyKey: normalizedKey
      }).session(session);

      if (!usage) {
        throw new ApiError(404, "AI usage reservation not found", [], "USAGE_NOT_FOUND");
      }
      if (usage.state === AI_USAGE_STATES.REFUNDED) {
        refundedUsage = usage;
        return;
      }
      if (usage.state !== AI_USAGE_STATES.RESERVED) {
        throw new ApiError(409, "Consumed AI usage cannot be refunded automatically", [], "USAGE_STATE_CONFLICT");
      }

      const grant = await EntitlementGrant.findOneAndUpdate(
        {
          _id: usage.entitlementGrantId,
          accountId,
          creditsConsumed: { $gte: usage.credits }
        },
        { $inc: { creditsConsumed: -usage.credits } },
        { new: true, session }
      );
      if (!grant) {
        throw new ApiError(409, "Entitlement balance could not be refunded", [], "USAGE_REFUND_CONFLICT");
      }

      usage.state = AI_USAGE_STATES.REFUNDED;
      if (aiResultId) usage.aiResultId = new Types.ObjectId(aiResultId);
      await usage.save({ session });
      refundedUsage = usage;
    });
  } finally {
    await session.endSession();
  }

  if (!refundedUsage) throw new Error("AI usage refund transaction produced no result");
  return refundedUsage;
};

const refundReservedUsageInTransaction = async (usage, now: Date, reason: string, session) => {
  const grant = await EntitlementGrant.findOneAndUpdate(
    {
      _id: usage.entitlementGrantId,
      accountId: usage.accountId,
      creditsConsumed: { $gte: usage.credits }
    },
    { $inc: { creditsConsumed: -usage.credits } },
    { new: true, session }
  );
  if (!grant) {
    throw new ApiError(409, "Entitlement balance could not be reconciled", [], "USAGE_RECONCILIATION_CONFLICT");
  }

  usage.state = AI_USAGE_STATES.REFUNDED;
  usage.reconciledAt = now;
  usage.reconciliationReason = reason;
  usage.reconciliationOutcome = "REFUNDED";
  await usage.save({ session });
  return usage;
};

const reconcileStaleAiUsageRecord = async (usageId, now = new Date()) => {
  const session = await mongoose.startSession();
  const reconciliation = { outcome: "SKIPPED" as "CONSUMED" | "REFUNDED" | "SKIPPED" };
  const legacyReservationCutoff = new Date(now.getTime() - getReservationTtlMs());

  try {
    await session.withTransaction(async () => {
      const usage = await AiUsage.findOne({
        _id: usageId,
        state: AI_USAGE_STATES.RESERVED,
        $or: [
          { reservationExpiresAt: { $lte: now } },
          { reservationExpiresAt: { $exists: false }, createdAt: { $lte: legacyReservationCutoff } }
        ]
      }).session(session);
      if (!usage) return;

      const result = usage.aiResultId
        ? await AIResult.findOne({ _id: usage.aiResultId, accountId: usage.accountId }).session(session)
        : null;

      if (result?.status === AI_STATUSES.COMPLETED) {
        usage.state = AI_USAGE_STATES.CONSUMED;
        usage.reconciledAt = now;
        usage.reconciliationReason = "STALE_RESERVATION_COMPLETED_RESULT";
        usage.reconciliationOutcome = "CONSUMED";
        await usage.save({ session });
        reconciliation.outcome = "CONSUMED";
        return;
      }

      if (result?.status === AI_STATUSES.PENDING) {
        result.status = AI_STATUSES.FAILED;
        result.errorCode = "AI_RESERVATION_STALE";
        result.errorMessage = "AI processing did not complete before its reservation expired";
        result.completedAt = now;
        await result.save({ session });
        await refundReservedUsageInTransaction(usage, now, "STALE_PENDING_RESULT", session);
        reconciliation.outcome = "REFUNDED";
        return;
      }

      await refundReservedUsageInTransaction(
        usage,
        now,
        result?.status === AI_STATUSES.FAILED ? "FAILED_RESULT" : "MISSING_OR_INVALID_RESULT",
        session
      );
      reconciliation.outcome = "REFUNDED";
    });
  } finally {
    await session.endSession();
  }

  return reconciliation.outcome;
};

const reconcileStaleAiUsage = async ({
  now = new Date(),
  limit = 100
}: {
  now?: Date;
  limit?: number;
} = {}) => {
  const legacyReservationCutoff = new Date(now.getTime() - getReservationTtlMs());
  const candidates = await AiUsage.find({
    state: AI_USAGE_STATES.RESERVED,
    $or: [
      { reservationExpiresAt: { $lte: now } },
      { reservationExpiresAt: { $exists: false }, createdAt: { $lte: legacyReservationCutoff } }
    ]
  }).sort({ reservationExpiresAt: 1 }).limit(Math.min(Math.max(limit, 1), 500)).select("_id").lean();

  const summary = { scanned: candidates.length, consumed: 0, refunded: 0, skipped: 0, failed: 0 };
  for (const candidate of candidates) {
    try {
      const outcome = await reconcileStaleAiUsageRecord(candidate._id, now);
      if (outcome === "CONSUMED") summary.consumed += 1;
      else if (outcome === "REFUNDED") summary.refunded += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      writeOperationalLog("error", "ai_usage_reconciliation_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
    }
  }

  if (summary.scanned > 0) {
    writeOperationalLog("info", "ai_usage_reconciliation_completed", summary);
  }
  return summary;
};

const getReconciliationIntervalMs = () => {
  const value = Number.parseInt(process.env.AI_USAGE_RECONCILE_INTERVAL_MS || "", 10);
  return Number.isInteger(value) && value >= 60_000 ? value : 60_000;
};

const startAiUsageReconciliation = () => {
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      await reconcileStaleAiUsage();
    } catch (error) {
      writeOperationalLog("error", "ai_usage_reconciliation_run_failed", {
        errorName: error instanceof Error ? error.name : "UnknownError"
      });
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => { void run(); }, getReconciliationIntervalMs());
  timer.unref?.();
  return () => clearInterval(timer);
};

const getMyUsage = async (accountId, now = new Date()) => {
  const entitlement = await getEffectiveEntitlement(accountId, now);
  return {
    ...entitlement,
    featureCosts: AI_CREDIT_COSTS
  };
};

export {
  AI_FEATURE_KEYS,
  attachAiResultToReservation,
  consumeAiUsage,
  createRequestFingerprint,
  getCreditCost,
  getMyUsage,
  getReconciliationIntervalMs,
  getReservationTtlMs,
  normalizeIdempotencyKey,
  reconcileStaleAiUsage,
  reconcileStaleAiUsageRecord,
  refundAiUsage,
  reserveAiUsage,
  startAiUsageReconciliation
};
