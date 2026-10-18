const assert = require("assert").strict;
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const {
  AI_FEATURE_KEYS
} = require("../src/config/planCatalog");
const EntitlementGrant = require(
  "../src/modules/entitlements/entitlementGrant.model"
).default;
const {
  ensureFreeEntitlement
} = require("../src/modules/entitlements/entitlement.service");
const AiUsage = require("../src/modules/usage/aiUsage.model").default;
const AIResult = require("../src/modules/ai/aiResult.model").default;
const {
  AI_USAGE_STATES
} = require("../src/modules/usage/aiUsage.model");
const {
  consumeAiUsage,
  createRequestFingerprint,
  getMyUsage,
  reconcileStaleAiUsage,
  refundAiUsage,
  reserveAiUsage
} = require("../src/modules/usage/usage.service");

const requestFingerprint = (value) => createRequestFingerprint({ version: "test", value });

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  await mongoose.connect(replSet.getUri(), { dbName: "cvbuddy_usage_test" });
  await Promise.all([
    EntitlementGrant.syncIndexes(),
    AiUsage.syncIndexes(),
    AIResult.syncIndexes()
  ]);
});

beforeEach(async () => {
  await Promise.all([
    EntitlementGrant.deleteMany({}),
    AiUsage.deleteMany({}),
    AIResult.deleteMany({})
  ]);
});

after(async () => {
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

test("duplicate idempotency keys reuse one reservation and charge once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const request = {
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey: "usage-duplicate-001",
    requestFingerprint: requestFingerprint("usage-duplicate-001"),
    now: new Date("2026-10-18T00:00:00.000Z")
  };

  const first = await reserveAiUsage(request);
  const second = await reserveAiUsage(request);
  const grant = await EntitlementGrant.findById(first.usage.entitlementGrantId);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.usage.id, first.usage.id);
  assert.equal(await AiUsage.countDocuments({ accountId }), 1);
  assert.equal(grant.creditsConsumed, 2);
});

test("same idempotency key rejects a different request fingerprint", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-fingerprint-001";
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey,
    requestFingerprint: requestFingerprint("cv-a")
  });

  await assert.rejects(
    () => reserveAiUsage({
      accountId,
      featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
      idempotencyKey,
      requestFingerprint: requestFingerprint("cv-b")
    }),
    (error) => error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH"
  );
});

test("concurrent same-key reservations create one usage record and one charge", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const request = {
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey: "usage-concurrent-same-key-001",
    requestFingerprint: requestFingerprint("same-operation")
  };
  const [first, second] = await Promise.all([
    reserveAiUsage(request),
    reserveAiUsage(request)
  ]);
  const grant = await EntitlementGrant.findOne({ accountId });

  assert.equal(first.usage._id.toString(), second.usage._id.toString());
  assert.equal(await AiUsage.countDocuments({ accountId }), 1);
  assert.equal(grant.creditsConsumed, 2);
});

test("same key with a different AI feature is a payload mismatch", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-feature-mismatch-001";
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey,
    requestFingerprint: requestFingerprint("score-cv-a")
  });
  await assert.rejects(
    () => reserveAiUsage({
      accountId,
      featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
      idempotencyKey,
      requestFingerprint: requestFingerprint("translate-cv-a")
    }),
    (error) => error.code === "IDEMPOTENCY_PAYLOAD_MISMATCH"
  );
});

test("parallel reservations cannot overspend the FREE monthly allowance", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  await ensureFreeEntitlement(accountId, now);

  const results = await Promise.allSettled([
    "usage-parallel-001",
    "usage-parallel-002",
    "usage-parallel-003"
  ].map((idempotencyKey) => reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey,
    requestFingerprint: requestFingerprint(idempotencyKey),
    now
  })));

  const fulfilled = results.filter((result) => result.status === "fulfilled");
  const rejected = results.filter((result) => result.status === "rejected");
  const grant = await EntitlementGrant.findOne({ accountId });

  assert.equal(fulfilled.length, 2);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason.code, "USAGE_LIMIT_REACHED");
  assert.equal(grant.creditsConsumed, 4);
  assert.equal(await AiUsage.countDocuments({ accountId }), 2);
});

test("provider failure refund restores credits exactly once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-refund-001";
  const reservation = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    idempotencyKey,
    requestFingerprint: requestFingerprint(idempotencyKey),
    now: new Date("2026-10-18T00:00:00.000Z")
  });
  const aiResultId = new mongoose.Types.ObjectId();

  const first = await refundAiUsage({ accountId, idempotencyKey, aiResultId });
  const second = await refundAiUsage({ accountId, idempotencyKey, aiResultId });
  const grant = await EntitlementGrant.findById(reservation.usage.entitlementGrantId);

  assert.equal(first.state, AI_USAGE_STATES.REFUNDED);
  assert.equal(second.state, AI_USAGE_STATES.REFUNDED);
  assert.equal(first.aiResultId.toString(), aiResultId.toString());
  assert.equal(grant.creditsConsumed, 0);
});

test("a new key can reserve usage after a prior reservation was refunded", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    idempotencyKey: "usage-retry-old-001",
    requestFingerprint: requestFingerprint("old"),
    now
  });
  await refundAiUsage({ accountId, idempotencyKey: "usage-retry-old-001" });

  const retry = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    idempotencyKey: "usage-retry-new-001",
    requestFingerprint: requestFingerprint("new"),
    now
  });
  assert.equal(retry.created, true);
});

