const assert = require("node:assert/strict");
const test = require("node:test");

const {
  blockLegacyPortfolioWrite,
  legacyPortfolioWritesEnabled
} = require("../src/middlewares/legacyPortfolioWrite.middleware");
const { swaggerSpec } = require("../src/config/swagger");

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

test("legacy Portfolio writes are enabled outside production", async () => {
  await withEnvironment({ NODE_ENV: "test", ENABLE_LEGACY_PORTFOLIO_WRITES: undefined }, async () => {
    assert.equal(legacyPortfolioWritesEnabled(), true);
  });
});

test("legacy Portfolio writes are blocked by default in production", async () => {
  await withEnvironment({ NODE_ENV: "production", ENABLE_LEGACY_PORTFOLIO_WRITES: undefined }, async () => {
    let error;
    blockLegacyPortfolioWrite({}, {}, (received) => { error = received; });

    assert.equal(legacyPortfolioWritesEnabled(), false);
    assert.equal(error.statusCode, 410);
    assert.equal(error.code, "LEGACY_PORTFOLIO_WRITES_DISABLED");
  });
});

test("production rollback requires an explicit legacy write opt-in", async () => {
  await withEnvironment({ NODE_ENV: "production", ENABLE_LEGACY_PORTFOLIO_WRITES: "true" }, async () => {
    let called = false;
    blockLegacyPortfolioWrite({}, {}, () => { called = true; });

    assert.equal(legacyPortfolioWritesEnabled(), true);
    assert.equal(called, true);
  });
});

test("Swagger marks guarded legacy writes as deprecated and documents 410", () => {
  const legacyOperations = [
    swaggerSpec.paths["/api/portfolios/me"].patch,
    swaggerSpec.paths["/api/portfolio-items"].post,
    swaggerSpec.paths["/api/portfolio-items/{id}"].patch,
    swaggerSpec.paths["/api/portfolio-items/{id}"].delete,
    swaggerSpec.paths["/api/mobile/portfolio/photos"].post
  ];

  for (const operation of legacyOperations) {
    assert.equal(operation.deprecated, true);
    assert.ok(operation.responses[410]);
  }
});
