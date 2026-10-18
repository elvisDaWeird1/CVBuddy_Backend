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
const {
  AI_USAGE_STATES
} = require("../src/modules/usage/aiUsage.model");
const {
  consumeAiUsage,
  getMyUsage,
  refundAiUsage,
  reserveAiUsage
} = require("../src/modules/usage/usage.service");

let replSet;

before(async () => {
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  await mongoose.connect(replSet.getUri(), { dbName: "cvbuddy_usage_test" });
  await Promise.all([
    EntitlementGrant.syncIndexes(),
    AiUsage.syncIndexes()
  ]);
});

beforeEach(async () => {
  await Promise.all([
    EntitlementGrant.deleteMany({}),
    AiUsage.deleteMany({})
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

test("successful usage is consumed with result and cost metadata", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const idempotencyKey = "usage-consume-001";
  const aiResultId = new mongoose.Types.ObjectId();
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.TARGETED_REVIEW,
    idempotencyKey,
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

test("usage summary exposes server-owned feature costs and remaining balance", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  await reserveAiUsage({
    accountId,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    idempotencyKey: "usage-summary-001",
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
