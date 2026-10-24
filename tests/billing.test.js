const assert = require("assert").strict;
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const BillingOrder = require("../src/modules/billing/billingOrder.model").default;
const EntitlementGrant = require("../src/modules/entitlements/entitlementGrant.model").default;
const {
  createCheckout,
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
        assert.equal(payload.amount, 49000);
        assert.equal(payload.items[0].price, 49000);
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
  assert.equal(first.order.amountVnd, 49000);
  assert.equal(first.order.id, second.order.id);
  assert.equal(providerCalls, 1);
});

test("an old-price pending order is not reused and keeps its historical amount", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const oldOrder = await BillingOrder.create({
    accountId,
    orderCode: 202610170001,
    planCode: "PRO_30D",
    amountVnd: 79000,
    status: "PENDING",
    idempotencyKey: "billing-old-price-001",
    paymentLinkId: "old-price-link",
    checkoutUrl: "https://checkout.example.test/old-price",
    expiresAt: new Date("2026-10-23T00:00:00.000Z")
  });

  await assert.rejects(
    () => createCheckout({
      accountId,
      planCode: "PRO_30D",
      idempotencyKey: "billing-old-price-001",
      client,
      now: new Date("2026-10-22T00:00:00.000Z")
    }),
    (error) => error.code === "CHECKOUT_PRICE_CHANGED" && error.statusCode === 409
  );
  const unchanged = await BillingOrder.findById(oldOrder._id);
  assert.equal(unchanged.amountVnd, 79000);
  assert.equal(unchanged.status, "PENDING");
  assert.equal(unchanged.paymentLinkId, "old-price-link");
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
  assert.equal(stored.amountVnd, 49000);
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
