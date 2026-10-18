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

const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

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

const assertIdempotentMatch = (usage, featureKey: AiFeatureKey, credits: number) => {
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
  now = new Date()
}: {
  accountId: Types.ObjectId | string;
  featureKey: AiFeatureKey;
  idempotencyKey: string;
  now?: Date;
}) => {
  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const credits = getCreditCost(featureKey);
  const existing = await AiUsage.findOne({ accountId, idempotencyKey: normalizedKey });
  if (existing) {
    assertIdempotentMatch(existing, featureKey, credits);
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
        assertIdempotentMatch(transactionExisting, featureKey, credits);
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
        idempotencyKey: normalizedKey
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
        assertIdempotentMatch(concurrentUsage, featureKey, credits);
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
  getCreditCost,
  getMyUsage,
  normalizeIdempotencyKey,
  refundAiUsage,
  reserveAiUsage
};
