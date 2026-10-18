import mongoose, { Types } from "mongoose";

import { PLAN_CATALOG, PLAN_CODES } from "../../config/planCatalog";
import ApiError from "../../utils/apiError";
import { getEffectiveEntitlement, grantPro30Days } from "../entitlements/entitlement.service";
import BillingOrder, { BILLING_ORDER_STATUSES } from "./billingOrder.model";
import { getBillingConfig, getPayOSClient } from "./billing.config";

const BILLING_ORDER_TTL_MINUTES = 15;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;

type PayOSClient = {
  paymentRequests: {
    create: (payload: {
      orderCode: number;
      amount: number;
      description: string;
      cancelUrl: string;
      returnUrl: string;
      items: Array<{ name: string; quantity: number; price: number }>;
      expiredAt: number;
    }) => Promise<{
      paymentLinkId: string;
      checkoutUrl: string;
      orderCode: number;
      amount: number;
      currency: string;
      status: string;
    }>;
  };
  webhooks: {
    verify: (payload: unknown) => Promise<{
      orderCode: number;
      amount: number;
      currency: string;
      paymentLinkId: string;
      code: string;
      reference: string;
    }>;
  };
};

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

const expireBillingOrder = async (orderId, now = new Date(), reason = "CHECKOUT_EXPIRED") =>
  BillingOrder.findOneAndUpdate(
    { _id: orderId, status: BILLING_ORDER_STATUSES.PENDING, expiresAt: { $lte: now } },
    { $set: { status: BILLING_ORDER_STATUSES.EXPIRED, expiredAt: now, lastReconciliationErrorCode: reason } },
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
  client
}: {
  accountId: Types.ObjectId | string;
  planCode: string;
  idempotencyKey: string;
  now?: Date;
  client?: PayOSClient;
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
  const payos = client || (getPayOSClient() as unknown as PayOSClient);
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
        expiresAt
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
    const paymentLink = await payos.paymentRequests.create({
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
    entitlement,
    orders: orders.map(serializeBillingOrder)
  };
};

const getMyBillingOrder = async (accountId, orderId: string) => {
  const order = await BillingOrder.findOne({ _id: orderId, accountId });
  if (!order) throw new ApiError(404, "Billing order not found");
  return serializeBillingOrder(order);
};

const processPayOSWebhook = async ({
  payload,
  client,
  now = new Date()
}: {
  payload: unknown;
  client?: PayOSClient;
  now?: Date;
}) => {
  assertBillingEnabled();
  const payos = client || (getPayOSClient() as unknown as PayOSClient);
  let webhook;
  try {
    webhook = await payos.webhooks.verify(payload);
  } catch {
    throw new ApiError(400, "Invalid payment webhook", [], "INVALID_PAYMENT_WEBHOOK");
  }

  if (webhook.currency !== "VND" || webhook.code !== "00") {
    throw new ApiError(400, "Payment webhook does not represent a successful VND payment", [], "PAYMENT_NOT_SETTLED");
  }

  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const order = await BillingOrder.findOne({ orderCode: webhook.orderCode }).session(session);
      if (!order) throw new ApiError(404, "Billing order not found");
      if (order.amountVnd !== webhook.amount || order.paymentLinkId !== webhook.paymentLinkId) {
        throw new ApiError(400, "Payment webhook does not match its billing order", [], "PAYMENT_MISMATCH");
      }
      if (order.status === BILLING_ORDER_STATUSES.PAID) {
        result = { order: serializeBillingOrder(order), granted: false };
        return;
      }
      if (order.status === BILLING_ORDER_STATUSES.EXPIRED || order.status === BILLING_ORDER_STATUSES.CANCELLED) {
        throw new ApiError(
          409,
          "A late verified payment requires the approved reconciliation policy.",
          [],
          "PAYMENT_LATE_SETTLEMENT_REQUIRES_RECONCILIATION"
        );
      }
      if (order.status !== BILLING_ORDER_STATUSES.PENDING) {
        throw new ApiError(409, "Billing order is not payable", [], "PAYMENT_STATE_CONFLICT");
      }

      const grant = await grantPro30Days({
        accountId: order.accountId,
        sourceOrderId: order._id.toString(),
        now,
        session
      });
      order.status = BILLING_ORDER_STATUSES.PAID;
      order.providerReference = webhook.reference;
      order.paidAt = now;
      await order.save({ session });
      result = { order: serializeBillingOrder(order), granted: grant.created };
    });
  } finally {
    await session.endSession();
  }
  return result;
};

export {
  createCheckout,
  expireBillingOrder,
  expirePendingBillingOrders,
  getMyBilling,
  getMyBillingOrder,
  processPayOSWebhook,
  serializeBillingOrder
};
