const assert = require("node:assert/strict");
const test = require("node:test");

const { classifyIndexes, getManagedIndexSpecs } = require("../src/config/databaseBootstrap");

test("database bootstrap manages the canonical sparse Portfolio owner index", () => {
  const portfolioOwnerIndex = getManagedIndexSpecs().find((index) => (
    index.collection === "portfolios" && index.name === "applicantId_1"
  ));

  assert.equal(portfolioOwnerIndex.options.unique, true);
  assert.equal(portfolioOwnerIndex.options.sparse, true);
});

test("database bootstrap reports missing and incompatible indexes without applying changes", () => {
  const expected = [{
    name: "applicantId_1",
    key: { applicantId: 1 },
    options: { unique: true, sparse: true }
  }];

  const missing = classifyIndexes([], expected);
  assert.equal(missing.missing.length, 1);
  assert.equal(missing.incompatible.length, 0);

  const incompatible = classifyIndexes([
    { name: "applicantId_1", key: { applicantId: 1 }, unique: true, sparse: false }
  ], expected);
  assert.equal(incompatible.missing.length, 0);
  assert.equal(incompatible.incompatible.length, 1);
});