test("successful usage is consumed with result and cost metadata", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-consume-001";
  const aiResultId = new mongoose.Types.ObjectId();
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.TARGETED_REVIEW,
    idempotencyKey,
    requestFingerprint: requestFingerprint(idempotencyKey),
    now: new Date("2026-10-18T00:00:00.000Z")
  });

  const usage = await consumeAiUsage({
    accountId,
    idempotencyKey,
    aiResultId,
    metadata: {
      provider: "groq",
      providerModel: "test-model",
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      estimatedCost: 0.01,
      estimatedCostCurrency: "USD"
    }
  });

  assert.equal(usage.state, AI_USAGE_STATES.CONSUMED);
  assert.equal(usage.aiResultId.toString(), aiResultId.toString());
  assert.equal(usage.provider, "groq");
  assert.equal(usage.providerModel, "test-model");
  assert.equal(usage.totalTokens, 150);
  assert.equal(usage.estimatedCostCurrency, "USD");
});

test("consume and refund racing on one reservation cannot debit twice or go negative", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-consume-refund-race-001";
  const reservation = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey,
    requestFingerprint: requestFingerprint("consume-refund-race")
  });
  const resultId = new mongoose.Types.ObjectId();
  const settled = await Promise.allSettled([
    consumeAiUsage({ accountId, idempotencyKey, aiResultId: resultId }),
    refundAiUsage({ accountId, idempotencyKey, aiResultId: resultId })
  ]);
  const usage = await AiUsage.findById(reservation.usage._id);
  const grant = await EntitlementGrant.findById(reservation.usage.entitlementGrantId);

  assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1);
  assert.ok(["CONSUMED", "REFUNDED"].includes(usage.state));
  assert.ok(grant.creditsConsumed === 2 || grant.creditsConsumed === 0);
});

test("usage summary exposes server-owned feature costs and remaining balance", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    idempotencyKey: "usage-summary-001",
    requestFingerprint: requestFingerprint("usage-summary-001"),
    now
  });

  const summary = await getMyUsage(accountId, now);
  assert.equal(summary.planCode, "FREE");
  assert.equal(summary.creditsGranted, 4);
  assert.equal(summary.creditsConsumed, 2);
  assert.equal(summary.creditsRemaining, 2);
  assert.equal(summary.featureCosts.CV_TRANSLATION, 2);
});

test("usage schema declares idempotency and account-state indexes", () => {
  const indexes = AiUsage.schema.indexes();
  const idempotencyIndex = indexes.find(([fields]) =>
    fields.accountId === 1 && fields.idempotencyKey === 1
  );
  const accountStateIndex = indexes.find(([fields]) =>
    fields.accountId === 1 && fields.createdAt === -1 && fields.state === 1
  );

  assert.equal(idempotencyIndex?.[1].unique, true);
  assert.ok(accountStateIndex);
});

const createLinkedResult = async (accountId, status) => AIResult.create({
  accountId,
  aiType: "CV_SCORING",
  status,
  inputText: "synthetic",
  ...(status !== "PENDING" ? { completedAt: new Date() } : {})
});

test("stale reservation with a completed result is consumed exactly once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const reservation = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey: "usage-stale-completed-001",
    requestFingerprint: requestFingerprint("stale-completed"),
    now
  });
  const result = await createLinkedResult(accountId, "COMPLETED");
  await AiUsage.updateOne({ _id: reservation.usage._id }, { $set: { aiResultId: result._id } });

  const first = await reconcileStaleAiUsage({ now: new Date(now.getTime() + 11 * 60 * 1000) });
  const second = await reconcileStaleAiUsage({ now: new Date(now.getTime() + 12 * 60 * 1000) });
  const usage = await AiUsage.findById(reservation.usage._id);

  assert.equal(first.consumed, 1);
  assert.equal(second.scanned, 0);
  assert.equal(usage.state, "CONSUMED");
  assert.equal(usage.reconciliationOutcome, "CONSUMED");
});

test("stale failed or pending results refund exactly once and pending becomes failed", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const failedReservation = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey: "usage-stale-failed-001",
    requestFingerprint: requestFingerprint("stale-failed"),
    now
  });
  const pendingReservation = await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    idempotencyKey: "usage-stale-pending-001",
    requestFingerprint: requestFingerprint("stale-pending"),
    now
  });
  const failedResult = await createLinkedResult(accountId, "FAILED");
  const pendingResult = await createLinkedResult(accountId, "PENDING");
  await Promise.all([
    AiUsage.updateOne({ _id: failedReservation.usage._id }, { $set: { aiResultId: failedResult._id } }),
    AiUsage.updateOne({ _id: pendingReservation.usage._id }, { $set: { aiResultId: pendingResult._id } })
  ]);

  await Promise.all([
    reconcileStaleAiUsage({ now: new Date(now.getTime() + 11 * 60 * 1000) }),
    reconcileStaleAiUsage({ now: new Date(now.getTime() + 11 * 60 * 1000) })
  ]);
  const [failedUsage, pendingUsage, pendingAfter] = await Promise.all([
    AiUsage.findById(failedReservation.usage._id),
    AiUsage.findById(pendingReservation.usage._id),
    AIResult.findById(pendingResult._id)
  ]);
  const grant = await EntitlementGrant.findOne({ accountId });

  assert.equal(failedUsage.state, "REFUNDED");
  assert.equal(pendingUsage.state, "REFUNDED");
  assert.equal(pendingAfter.status, "FAILED");
  assert.equal(pendingAfter.errorCode, "AI_RESERVATION_STALE");
  assert.equal(grant.creditsConsumed, 0);
});
