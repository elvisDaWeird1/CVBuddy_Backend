const assert = require("node:assert/strict");
const test = require("node:test");

const { getReadiness, validateProductionRuntimeConfig } = require("../src/config/runtime");
const { classifyMongoTransactionTopology } = require("../src/config/mongoTransactions");

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
  CLOUDINARY_API_SECRET: "secret",
  BILLING_ENABLED: "false"
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

test("production runtime validation requires an internal AI key when AI is enabled", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "true",
    AI_SERVICE_URL: "https://ai.example.com",
    AI_SERVICE_TIMEOUT_MS: "60000",
    AI_INTERNAL_API_KEY: undefined
  }, async () => {
    assert.throws(validateProductionRuntimeConfig, /AI_INTERNAL_API_KEY/);
  });
});

test("production runtime validation requires the AI service root URL", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "true",
    AI_SERVICE_URL: "https://ai.example.com/v1",
    AI_SERVICE_TIMEOUT_MS: "60000",
    AI_INTERNAL_API_KEY: "test-only-internal-key-with-32-characters"
  }, async () => {
    assert.throws(validateProductionRuntimeConfig, /service root/);
  });
});

test("production runtime validation accepts complete fail-closed AI configuration", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "true",
    AI_SERVICE_URL: "https://ai.example.com",
    AI_SERVICE_TIMEOUT_MS: "60000",
    AI_USAGE_RESERVATION_TTL_MS: "600000",
    AI_USAGE_RECONCILE_INTERVAL_MS: "60000",
    AI_INTERNAL_API_KEY: "test-only-internal-key-with-32-characters"
  }, async () => {
    assert.doesNotThrow(validateProductionRuntimeConfig);
  });
});

test("production runtime validation rejects mock AI output opt-in", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "false",
    AI_SERVICE_ALLOW_MOCK_OUTPUT: "true"
  }, async () => {
    assert.throws(validateProductionRuntimeConfig, /AI_SERVICE_ALLOW_MOCK_OUTPUT/);
  });
});

test("production billing cannot start with incomplete PayOS configuration", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "false",
    BILLING_ENABLED: "true",
    PAYOS_CLIENT_ID: undefined,
    PAYOS_API_KEY: undefined,
    PAYOS_CHECKSUM_KEY: undefined,
    BILLING_RETURN_URL: undefined,
    BILLING_CANCEL_URL: undefined,
    PAYOS_WEBHOOK_URL: undefined
  }, async () => {
    assert.throws(validateProductionRuntimeConfig, /PAYOS_CLIENT_ID/);
  });
});

test("production billing accepts a complete non-secret environment contract", async () => {
  await withEnvironment({
    ...productionBaseline,
    AI_SERVICE_ENABLED: "false",
    BILLING_ENABLED: "true",
    PAYOS_CLIENT_ID: "client-id-placeholder",
    PAYOS_API_KEY: "api-key-placeholder",
    PAYOS_CHECKSUM_KEY: "checksum-key-placeholder",
    BILLING_RETURN_URL: "https://app.example.com/billing/return",
    BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
    PAYOS_WEBHOOK_URL: "https://api.example.com/api/billing/webhooks/payos"
  }, async () => {
    assert.doesNotThrow(validateProductionRuntimeConfig);
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
    const readiness = await getReadiness();
    assert.equal(readiness.aiEnabled, false);
    assert.deepEqual(readiness.checks.ai, { enabled: false, ready: null });
    assert.equal(readiness.checks.cloudinary, false);
    assert.equal(readiness.ready, false);
  });
});

test("transaction topology accepts replica sets and mongos but rejects standalone MongoDB", () => {
  assert.deepEqual(classifyMongoTransactionTopology({ setName: "rs0" }), {
    required: false,
    supported: true,
    topology: "replica_set"
  });
  assert.deepEqual(classifyMongoTransactionTopology({ msg: "isdbgrid" }), {
    required: false,
    supported: true,
    topology: "mongos"
  });
  assert.deepEqual(classifyMongoTransactionTopology({ isWritablePrimary: true }), {
    required: false,
    supported: false,
    topology: "standalone"
  });
});
