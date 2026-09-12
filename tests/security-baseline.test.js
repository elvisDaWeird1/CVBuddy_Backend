const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const test = require("node:test");
const express = require("express");
const app = require("../src/app").default;

const {
  getAllowedOrigins,
  isSwaggerEnabled,
  validateSecurityConfig
} = require("../src/config/security");
const { createRateLimit } = require("../src/middlewares/rateLimit.middleware");

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

const request = (port, path = "/") => new Promise((resolve, reject) => {
  const req = http.request({ hostname: "127.0.0.1", port, path, method: "GET" }, (res) => {
    res.resume();
    res.on("end", () => resolve(res));
  });
  req.on("error", reject);
  req.end();
});

test("production CORS uses only configured origins and disables Swagger by default", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    CORS_ORIGIN: "https://app.example.com",
    CLIENT_URL: undefined,
    SWAGGER_ENABLED: undefined
  }, async () => {
    assert.deepEqual(getAllowedOrigins(), ["https://app.example.com"]);
    assert.equal(isSwaggerEnabled(), false);
  });
});

test("production startup rejects weak JWT configuration and accepts a complete baseline", async () => {
  await withEnvironment({
    NODE_ENV: "production",
    JWT_SECRET: "change_me",
    JWT_EXPIRES_IN: "7d",
    CORS_ORIGIN: "https://app.example.com",
    TRUST_PROXY: "1"
  }, async () => {
    assert.throws(validateSecurityConfig, /JWT_SECRET/);
  });

  await withEnvironment({
    NODE_ENV: "production",
    JWT_SECRET: "a-unique-production-secret-with-at-least-32-characters",
    JWT_EXPIRES_IN: "7d",
    CORS_ORIGIN: "https://app.example.com",
    TRUST_PROXY: "1"
  }, async () => {
    assert.doesNotThrow(validateSecurityConfig);
  });
});

test("rate limiter returns 429 after its configured threshold", async () => {
  const app = express();
  app.get("/", createRateLimit(60_000, 1, "Rate limit test"), (req, res) => res.sendStatus(204));
  app.use((error, req, res, next) => res.status(error.statusCode || 500).json({ code: error.code }));
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const port = server.address().port;
    assert.equal((await request(port)).statusCode, 204);
    const limited = await request(port);
    assert.equal(limited.statusCode, 429);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("CV upload limiter applies only to the upload route, not CV reads", () => {
  const appSource = fs.readFileSync(path.join(__dirname, "../src/app.ts"), "utf8");
  const cvRoutesSource = fs.readFileSync(path.join(__dirname, "../src/modules/cvs/cv.routes.ts"), "utf8");

  assert.doesNotMatch(appSource, /app\.use\("\/api\/cvs", uploadRateLimit, cvRoutes\)/);
  assert.match(cvRoutesSource, /router\.post\("\/", uploadRateLimit, uploadCv/);
});

test("application responses include Helmet headers and omit X-Powered-By", async () => {
  const server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));

  try {
    const response = await request(server.address().port, "/api/health");
    assert.equal(response.headers["x-powered-by"], undefined);
    assert.equal(response.headers["x-content-type-options"], "nosniff");
    assert.ok(response.headers["content-security-policy"]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
