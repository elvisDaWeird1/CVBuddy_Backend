import mongoose, { Types } from "mongoose";

import {
  AI_CREDIT_COSTS,
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  PLAN_CODES
} from "../../config/planCatalog";
import ApiError from "../../utils/apiError";
import { getEffectiveEntitlement, grantPro30Days } from "../entitlements/entitlement.service";
import BillingOrder, { BILLING_ORDER_STATUSES } from "./billingOrder.model";
import { getBillingConfig, getBillingReconciliationConfig } from "./billing.config";
import { createPayOSAdapter, PayOSAdapter, VerifiedPayment } from "./payos.adapter";

const BILLING_ORDER_TTL_MINUTES = 15;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

const assertBillingEnabled = () => {
  if (!getBillingConfig().enabled) {
    throw new ApiError(503, "Billing is temporarily unavailable.", [], "BILLING_DISABLED");
  }
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

const appendOrderId = (baseUrl: string, orderId: string) => {
  const url = new URL(baseUrl);
  url.searchParams.set("orderId", orderId);
  return url.toString();
};

const createOrderCode = () => Number(
  `${Date.now()}${Math.floor(Math.random() * 100).toString().padStart(2, "0")}`
);

const serializeBillingOrder = (order) => ({
  id: order._id.toString(),
  planCode: order.planCode,
  amountVnd: order.amountVnd,
  status: order.status,
  checkoutUrl: order.checkoutUrl || null,
  expiresAt: order.expiresAt,
  expiredAt: order.expiredAt || null,
  paidAt: order.paidAt || null,
  lastReconciledAt: order.lastReconciledAt || null,
  reconciliationAttempts: order.reconciliationAttempts || 0,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt
});

const getBillingCatalogProjection = () => ({
  catalogVersion: PLAN_CATALOG_VERSION,
  plans: {
    [PLAN_CODES.FREE]: { ...PLAN_CATALOG[PLAN_CODES.FREE] },
    [PLAN_CODES.PRO_30D]: { ...PLAN_CATALOG[PLAN_CODES.PRO_30D] }
  },
  featureCosts: { ...AI_CREDIT_COSTS }
});

const expireBillingOrder = async (orderId, now = new Date(), reason = "CHECKOUT_EXPIRED") =>
  BillingOrder.findOneAndUpdate(
    { _id: orderId, status: BILLING_ORDER_STATUSES.PENDING, expiresAt: { $lte: now } },
    { $set: { status: BILLING_ORDER_STATUSES.EXPIRED, expiredAt: now, lastReconciliationErrorCode: reason, nextReconciliationAt: now } },
    { new: true }
  );

const expirePendingBillingOrders = async ({ now = new Date(), limit = 100 } = {}) => {
  const candidates = await BillingOrder.find({
    status: BILLING_ORDER_STATUSES.PENDING,
    expiresAt: { $lte: now }
  }).sort({ expiresAt: 1 }).limit(Math.min(Math.max(limit, 1), 500)).select("_id").lean();
  let expired = 0;
  for (const candidate of candidates) {
    if (await expireBillingOrder(candidate._id, now)) expired += 1;
  }
  return { scanned: candidates.length, expired };
};

const assertReusableOrder = async (order, now: Date) => {
  if (order.status === BILLING_ORDER_STATUSES.PENDING && order.expiresAt > now) return order;
  if (order.status === BILLING_ORDER_STATUSES.PENDING) await expireBillingOrder(order._id, now);
  throw new ApiError(
    409,
    "The previous checkout is no longer reusable. Start a new checkout with a new idempotency key.",
    [],
    "BILLING_CHECKOUT_RETRY_REQUIRED"
  );
};

const createCheckout = async ({
  accountId,
  planCode,
  idempotencyKey,
  now = new Date(),
  adapter
}: {
  accountId: Types.ObjectId | string;
  planCode: string;
  idempotencyKey: string;
  now?: Date;
  adapter?: PayOSAdapter;
}) => {
  assertBillingEnabled();
  if (planCode !== PLAN_CODES.PRO_30D) {
    throw new ApiError(400, "Unsupported plan", [], "UNSUPPORTED_PLAN");
  }

  const normalizedKey = normalizeIdempotencyKey(idempotencyKey);
  const existing = await BillingOrder.findOne({ accountId, idempotencyKey: normalizedKey });
  if (existing) {
    if (existing.planCode !== planCode) {
      throw new ApiError(409, "Idempotency key was already used for a different plan", [], "IDEMPOTENCY_CONFLICT");
    }
    return { order: serializeBillingOrder(await assertReusableOrder(existing, now)), created: false };
  }

  const config = getBillingConfig();
  const payos = adapter || createPayOSAdapter();
  const plan = PLAN_CATALOG[PLAN_CODES.PRO_30D];
  const expiresAt = new Date(now.getTime() + BILLING_ORDER_TTL_MINUTES * 60 * 1000);
  let order;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      order = await BillingOrder.create({
        accountId,
        orderCode: createOrderCode(),
        planCode: PLAN_CODES.PRO_30D,
        amountVnd: plan.priceVnd,
        status: BILLING_ORDER_STATUSES.PENDING,
        idempotencyKey: normalizedKey,
        expiresAt,
        nextReconciliationAt: now
      });
      break;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        const concurrent = await BillingOrder.findOne({ accountId, idempotencyKey: normalizedKey });
        if (concurrent) {
          if (concurrent.planCode !== planCode) {
            throw new ApiError(409, "Idempotency key was already used for a different plan", [], "IDEMPOTENCY_CONFLICT");
          }
          return { order: serializeBillingOrder(await assertReusableOrder(concurrent, now)), created: false };
        }
        if (attempt < 2) continue;
      }
      throw error;
    }
  }
  if (!order) throw new Error("Unable to allocate a billing order code");

  try {
    const paymentLink: any = await payos.createCheckout({
      orderCode: order.orderCode,
      amount: order.amountVnd,
      description: `CVB PRO ${order.orderCode}`,
      items: [{ name: "CVBuddy PRO 30 days", quantity: 1, price: order.amountVnd }],
      returnUrl: appendOrderId(config.returnUrl, order._id.toString()),
      cancelUrl: appendOrderId(config.cancelUrl, order._id.toString()),
      expiredAt: Math.floor(expiresAt.getTime() / 1000)
    });

    if (
      paymentLink.orderCode !== order.orderCode ||
      paymentLink.amount !== order.amountVnd ||
      paymentLink.currency !== "VND" ||
      !paymentLink.paymentLinkId ||
      !paymentLink.checkoutUrl
    ) {
      throw new Error("payOS returned an invalid payment link");
    }

    order.paymentLinkId = paymentLink.paymentLinkId;
    order.checkoutUrl = paymentLink.checkoutUrl;
    await order.save();
    return { order: serializeBillingOrder(order), created: true };
  } catch (error) {
    order.status = BILLING_ORDER_STATUSES.FAILED;
    await order.save().catch(() => undefined);
    throw new ApiError(502, "Unable to create a payment checkout.", [], "BILLING_PROVIDER_ERROR");
  }
};

