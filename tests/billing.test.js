const assert = require("assert").strict;
const { after, before, beforeEach, test } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const BillingOrder = require("../src/modules/billing/billingOrder.model").default;
const EntitlementGrant = require("../src/modules/entitlements/entitlementGrant.model").default;
const { createPayOSAdapter } = require("../src/modules/billing/payos.adapter");
const {
  createCheckout,
  expirePendingBillingOrders,
  finalizeVerifiedPayment,
  getMyBilling,
  processPayOSWebhook,
  reconcileBillingOrder,
  reconciliationBackoffMs
} = require("../src/modules/billing/billing.service");

let replSet;

const adapter = {
  createCheckout: async (payload) => ({
      paymentLinkId: `link-${payload.orderCode}`,
      checkoutUrl: `https://checkout.example.test/${payload.orderCode}`,
      orderCode: payload.orderCode,
      amount: payload.amount,
      currency: "VND",
      status: "PENDING"
    }),
  verifyWebhook: async (payload) => ({
    providerOrderCode: payload.orderCode,
    amount: payload.amount,
    currency: payload.currency,
    paymentLinkId: payload.paymentLinkId,
    status: payload.code === "00" ? "PAID" : "FAILED",
    providerReference: payload.reference
  }),
  getPaymentStatus: async (paymentLinkId, orderCode) => ({
    providerOrderCode: orderCode,
    amount: 79000,
    currency: "VND",
    paymentLinkId,
    status: "PENDING"
  })
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
  const spyAdapter = {
    ...adapter,
    createCheckout: async (payload) => {
        providerCalls += 1;
        assert.equal(payload.amount, 79000);
        assert.equal(payload.items[0].price, 79000);
        assert.match(payload.returnUrl, /orderId=/);
        return adapter.createCheckout(payload);
      }
  };
  const request = {
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-checkout-001",
    adapter: spyAdapter,
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

test("billing status exposes a server-owned catalog while checkout remains disabled", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const previous = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "false";
  try {
    const billing = await getMyBilling(accountId, new Date("2026-10-18T00:00:00.000Z"));
    assert.equal(billing.enabled, false);
    assert.equal(billing.catalogVersion, "2026-10-17-draft");
    assert.deepEqual(billing.plans.PRO_30D, {
      code: "PRO_30D",
      durationDays: 30,
      creditsGranted: 60,
      priceVnd: 79000
    });
    assert.deepEqual(billing.featureCosts, {
      CV_EVALUATION: 2,
      CV_TRANSLATION: 2,
      TRANSLATE_AND_EVALUATE: 4,
      TARGETED_REVIEW: 3
    });
    assert.equal(billing.orders.length, 0);
    await assert.rejects(
      () => createCheckout({
        accountId,
        planCode: "PRO_30D",
        idempotencyKey: "billing-disabled-catalog-001",
        adapter
      }),
      (error) => error.code === "BILLING_DISABLED"
    );
  } finally {
    process.env.BILLING_ENABLED = previous;
  }
});

test("concurrent checkout requests reuse one order and one provider checkout", async () => {
  const accountId = new mongoose.Types.ObjectId();
  let providerCalls = 0;
  const spyAdapter = {
    ...adapter,
    createCheckout: async (payload) => {
        providerCalls += 1;
        return adapter.createCheckout(payload);
      }
  };
  const request = {
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-concurrent-001",
    adapter: spyAdapter
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
    adapter,
    now
  });
  const later = new Date(now.getTime() + 16 * 60 * 1000);
  const first = await expirePendingBillingOrders({ now: later });
  const second = await expirePendingBillingOrders({ now: later });
  assert.equal(first.expired, 1);
  assert.equal(second.expired, 0);
  await assert.rejects(
    () => createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-expired-001", adapter, now: later }),
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
    adapter
  });
  const stored = await BillingOrder.findById(checkout.order.id);

  await assert.rejects(
    () => processPayOSWebhook({
      payload: { orderCode: stored.orderCode, amount: 1, currency: "VND", paymentLinkId: stored.paymentLinkId, code: "00", reference: "bad" },
      adapter
    }),
    (error) => error.code === "PAYMENT_MISMATCH"
  );
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);

  await assert.rejects(
    () => processPayOSWebhook({
      payload: { orderCode: stored.orderCode, amount: stored.amountVnd, currency: "VND", paymentLinkId: "other-payment-link", code: "00", reference: "bad-link" },
      adapter
    }),
    (error) => error.code === "PAYMENT_MISMATCH"
  );
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);
});

