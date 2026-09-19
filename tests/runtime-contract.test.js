const assert = require("node:assert/strict");
const test = require("node:test");

const { getReadiness, validateProductionRuntimeConfig } = require("../src/config/runtime");

const withEnvironment = async (values, callback) => {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });
  try {
    await callback();
  } finally {
    Object.entries(previous).forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
};

const productionBaseline = {
  NODE_ENV: "production",
  JWT_SECRET: "a-unique-production-secret-with-at-least-32-characters",
  JWT_EXPIRES_IN: "7d",
  CORS_ORIGIN: "https://app.example.com",
  TRUST_PROXY: "1",
  MONGO_URI: "mongodb://mongo:27017/cvbuddy",
  PUBLIC_PORTFOLIO_BASE_URL: "https://app.example.com/p",
  BCRYPT_SALT_ROUNDS: "12",
  MAX_CV_FILE_SIZE_MB: "5",
  MAX_IMAGE_FILE_SIZE_MB: "5",
  MAX_PORTFOLIO_FILE_SIZE_MB: "5",
  MAX_PORTFOLIO_MEDIA_COUNT: "5",
  CLOUDINARY_CLOUD_NAME: "demo",
  CLOUDINARY_API_KEY: "key",
  CLOUDINARY_API_SECRET: "secret"
};

test("production runtime validation accepts the documented baseline with AI disabled", async () => {
  await withEnvironment({ ...productionBaseline, AI_SERVICE_ENABLED: "false", AI_SERVICE_URL: undefined }, async () => {
    assert.doesNotThrow(validateProductionRuntimeConfig);
  });
});

test("production runtime validation requires an AI URL only when AI is enabled", async () => {
  await withEnvironment({ ...productionBaseline, AI_SERVICE_ENABLED: "true", AI_SERVICE_URL: undefined }, async () => {
    assert.throws(validateProductionRuntimeConfig, /AI_SERVICE_URL/);
  });
});

test("readiness exposes Mongo, Cloudinary, and conditional AI checks without contacting dependencies", async () => {
  await withEnvironment({
    CLOUDINARY_CLOUD_NAME: undefined,
    CLOUDINARY_API_KEY: undefined,
    CLOUDINARY_API_SECRET: undefined,
    AI_SERVICE_ENABLED: "false",
    AI_SERVICE_URL: undefined
  }, async () => {
    const readiness = getReadiness();
    assert.equal(readiness.aiEnabled, false);
    assert.equal(readiness.checks.ai, true);
    assert.equal(readiness.checks.cloudinary, false);
    assert.equal(readiness.ready, false);
  });
});
