const assert = require("assert").strict;
const test = require("node:test");
const { Types } = require("mongoose");

const {
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  PLAN_CODES
} = require("../src/config/planCatalog");
const EntitlementGrant = require(
  "../src/modules/entitlements/entitlementGrant.model"
).default;
const {
  ENTITLEMENT_STATUSES
} = require("../src/modules/entitlements/entitlementGrant.model");
const {
  expireEndedGrants,
  getEffectiveEntitlement,
  getFreeEntitlement,
  grantPro30Days
} = require("../src/modules/entitlements/entitlement.service");

const sortableResult = (value) => ({ sort: async () => value });

test("plan catalog is versioned and keeps price and credits server-owned", () => {
  assert.equal(PLAN_CATALOG_VERSION, "2026-10-22");
  assert.equal(PLAN_CATALOG[PLAN_CODES.FREE].priceVnd, 0);
  assert.equal(PLAN_CATALOG[PLAN_CODES.FREE].creditsGranted, 4);
  assert.equal(PLAN_CATALOG[PLAN_CODES.PRO_30D].priceVnd, 49000);
  assert.equal(PLAN_CATALOG[PLAN_CODES.PRO_30D].creditsGranted, 60);
  assert.equal(PLAN_CATALOG[PLAN_CODES.PRO_30D].durationDays, 30);
});

test("FREE policy uses a UTC calendar month before its grant is persisted", () => {
  const entitlement = getFreeEntitlement(new Date("2026-10-18T12:34:56.000Z"));

  assert.equal(entitlement.planCode, PLAN_CODES.FREE);
  assert.equal(entitlement.grantId, null);
  assert.equal(entitlement.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(entitlement.endsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(entitlement.creditsRemaining, 4);
  assert.equal(entitlement.source, "MONTHLY_FREE_POLICY");
});

test("effective entitlement prefers the active paid grant and falls back after expiry", async () => {
  const originalFindOne = EntitlementGrant.findOne;
  const originalCreate = EntitlementGrant.create;
  const accountId = new Types.ObjectId();
  const activeGrant = {
    _id: new Types.ObjectId(),
    planCode: PLAN_CODES.PRO_30D,
    startsAt: new Date("2026-10-01T00:00:00.000Z"),
    endsAt: new Date("2026-10-31T00:00:00.000Z"),
    creditsGranted: 60,
    creditsConsumed: 8
  };

  try {
    EntitlementGrant.findOne = () => sortableResult(activeGrant);
    const paid = await getEffectiveEntitlement(
      accountId,
      new Date("2026-10-18T00:00:00.000Z")
    );
    assert.equal(paid.planCode, PLAN_CODES.PRO_30D);
    assert.equal(paid.creditsRemaining, 52);
    assert.equal(paid.source, "ENTITLEMENT_GRANT");

    let freeFindCount = 0;
    EntitlementGrant.findOne = () => {
      freeFindCount += 1;
      return freeFindCount === 1 ? sortableResult(null) : Promise.resolve(null);
    };
    EntitlementGrant.create = async (payload) => [{
      _id: new Types.ObjectId(),
      ...payload[0]
    }];
    const free = await getEffectiveEntitlement(
      accountId,
      new Date("2026-11-02T00:00:00.000Z")
    );
    assert.equal(free.planCode, PLAN_CODES.FREE);
  } finally {
    EntitlementGrant.findOne = originalFindOne;
    EntitlementGrant.create = originalCreate;
  }
});

test("PRO grant creation is idempotent for one source order", async () => {
  const originalFindOne = EntitlementGrant.findOne;
  const originalCreate = EntitlementGrant.create;
  const existing = {
    _id: new Types.ObjectId(),
    sourceOrderId: "order-123",
    planCode: PLAN_CODES.PRO_30D
  };

  try {
    EntitlementGrant.findOne = async (query) => {
      assert.equal(query.sourceOrderId, "order-123");
      return existing;
    };
    EntitlementGrant.create = async () => {
      throw new Error("create must not run for an existing source order");
    };

    const result = await grantPro30Days({
      accountId: new Types.ObjectId(),
      sourceOrderId: " order-123 "
    });
    assert.equal(result.created, false);
    assert.equal(result.grant, existing);
  } finally {
    EntitlementGrant.findOne = originalFindOne;
    EntitlementGrant.create = originalCreate;
  }
});

test("early renewal queues a consecutive 30-day grant after the latest paid grant", async () => {
  const originalFindOne = EntitlementGrant.findOne;
  const originalCreate = EntitlementGrant.create;
  const accountId = new Types.ObjectId();
  const currentEnd = new Date("2026-11-10T00:00:00.000Z");
  let findCount = 0;
  let createdPayload;

  try {
    EntitlementGrant.findOne = (query) => {
      findCount += 1;
      if (findCount === 1) {
        assert.equal(query.sourceOrderId, "order-renewal");
        return Promise.resolve(null);
      }
      assert.equal(query.accountId, accountId);
      return sortableResult({ endsAt: currentEnd });
    };
    EntitlementGrant.create = async (payload) => {
      createdPayload = payload[0];
      return [{ _id: new Types.ObjectId(), ...payload[0] }];
    };

    const result = await grantPro30Days({
      accountId,
      sourceOrderId: "order-renewal",
      now: new Date("2026-10-18T00:00:00.000Z")
    });

    assert.equal(result.created, true);
    assert.equal(createdPayload.startsAt.toISOString(), currentEnd.toISOString());
    assert.equal(
      createdPayload.endsAt.toISOString(),
      "2026-12-10T00:00:00.000Z"
    );
    assert.equal(createdPayload.creditsGranted, 60);
    assert.equal(createdPayload.creditsConsumed, 0);
    assert.equal(createdPayload.status, ENTITLEMENT_STATUSES.ACTIVE);
  } finally {
    EntitlementGrant.findOne = originalFindOne;
    EntitlementGrant.create = originalCreate;
  }
});

test("expired grants are reconciled explicitly instead of mutating during reads", async () => {
  const originalUpdateMany = EntitlementGrant.updateMany;
  const now = new Date("2026-10-18T00:00:00.000Z");

  try {
    EntitlementGrant.updateMany = async (filter, update) => {
      assert.equal(filter.status, ENTITLEMENT_STATUSES.ACTIVE);
      assert.equal(filter.endsAt.$lte, now);
      assert.equal(update.$set.status, ENTITLEMENT_STATUSES.EXPIRED);
      return { acknowledged: true, modifiedCount: 2 };
    };

    const result = await expireEndedGrants(now);
    assert.equal(result.modifiedCount, 2);
  } finally {
    EntitlementGrant.updateMany = originalUpdateMany;
  }
});

test("entitlement schema declares unique source-order and account lookup indexes", () => {
  const indexes = EntitlementGrant.schema.indexes();
  const sourceOrderIndex = indexes.find(([fields]) => fields.sourceOrderId === 1);
  const accountLookup = indexes.find(([fields]) =>
    fields.accountId === 1 && fields.endsAt === -1 && fields.status === 1
  );

  assert.equal(sourceOrderIndex?.[1].unique, true);
  assert.ok(accountLookup);
});
