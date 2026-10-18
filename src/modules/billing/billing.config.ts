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

const getPayOSClient = () => {
  const config = getBillingConfig();
  return new PayOS({
    clientId: config.clientId,
    apiKey: config.apiKey,
    checksumKey: config.checksumKey
  });
};

export { getBillingConfig, getPayOSClient, isBillingEnabled };
