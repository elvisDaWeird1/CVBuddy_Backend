const assert = require("assert").strict;
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const BillingOrder = require("../src/modules/billing/billingOrder.model").default;
const EntitlementGrant = require("../src/modules/entitlements/entitlementGrant.model").default;
const {
  createCheckout,
  expirePendingBillingOrders,
  processPayOSWebhook
} = require("../src/modules/billing/billing.service");

let replSet;

const client = {
  paymentRequests: {
    create: async (payload) => ({
      paymentLinkId: `link-${payload.orderCode}`,
      checkoutUrl: `https://checkout.example.test/${payload.orderCode}`,
      orderCode: payload.orderCode,
      amount: payload.amount,
      currency: "VND",
      status: "PENDING"
    })
  },
  webhooks: { verify: async (payload) => payload }
};

before(async () => {
  process.env.BILLING_ENABLED = "true";
  process.env.BILLING_RETURN_URL = "https://app.example.test/billing/return";
  process.env.BILLING_CANCEL_URL = "https://app.example.test/billing/cancel";
  replSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  });
  await mongoose.connect(replSet.getUri(), { dbName: "cvbuddy_billing_test" });
  await Promise.all([BillingOrder.syncIndexes(), EntitlementGrant.syncIndexes()]);
});

beforeEach(async () => {
  await Promise.all([BillingOrder.deleteMany({}), EntitlementGrant.deleteMany({})]);
});

after(async () => {
  delete process.env.BILLING_ENABLED;
  delete process.env.BILLING_RETURN_URL;
  delete process.env.BILLING_CANCEL_URL;
  await mongoose.disconnect();
  if (replSet) await replSet.stop();
});

test("checkout keeps price server-owned and reuses its idempotency key", async () => {
  const accountId = new mongoose.Types.ObjectId();
  let providerCalls = 0;
  const spyClient = {
    ...client,
    paymentRequests: {
      create: async (payload) => {
        providerCalls += 1;
        assert.equal(payload.amount, 79000);
        assert.equal(payload.items[0].price, 79000);
        assert.match(payload.returnUrl, /orderId=/);
        return client.paymentRequests.create(payload);
      }
    }
  };
  const request = {
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-checkout-001",
    client: spyClient,
    now: new Date("2026-10-18T00:00:00.000Z")
  };

  const first = await createCheckout(request);
  const second = await createCheckout(request);

  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(first.order.amountVnd, 79000);
  assert.equal(first.order.id, second.order.id);
  assert.equal(providerCalls, 1);
});

test("concurrent checkout requests reuse one order and one provider checkout", async () => {
  const accountId = new mongoose.Types.ObjectId();
  let providerCalls = 0;
  const spyClient = {
    ...client,
    paymentRequests: {
      create: async (payload) => {
        providerCalls += 1;
        return client.paymentRequests.create(payload);
      }
    }
  };
  const request = {
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-concurrent-001",
    client: spyClient
  };
  const [first, second] = await Promise.all([createCheckout(request), createCheckout(request)]);
  assert.equal(first.order.id, second.order.id);
  assert.equal(await BillingOrder.countDocuments({ accountId }), 1);
  assert.equal(providerCalls, 1);
});

test("expired checkout requires a new idempotency key and expiry is idempotent", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const checkout = await createCheckout({
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-expired-001",
    client,
    now
  });
  const later = new Date(now.getTime() + 16 * 60 * 1000);
  const first = await expirePendingBillingOrders({ now: later });
  const second = await expirePendingBillingOrders({ now: later });
  assert.equal(first.expired, 1);
  assert.equal(second.expired, 0);
  await assert.rejects(
    () => createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-expired-001", client, now: later }),
    (error) => error.code === "BILLING_CHECKOUT_RETRY_REQUIRED"
  );
  assert.equal((await BillingOrder.findById(checkout.order.id)).status, "EXPIRED");
});

test("invalid or mismatched webhooks do not grant PRO", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-webhook-001",
    client
  });
  const stored = await BillingOrder.findById(checkout.order.id);

  await assert.rejects(
    () => processPayOSWebhook({
      payload: { orderCode: stored.orderCode, amount: 1, currency: "VND", paymentLinkId: stored.paymentLinkId, code: "00", reference: "bad" },
      client
    }),
    (error) => error.code === "PAYMENT_MISMATCH"
  );
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);
});

test("a verified settled webhook grants PRO exactly once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-webhook-002",
    client
  });
  const stored = await BillingOrder.findById(checkout.order.id);
  const payload = {
    orderCode: stored.orderCode,
    amount: stored.amountVnd,
    currency: "VND",
    paymentLinkId: stored.paymentLinkId,
    code: "00",
    reference: "payos-reference-1"
  };

  const first = await processPayOSWebhook({ payload, client, now: new Date("2026-10-18T00:00:00.000Z") });
  const second = await processPayOSWebhook({ payload, client, now: new Date("2026-10-18T00:00:00.000Z") });

  assert.equal(first.granted, true);
  assert.equal(second.granted, false);
  assert.equal(await EntitlementGrant.countDocuments({ accountId, planCode: "PRO_30D" }), 1);
  assert.equal((await BillingOrder.findById(stored._id)).status, "PAID");
});

test("a verified payment after local expiry remains diagnosable without silently granting PRO", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-late-paid-001", client, now });
  const stored = await BillingOrder.findById(checkout.order.id);
  await expirePendingBillingOrders({ now: new Date(now.getTime() + 16 * 60 * 1000) });
  await assert.rejects(
    () => processPayOSWebhook({
      payload: { orderCode: stored.orderCode, amount: stored.amountVnd, currency: "VND", paymentLinkId: stored.paymentLinkId, code: "00", reference: "late-paid" },
      client
    }),
    (error) => error.code === "PAYMENT_LATE_SETTLEMENT_REQUIRES_RECONCILIATION"
  );
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);
});