test("an invalid PayOS signature is rejected before acknowledgement", async () => {
  const invalidSignatureAdapter = {
    ...adapter,
    verifyWebhook: async () => {
      throw Object.assign(new Error("invalid signature"), { code: "INVALID_PAYMENT_WEBHOOK" });
    }
  };
  await assert.rejects(
    () => processPayOSWebhook({ payload: { any: "payload" }, adapter: invalidSignatureAdapter }),
    (error) => error.statusCode === 400 && error.code === "INVALID_PAYMENT_WEBHOOK"
  );
  assert.equal(await BillingOrder.countDocuments({}), 0);
  assert.equal(await EntitlementGrant.countDocuments({}), 0);
});

test("a signed unmatched webhook probe is acknowledged without database writes", async () => {
  const before = {
    orders: await BillingOrder.countDocuments({}),
    grants: await EntitlementGrant.countDocuments({})
  };
  const probeOrderCode = Number(`${Date.now()}`.slice(-12));
  const probeAdapter = {
    ...adapter,
    verifyWebhook: async () => ({
      providerOrderCode: probeOrderCode,
      paymentLinkId: `registration-probe-${probeOrderCode}`,
      amount: 1,
      currency: "VND",
      status: "PAID"
    })
  };

  const result = await processPayOSWebhook({ payload: { signed: true }, adapter: probeAdapter });

  assert.deepEqual(result, { acknowledged: true, matched: false });
  assert.equal(await BillingOrder.countDocuments({}), before.orders);
  assert.equal(await EntitlementGrant.countDocuments({}), before.grants);
});

test("billing-disabled accepts only a signed unmatched probe and leaves matching payments retryable", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-disabled-webhook-001", adapter });
  const stored = await BillingOrder.findById(checkout.order.id);
  const previous = process.env.BILLING_ENABLED;
  process.env.BILLING_ENABLED = "false";
  try {
    const unmatched = await processPayOSWebhook({
      payload: { ignored: true },
      adapter: {
        ...adapter,
        verifyWebhook: async () => ({
          providerOrderCode: stored.orderCode + 1,
          paymentLinkId: "signed-registration-probe",
          amount: 1,
          currency: "VND",
          status: "PAID"
        })
      }
    });
    assert.deepEqual(unmatched, { acknowledged: true, matched: false });
    await assert.rejects(
      () => processPayOSWebhook({
        payload: { orderCode: stored.orderCode },
        adapter
      }),
      (error) => error.statusCode === 503 && error.code === "BILLING_DISABLED"
    );
    assert.equal((await BillingOrder.findById(stored._id)).status, "PENDING");
    assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);
  } finally {
    process.env.BILLING_ENABLED = previous;
  }
});

test("a verified settled webhook grants PRO exactly once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({
    accountId,
    planCode: "PRO_30D",
    idempotencyKey: "billing-webhook-002",
    adapter
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

  const first = await processPayOSWebhook({ payload, adapter, now: new Date("2026-10-18T00:00:00.000Z") });
  const second = await processPayOSWebhook({ payload, adapter, now: new Date("2026-10-18T00:00:00.000Z") });

  assert.equal(first.acknowledged, true);
  assert.equal(first.matched, true);
  assert.equal(first.granted, true);
  assert.equal(second.acknowledged, true);
  assert.equal(second.matched, true);
  assert.equal(second.granted, false);
  assert.equal(await EntitlementGrant.countDocuments({ accountId, planCode: "PRO_30D" }), 1);
  assert.equal((await BillingOrder.findById(stored._id)).status, "PAID");
});

test("a verified payment after local expiry grants PRO once and records late settlement", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-late-paid-001", adapter, now });
  const stored = await BillingOrder.findById(checkout.order.id);
  await expirePendingBillingOrders({ now: new Date(now.getTime() + 16 * 60 * 1000) });
  const result = await processPayOSWebhook({
      payload: { orderCode: stored.orderCode, amount: stored.amountVnd, currency: "VND", paymentLinkId: stored.paymentLinkId, code: "00", reference: "late-paid" },
      adapter
    });
  const order = await BillingOrder.findById(checkout.order.id);
  assert.equal(result.granted, true);
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 1);
  assert.equal(order.status, "PAID");
  assert.equal(order.previousSettlementStatus, "EXPIRED");
  assert.ok(order.lateSettlementAt);
});

test("reconciliation repairs a missed paid webhook exactly once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-reconcile-paid-001", adapter });
  const stored = await BillingOrder.findById(checkout.order.id);
  const paidAdapter = {
    ...adapter,
    getPaymentStatus: async () => ({ providerOrderCode: stored.orderCode, paymentLinkId: stored.paymentLinkId, amount: stored.amountVnd, currency: "VND", status: "PAID", providerReference: "reconcile-1" })
  };
  const first = await reconcileBillingOrder({ orderId: stored._id, adapter: paidAdapter, force: true });
  const second = await reconcileBillingOrder({ orderId: stored._id, adapter: paidAdapter, force: true });
  assert.equal(first.granted, true);
  assert.equal(second.granted, false);
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 1);
  assert.equal((await BillingOrder.findById(stored._id)).status, "PAID");
});

