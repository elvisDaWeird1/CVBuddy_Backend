import mongoose from "mongoose";

import { assertCloudinaryConfigured, getCloudinaryConfig } from "./cloudinary.config";
import { validateSecurityConfig } from "./security";
import { getAiServiceConfig } from "../modules/ai/ai.config";
import { getBillingConfig } from "../modules/billing/billing.config";
import { getMongoTransactionCapability } from "./mongoTransactions";

const isAiEnabled = () => getAiServiceConfig().enabled;
const isExplicitlyEnabled = (value?: string) =>
  new Set(["1", "true", "yes", "on"]).has(value?.trim().toLowerCase() || "");

const isValidHttpUrl = (value?: string) => {
  try {
    const url = new URL(value || "");
    return url.protocol === "http:" || url.protocol === "https:";
  } catch (error) {
    return false;
  }
};

const isServiceRootUrl = (value?: string) => {
  try {
    const url = new URL(value || "");
    return (url.protocol === "http:" || url.protocol === "https:") &&
      (url.pathname === "/" || url.pathname === "") &&
      !url.search &&
      !url.hash;
  } catch (error) {
    return false;
  }
};

const assertIntegerInRange = (name: string, value: string | undefined, minimum: number, maximum: number) => {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
};

const validateProductionRuntimeConfig = () => {
  if (process.env.NODE_ENV !== "production") return;

  validateSecurityConfig();
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!mongoUri?.trim() || !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    throw new Error("MONGO_URI or MONGODB_URI must be a valid MongoDB connection URI in production.");
  }
  if (!isValidHttpUrl(process.env.PUBLIC_PORTFOLIO_BASE_URL)) {
    throw new Error("PUBLIC_PORTFOLIO_BASE_URL must be a valid HTTP(S) URL in production.");
  }

  assertIntegerInRange("BCRYPT_SALT_ROUNDS", process.env.BCRYPT_SALT_ROUNDS, 10, 16);
  assertIntegerInRange("MAX_CV_FILE_SIZE_MB", process.env.MAX_CV_FILE_SIZE_MB, 1, 5);
  assertIntegerInRange("MAX_IMAGE_FILE_SIZE_MB", process.env.MAX_IMAGE_FILE_SIZE_MB, 1, 5);
  assertIntegerInRange("MAX_PORTFOLIO_FILE_SIZE_MB", process.env.MAX_PORTFOLIO_FILE_SIZE_MB, 1, 5);
  assertIntegerInRange("MAX_PORTFOLIO_MEDIA_COUNT", process.env.MAX_PORTFOLIO_MEDIA_COUNT, 1, 5);
  assertCloudinaryConfigured();

  if (isAiEnabled() && !isValidHttpUrl(process.env.AI_SERVICE_URL)) {
    throw new Error("AI_SERVICE_URL must be a valid HTTP(S) URL when AI_SERVICE_ENABLED=true.");
  }
  if (isAiEnabled() && !isServiceRootUrl(process.env.AI_SERVICE_URL)) {
    throw new Error("AI_SERVICE_URL must be the service root and must not include /v1, a query, or a fragment.");
  }
  if (isAiEnabled() && (process.env.AI_INTERNAL_API_KEY || "").trim().length < 32) {
    throw new Error("AI_INTERNAL_API_KEY must contain at least 32 characters when AI is enabled in production.");
  }
  if (isAiEnabled()) {
    assertIntegerInRange("AI_SERVICE_TIMEOUT_MS", process.env.AI_SERVICE_TIMEOUT_MS, 1_000, 120_000);
    assertIntegerInRange("AI_USAGE_RESERVATION_TTL_MS", process.env.AI_USAGE_RESERVATION_TTL_MS, 60_000, 3_600_000);
    assertIntegerInRange("AI_USAGE_RECONCILE_INTERVAL_MS", process.env.AI_USAGE_RECONCILE_INTERVAL_MS, 60_000, 3_600_000);
  }
  if (isExplicitlyEnabled(process.env.AI_SERVICE_ALLOW_MOCK_OUTPUT)) {
    throw new Error("AI_SERVICE_ALLOW_MOCK_OUTPUT must not be enabled in production.");
  }

  const billing = getBillingConfig();
  if (billing.enabled) {
    if (!billing.clientId || !billing.apiKey || !billing.checksumKey) {
      throw new Error("PAYOS_CLIENT_ID, PAYOS_API_KEY, and PAYOS_CHECKSUM_KEY are required when billing is enabled in production.");
    }
    if (!isValidHttpUrl(billing.returnUrl) || !isValidHttpUrl(billing.cancelUrl)) {
      throw new Error("BILLING_RETURN_URL and BILLING_CANCEL_URL must be valid HTTP(S) URLs when billing is enabled in production.");
    }
    if (!isValidHttpUrl(billing.webhookUrl) || !billing.webhookUrl.startsWith("https://")) {
      throw new Error("PAYOS_WEBHOOK_URL must be a valid HTTPS URL when billing is enabled in production.");
    }
  }
};

const assertMongoTransactionCapabilityForEnabledFeatures = async () => {
  const required = isAiEnabled() || getBillingConfig().enabled;
  if (!required || process.env.NODE_ENV !== "production") return;

  const capability = await getMongoTransactionCapability();
  if (!capability.supported) {
    throw new Error("MongoDB deployment does not support transactions required by enabled AI or billing features.");
  }
};

const getReadiness = async () => {
  const cloudinary = getCloudinaryConfig();
  const aiConfig = getAiServiceConfig();
  const aiEnabled = aiConfig.enabled;
  const aiReady = aiEnabled
    ? isServiceRootUrl(aiConfig.baseUrl) && aiConfig.internalApiKey.length > 0
    : null;
  const transactionRequired = aiEnabled || getBillingConfig().enabled;
  const transaction = transactionRequired
    ? await getMongoTransactionCapability()
    : { required: false, supported: null, topology: null };
  const checks = {
    mongo: mongoose.connection.readyState === 1,
    cloudinary: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
    ai: {
      enabled: aiEnabled,
      ready: aiReady
    },
    transactions: {
      required: transactionRequired,
      supported: transactionRequired ? transaction.supported : null,
      topology: transactionRequired ? transaction.topology : null
    }
  };

  return {
    ready: checks.mongo && checks.cloudinary && aiReady !== false && transaction.supported !== false,
    checks,
    aiEnabled
  };
};

export {
  assertMongoTransactionCapabilityForEnabledFeatures,
  getReadiness,
  isAiEnabled,
  isServiceRootUrl,
  validateProductionRuntimeConfig
};