const getMyBilling = async (accountId, now = new Date()) => {
  const [entitlement, orders] = await Promise.all([
    getEffectiveEntitlement(accountId, now),
    BillingOrder.find({ accountId }).sort({ createdAt: -1 }).limit(20)
  ]);
  return {
    enabled: getBillingConfig().enabled,
    ...getBillingCatalogProjection(),
    entitlement,
    orders: orders.map(serializeBillingOrder)
  };
};

const getMyBillingOrder = async (accountId, orderId: string) => {
  const order = await BillingOrder.findOne({ _id: orderId, accountId });
  if (!order) throw new ApiError(404, "Billing order not found");
  return serializeBillingOrder(order);
};

const finalizeVerifiedPayment = async ({
  payment,
  source,
  now = new Date()
}: {
  payment: VerifiedPayment;
  source: "WEBHOOK" | "RECONCILIATION";
  now?: Date;
}) => {
  if (payment.status !== "PAID" || payment.currency !== "VND") {
    throw new ApiError(400, "Payment is not a verified VND settlement", [], "PAYMENT_NOT_SETTLED");
  }
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await BillingOrder.findOne({ orderCode: payment.providerOrderCode }).session(session);
      if (!order) throw new ApiError(404, "Billing order not found");
      if (order.amountVnd !== payment.amount || order.paymentLinkId !== payment.paymentLinkId) {
        throw new ApiError(400, "Payment does not match its billing order", [], "PAYMENT_MISMATCH");
      }
      if (![BILLING_ORDER_STATUSES.PENDING, BILLING_ORDER_STATUSES.EXPIRED, BILLING_ORDER_STATUSES.CANCELLED, BILLING_ORDER_STATUSES.FAILED, BILLING_ORDER_STATUSES.PAID].includes(order.status)) {
        throw new ApiError(409, "Billing order is not payable", [], "PAYMENT_STATE_CONFLICT");
      }
      const previousStatus = order.status;
      const grant = await grantPro30Days({
        accountId: order.accountId,
        sourceOrderId: order._id.toString(),
        now,
        session
      });
      if (previousStatus !== BILLING_ORDER_STATUSES.PAID) {
        order.status = BILLING_ORDER_STATUSES.PAID;
        order.paidAt = payment.paidAt || now;
      }
      order.providerReference = payment.providerReference || order.providerReference;
      order.settlementSource = source;
      order.lastReconciledAt = now;
      order.nextReconciliationAt = undefined;
      order.reconciliationLeaseUntil = undefined;
      order.lastReconciliationErrorCode = undefined;
      if (previousStatus !== BILLING_ORDER_STATUSES.PENDING && previousStatus !== BILLING_ORDER_STATUSES.PAID) {
        order.previousSettlementStatus = previousStatus;
        order.lateSettlementAt = now;
      }
      await order.save({ session });
      result = { order: serializeBillingOrder(order), granted: grant.created };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

const processPayOSWebhook = async ({ payload, adapter, now = new Date() }: {
  payload: unknown;
  adapter?: PayOSAdapter;
  now?: Date;
}) => {
  let payment: VerifiedPayment;
  try {
    payment = await (adapter || createPayOSAdapter()).verifyWebhook(payload);
  } catch (error) {
    throw new ApiError(400, "Invalid payment webhook", [], "INVALID_PAYMENT_WEBHOOK");
  }

  // PayOS validates a webhook URL with a signed sample that is not a CVBuddy
  // checkout. Acknowledge only after signature verification and only when no
  // local order can match it; this path intentionally performs no writes.
  const matchingOrder = await BillingOrder.exists({ orderCode: payment.providerOrderCode });
  if (!matchingOrder) {
    console.warn(JSON.stringify({
      event: "billing_webhook_signed_unmatched",
      provider: "PAYOS",
      paymentStatus: payment.status
    }));
    return { acknowledged: true, matched: false };
  }

  // A genuine payment event must remain retryable while billing is disabled;
  // do not acknowledge it as processed before its durable transaction runs.
  assertBillingEnabled();
  const finalized = await finalizeVerifiedPayment({ payment, source: "WEBHOOK", now });
  return { acknowledged: true, matched: true, ...finalized };
};

const reconciliationBackoffMs = (attempt: number) => {
  if (attempt <= 1) return 60_000;
  if (attempt === 2) return 5 * 60_000;
  if (attempt === 3) return 15 * 60_000;
  return 60 * 60_000;
};

const reconciliationStatuses = [
  BILLING_ORDER_STATUSES.PENDING,
  BILLING_ORDER_STATUSES.EXPIRED,
  BILLING_ORDER_STATUSES.CANCELLED,
  BILLING_ORDER_STATUSES.FAILED,
  BILLING_ORDER_STATUSES.PAID
];

const claimBillingOrderForReconciliation = async (orderId, now: Date, force = false) => {
  const config = getBillingReconciliationConfig();
  const due = force ? {} : { nextReconciliationAt: { $lte: now } };
  return BillingOrder.findOneAndUpdate(
    {
      _id: orderId,
      status: { $in: reconciliationStatuses },
      ...due,
      $or: [{ reconciliationLeaseUntil: { $exists: false } }, { reconciliationLeaseUntil: { $lte: now } }]
    },
    {
      $set: { reconciliationLeaseUntil: new Date(now.getTime() + config.leaseMs) },
      $inc: { reconciliationAttempts: 1 }
    },
    { new: true }
  );
};

const recordReconciliationResult = async ({ orderId, now, code, retryable, claimedAt }: {
  orderId: unknown;
  now: Date;
  code?: string;
  retryable: boolean;
  claimedAt: Date;
}) => {
  const order = await BillingOrder.findOne({ _id: orderId, reconciliationLeaseUntil: { $gt: claimedAt } });
  if (!order) return;
  const age = now.getTime() - order.createdAt.getTime();
  const exhausted = age >= getBillingReconciliationConfig().maxAgeMs;
  const attempts = order.reconciliationAttempts;
  const next = retryable && !exhausted ? new Date(now.getTime() + reconciliationBackoffMs(attempts)) : undefined;
  order.lastReconciledAt = now;
  order.lastReconciliationErrorCode = exhausted ? "RECONCILIATION_EXHAUSTED" : code;
  order.nextReconciliationAt = next;
  order.reconciliationLeaseUntil = undefined;
  await order.save();
  if (attempts >= 5 || age >= 60 * 60_000) {
    console.warn(JSON.stringify({ event: "billing_reconciliation_escalation", orderId: String(orderId), attempts, ageMs: age, code: order.lastReconciliationErrorCode }));
  }
};

const reconcileBillingOrder = async ({ orderId, adapter, now = new Date(), force = false }: {
  orderId: string | Types.ObjectId;
  adapter?: PayOSAdapter;
  now?: Date;
  force?: boolean;
}) => {
  assertBillingEnabled();
  const claimed = await claimBillingOrderForReconciliation(orderId, now, force);
  if (!claimed) return { claimed: false };
  const claimedAt = now;
  try {
    if (!claimed.paymentLinkId) {
      await recordReconciliationResult({ orderId: claimed._id, now, code: "BILLING_MISSING_PAYMENT_LINK", retryable: false, claimedAt });
      return { claimed: true, outcome: "INVALID" };
    }
    const payment = await (adapter || createPayOSAdapter()).getPaymentStatus(claimed.paymentLinkId, claimed.orderCode);
    if (payment.providerOrderCode !== claimed.orderCode || payment.paymentLinkId !== claimed.paymentLinkId ||
      payment.amount !== claimed.amountVnd || payment.currency !== "VND") {
      await recordReconciliationResult({ orderId: claimed._id, now, code: "PAYMENT_MISMATCH", retryable: false, claimedAt });
      return { claimed: true, outcome: "MISMATCH" };
    }
    if (payment.status === "PAID") {
      const finalized = await finalizeVerifiedPayment({ payment, source: "RECONCILIATION", now });
      return { claimed: true, outcome: "PAID", ...finalized };
    }
    if (payment.status === "CANCELLED" || payment.status === "FAILED" || payment.status === "EXPIRED") {
      const status = payment.status === "CANCELLED" ? BILLING_ORDER_STATUSES.CANCELLED :
        payment.status === "EXPIRED" ? BILLING_ORDER_STATUSES.EXPIRED : BILLING_ORDER_STATUSES.FAILED;
      await BillingOrder.updateOne(
        { _id: claimed._id, reconciliationLeaseUntil: { $gt: claimedAt }, status: { $ne: BILLING_ORDER_STATUSES.PAID } },
        { $set: { status, lastReconciledAt: now, lastReconciliationErrorCode: undefined, reconciliationLeaseUntil: undefined, nextReconciliationAt: undefined } }
      );
      return { claimed: true, outcome: status };
    }
    await recordReconciliationResult({ orderId: claimed._id, now, code: "BILLING_PROVIDER_PENDING", retryable: true, claimedAt });
    return { claimed: true, outcome: "PENDING" };
  } catch (error) {
    const errorCode = (error as { code?: string }).code;
    const code = errorCode === "BILLING_PROVIDER_MALFORMED_RESPONSE"
      ? "BILLING_PROVIDER_MALFORMED_RESPONSE" : errorCode || "BILLING_PROVIDER_UNAVAILABLE";
    await recordReconciliationResult({
      orderId: claimed._id,
      now,
      code,
      retryable: !["PAYMENT_MISMATCH", "PAYMENT_STATE_CONFLICT"].includes(code),
      claimedAt
    });
    return { claimed: true, outcome: "RETRY", errorCode: code };
  }
};

const reconcileDueBillingOrders = async ({ adapter, now = new Date() }: { adapter?: PayOSAdapter; now?: Date } = {}) => {
  assertBillingEnabled();
  const config = getBillingReconciliationConfig();
  const candidates = await BillingOrder.find({
    status: { $in: reconciliationStatuses },
    nextReconciliationAt: { $lte: now },
    $or: [{ reconciliationLeaseUntil: { $exists: false } }, { reconciliationLeaseUntil: { $lte: now } }]
  }).sort({ nextReconciliationAt: 1 }).limit(config.batchSize).select("_id").lean();
  const results = await Promise.all(candidates.map((candidate) => reconcileBillingOrder({ orderId: candidate._id, adapter, now })));
  return { scanned: candidates.length, reconciled: results.filter((result) => result.claimed).length, results };
};

const startBillingReconciliation = ({
  reconcile = reconcileDueBillingOrders,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval
}: {
  reconcile?: () => Promise<unknown>;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
} = {}) => {
  const config = getBillingReconciliationConfig();
  if (!config.enabled || !getBillingConfig().enabled) return () => undefined;
  let running = false;
  console.info(JSON.stringify({
    event: "billing_reconciliation_worker_started",
    intervalMs: config.intervalMs,
    batchSize: config.batchSize,
    leaseMs: config.leaseMs
  }));
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const result = await reconcile() as { scanned?: unknown; reconciled?: unknown };
      console.info(JSON.stringify({
        event: "billing_reconciliation_cycle_completed",
        scanned: typeof result?.scanned === "number" ? result.scanned : undefined,
        reconciled: typeof result?.reconciled === "number" ? result.reconciled : undefined
      }));
    } catch (error) {
      console.error(JSON.stringify({ event: "billing_reconciliation_worker_failure", code: "BILLING_RECONCILIATION_WORKER_FAILURE" }));
    } finally {
      running = false;
    }
  };
  const timer = setIntervalFn(() => void tick(), config.intervalMs);
  timer.unref();
  void tick();
  return () => clearIntervalFn(timer);
};

export {
  createCheckout,
  expireBillingOrder,
  expirePendingBillingOrders,
  finalizeVerifiedPayment,
  getMyBilling,
  getMyBillingOrder,
  getBillingCatalogProjection,
  processPayOSWebhook,
  reconcileBillingOrder,
  reconcileDueBillingOrders,
  reconciliationBackoffMs,
  startBillingReconciliation,
  serializeBillingOrder
};
