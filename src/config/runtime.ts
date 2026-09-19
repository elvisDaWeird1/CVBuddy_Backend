import mongoose from "mongoose";

import { assertCloudinaryConfigured, getCloudinaryConfig } from "./cloudinary.config";
import { validateSecurityConfig } from "./security";

const isAiEnabled = () => process.env.AI_SERVICE_ENABLED === "true";

const isValidHttpUrl = (value?: string) => {
  try {
    const url = new URL(value || "");
    return url.protocol === "http:" || url.protocol === "https:";
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
};

const getReadiness = () => {
  const cloudinary = getCloudinaryConfig();
  const checks = {
    mongo: mongoose.connection.readyState === 1,
    cloudinary: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
    ai: !isAiEnabled() || isValidHttpUrl(process.env.AI_SERVICE_URL)
  };

  return {
    ready: Object.values(checks).every(Boolean),
    checks,
    aiEnabled: isAiEnabled()
  };
};

export {
  getReadiness,
  isAiEnabled,
  validateProductionRuntimeConfig
};