test("paid order without an entitlement is repaired by shared finalization", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-repair-grant-001", adapter });
  const stored = await BillingOrder.findById(checkout.order.id);
  stored.status = "PAID";
  stored.paidAt = new Date();
  await stored.save();
  const result = await finalizeVerifiedPayment({
    source: "RECONCILIATION",
    payment: { providerOrderCode: stored.orderCode, paymentLinkId: stored.paymentLinkId, amount: stored.amountVnd, currency: "VND", status: "PAID", providerReference: "repair-1" }
  });
  assert.equal(result.granted, true);
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 1);
});

test("pending reconciliation schedules bounded backoff and concurrent workers claim once", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const now = new Date("2026-10-18T00:00:00.000Z");
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-reconcile-pending-001", adapter, now });
  const stored = await BillingOrder.findById(checkout.order.id);
  const [one, two] = await Promise.all([
    reconcileBillingOrder({ orderId: stored._id, adapter, now, force: true }),
    reconcileBillingOrder({ orderId: stored._id, adapter, now, force: true })
  ]);
  assert.equal([one, two].filter((result) => result.claimed).length, 1);
  const refreshed = await BillingOrder.findById(stored._id);
  assert.equal(refreshed.lastReconciliationErrorCode, "BILLING_PROVIDER_PENDING");
  assert.equal(refreshed.nextReconciliationAt.getTime(), now.getTime() + 60_000);
  assert.equal(reconciliationBackoffMs(1), 60_000);
  assert.equal(reconciliationBackoffMs(2), 300_000);
  assert.equal(reconciliationBackoffMs(3), 900_000);
  assert.equal(reconciliationBackoffMs(4), 3_600_000);
});

test("provider failures remain recoverable and never become payment failures", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-provider-retry-001", adapter });
  const stored = await BillingOrder.findById(checkout.order.id);
  const unavailable = { ...adapter, getPaymentStatus: async () => { throw Object.assign(new Error("offline"), { code: "BILLING_PROVIDER_UNAVAILABLE" }); } };
  const result = await reconcileBillingOrder({ orderId: stored._id, adapter: unavailable, force: true });
  const refreshed = await BillingOrder.findById(stored._id);
  assert.equal(result.outcome, "RETRY");
  assert.equal(refreshed.status, "PENDING");
  assert.equal(refreshed.lastReconciliationErrorCode, "BILLING_PROVIDER_UNAVAILABLE");
});

test("PayOS adapter allowlists status and returns only normalized safe fields", async () => {
  const fakeSdk = {
    paymentRequests: {
      create: async () => ({}),
      get: async () => ({ id: "link-safe", orderCode: 123, amount: 79000, status: "PAID", transactions: [{ reference: "ref-safe" }] })
    },
    webhooks: { verify: async () => ({ paymentLinkId: "link-safe", orderCode: 123, amount: 79000, currency: "VND", code: "00", reference: "ref-safe" }) }
  };
  const normalized = await createPayOSAdapter(fakeSdk).getPaymentStatus("link-safe", 123);
  assert.deepEqual(normalized, { providerOrderCode: 123, paymentLinkId: "link-safe", status: "PAID", amount: 79000, currency: "VND", paidAt: undefined, providerReference: "ref-safe" });
  await assert.rejects(
    () => createPayOSAdapter({ ...fakeSdk, paymentRequests: { ...fakeSdk.paymentRequests, get: async () => ({ id: "x", orderCode: 123, amount: 1, status: "UNRECOGNIZED" }) } }).getPaymentStatus("x", 123),
    (error) => error.code === "BILLING_PROVIDER_MALFORMED_RESPONSE" && !String(error.message).includes("secret")
  );
});

test("provider cancelled reconciliation transitions safely without an entitlement", async () => {
  const accountId = new mongoose.Types.ObjectId();
  const checkout = await createCheckout({ accountId, planCode: "PRO_30D", idempotencyKey: "billing-reconcile-cancelled-001", adapter });
  const stored = await BillingOrder.findById(checkout.order.id);
  const cancelled = { ...adapter, getPaymentStatus: async () => ({ providerOrderCode: stored.orderCode, paymentLinkId: stored.paymentLinkId, amount: stored.amountVnd, currency: "VND", status: "CANCELLED" }) };
  const result = await reconcileBillingOrder({ orderId: stored._id, adapter: cancelled, force: true });
  assert.equal(result.outcome, "CANCELLED");
  assert.equal((await BillingOrder.findById(stored._id)).status, "CANCELLED");
  assert.equal(await EntitlementGrant.countDocuments({ accountId }), 0);
});
