import { getPayOSClient } from "./billing.config";

export type NormalizedPaymentStatus = "PAID" | "PENDING" | "CANCELLED" | "FAILED" | "EXPIRED" | "PROCESSING";

export type VerifiedPayment = {
  providerOrderCode: number;
  paymentLinkId: string;
  status: NormalizedPaymentStatus;
  amount: number;
  currency: string;
  paidAt?: Date;
  providerReference?: string;
};

export interface PayOSAdapter {
  createCheckout: (payload: Record<string, unknown>) => Promise<Record<string, unknown>>;
  verifyWebhook: (payload: unknown) => Promise<VerifiedPayment>;
  getPaymentStatus: (paymentLinkId: string, orderCode: number) => Promise<VerifiedPayment>;
}

const allowedStatuses = new Set<NormalizedPaymentStatus>([
  "PAID", "PENDING", "CANCELLED", "FAILED", "EXPIRED", "PROCESSING"
]);

const safeProviderError = (code: string) => {
  const error = new Error(code) as Error & { code?: string };
  error.code = code;
  return error;
};

const classifyProviderError = (error: unknown) => {
  const candidate = error as { status?: unknown; statusCode?: unknown; name?: unknown; code?: unknown };
  const status = Number(candidate?.status ?? candidate?.statusCode);
  if (status === 429) return "BILLING_PROVIDER_RATE_LIMIT";
  if (Number.isFinite(status) && status >= 500) return "BILLING_PROVIDER_UNAVAILABLE";
  if (candidate?.name === "ConnectionTimeoutError" || candidate?.code === "ETIMEDOUT") {
    return "BILLING_PROVIDER_TIMEOUT";
  }
  return "BILLING_PROVIDER_UNAVAILABLE";
};

const asDate = (value: unknown) => {
  if (!value) return undefined;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const normalize = (raw: any, verified = false): VerifiedPayment => {
  const status = String(verified ? (raw.code === "00" ? "PAID" : raw.status) : raw.status).toUpperCase();
  const providerOrderCode = Number(raw.orderCode);
  const amount = Number(raw.amount);
  const paymentLinkId = String(raw.paymentLinkId || raw.id || "").trim();
  const currency = String(raw.currency || "VND").toUpperCase();
  if (!allowedStatuses.has(status as NormalizedPaymentStatus) || !Number.isSafeInteger(providerOrderCode) ||
    !Number.isFinite(amount) || amount <= 0 || !paymentLinkId) {
    throw safeProviderError("BILLING_PROVIDER_MALFORMED_RESPONSE");
  }
  const transaction = Array.isArray(raw.transactions) ? raw.transactions[0] : undefined;
  return {
    providerOrderCode,
    paymentLinkId,
    status: status as NormalizedPaymentStatus,
    amount,
    currency,
    paidAt: asDate(raw.paidAt || transaction?.transactionDateTime),
    providerReference: String(raw.reference || transaction?.reference || transaction?.transactionId || "").trim() || undefined
  };
};

const createPayOSAdapter = (client = getPayOSClient() as any): PayOSAdapter => ({
  createCheckout: (payload) => client.paymentRequests.create(payload),
  async verifyWebhook(payload) {
    try {
      return normalize(await client.webhooks.verify(payload), true);
    } catch (error) {
      if ((error as { code?: string }).code === "BILLING_PROVIDER_MALFORMED_RESPONSE") throw error;
      throw safeProviderError("INVALID_PAYMENT_WEBHOOK");
    }
  },
  async getPaymentStatus(paymentLinkId, orderCode) {
    try {
      return normalize(await client.paymentRequests.get(paymentLinkId || orderCode));
    } catch (error) {
      if ((error as { code?: string }).code === "BILLING_PROVIDER_MALFORMED_RESPONSE") throw error;
      throw safeProviderError(classifyProviderError(error));
    }
  }
});

export { classifyProviderError, createPayOSAdapter, safeProviderError };
