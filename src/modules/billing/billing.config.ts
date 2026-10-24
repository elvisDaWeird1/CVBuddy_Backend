import { PayOS } from "@payos/node";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const isBillingEnabled = () => TRUE_VALUES.has(
  process.env.BILLING_ENABLED?.trim().toLowerCase() || ""
);

const getBillingConfig = () => ({
  enabled: isBillingEnabled(),
  clientId: (process.env.PAYOS_CLIENT_ID || "").trim(),
  apiKey: (process.env.PAYOS_API_KEY || "").trim(),
  checksumKey: (process.env.PAYOS_CHECKSUM_KEY || "").trim(),
  returnUrl: (process.env.BILLING_RETURN_URL || "").trim(),
  cancelUrl: (process.env.BILLING_CANCEL_URL || "").trim(),
  webhookUrl: (process.env.PAYOS_WEBHOOK_URL || "").trim()
});

const getBillingReconciliationConfig = () => {
  const numberValue = (name: string, fallback: number, minimum: number, maximum: number) => {
    const raw = process.env[name];
    if (!raw?.trim()) return fallback;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
    }
    return value;
  };
  return {
    enabled: TRUE_VALUES.has((process.env.BILLING_RECONCILIATION_ENABLED || "").trim().toLowerCase()),
    intervalMs: numberValue("BILLING_RECONCILIATION_INTERVAL_MS", 60_000, 10_000, 3_600_000),
    leaseMs: numberValue("BILLING_RECONCILIATION_LEASE_MS", 120_000, 30_000, 900_000),
    maxAgeMs: numberValue("BILLING_RECONCILIATION_MAX_AGE_MS", 86_400_000, 3_600_000, 604_800_000),
    batchSize: numberValue("BILLING_RECONCILIATION_BATCH_SIZE", 25, 1, 100)
  };
};

const getPayOSClient = () => {
  const config = getBillingConfig();
  return new PayOS({
    clientId: config.clientId,
    apiKey: config.apiKey,
    checksumKey: config.checksumKey
  });
};

export { getBillingConfig, getBillingReconciliationConfig, getPayOSClient, isBillingEnabled };
