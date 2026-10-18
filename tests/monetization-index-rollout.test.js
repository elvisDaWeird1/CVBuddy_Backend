const assert = require("node:assert/strict");
const test = require("node:test");

const {
  assertApplySafety,
  assertExpectedDatabase,
  classifyMonetizationIndexes,
  getMonetizationIndexSpecs,
  uniqueIndexDuplicatePipeline
} = require("../src/modules/billing/monetizationIndexRollout");
const { runMonetizationIndexRollout } = require("../src/modules/billing/monetizationIndexRolloutRunner");
const { parseCliOptions } = require("../scripts/rollout-monetization-indexes");

const migrationId = "2026-10-18-monetization-indexes-v1";

const createFakeDatabase = ({ duplicateGroups = {}, incompatible = false, ledger = false } = {}) => {
  const indexes = new Map();
  const writes = [];
  let hasLedgerEntry = ledger;
  for (const spec of getMonetizationIndexSpecs()) {
    if (!indexes.has(spec.collection)) indexes.set(spec.collection, [{ name: "_id_", key: { _id: 1 } }]);
  }
  indexes.set("migration_ledger", [{ name: "_id_", key: { _id: 1 } }]);
  if (incompatible) indexes.get("billing_orders").push({ name: "orderCode_1", key: { orderCode: 1 }, unique: false });

  return {
    name: "test",
    writes,
    collection: (name) => ({
      indexes: async () => indexes.get(name) || [],
      aggregate: () => ({ toArray: async () => duplicateGroups[name] ? [{ groups: duplicateGroups[name] }] : [] }),
      createIndex: async (key, options) => {
        writes.push({ type: "createIndex", name, key, options });
        const collectionIndexes = indexes.get(name) || [];
        if (!collectionIndexes.some((index) => index.name === options.name)) {
          collectionIndexes.push({ name: options.name, key, ...options });
          indexes.set(name, collectionIndexes);
        }
      },
      findOne: async () => hasLedgerEntry ? { migrationId } : null,
      updateOne: async () => {
        writes.push({ type: "updateOne", name });
        hasLedgerEntry = true;
      }
    })
  };
};

const replicaSet = { supported: true, topology: "replica_set" };

const seedMatchingIndexes = async (db) => {
  for (const spec of getMonetizationIndexSpecs()) {
    await db.collection(spec.collection).createIndex(spec.key, { ...spec.options, name: spec.name });
  }
  db.writes.length = 0;
};

test("monetization rollout derives indexes from all three owned schemas", () => {
  const collections = new Set(getMonetizationIndexSpecs().map((spec) => spec.collection));
  assert.deepEqual(collections, new Set(["billing_orders", "entitlement_grants", "ai_usage"]));
  assert.ok(getMonetizationIndexSpecs().some((spec) => (
    spec.collection === "billing_orders" && spec.name === "status_1_nextReconciliationAt_1"
  )));
  assert.ok(getMonetizationIndexSpecs().some((spec) => (
    spec.collection === "ai_usage" && spec.name === "state_1_reservationExpiresAt_1"
  )));
});

test("rollout detects missing and incompatible indexes", () => {
  const expected = [{ name: "orderCode_1", key: { orderCode: 1 }, options: { unique: true } }];
  assert.equal(classifyMonetizationIndexes([], expected).missing.length, 1);
  assert.equal(classifyMonetizationIndexes([
    { name: "orderCode_1", key: { orderCode: 1 }, unique: false, sparse: false }
  ], expected).incompatible.length, 1);
  assert.equal(classifyMonetizationIndexes([
    { name: "legacy_order_code", key: { orderCode: 1 }, unique: true, sparse: false }
  ], expected).incompatible.length, 1);
});

test("apply safety rejects missing backup references and duplicate gates", () => {
  assert.throws(() => assertApplySafety({ apply: true, backupReference: "", incompatibleIndexes: 0, duplicateFindings: [] }), /MIGRATION_BACKUP_REFERENCE/);
  assert.throws(() => assertApplySafety({
    apply: true,
    backupReference: "atlas-snapshot-123",
    incompatibleIndexes: 0,
    duplicateFindings: [{ collection: "billing_orders", index: "orderCode_1", groups: 1 }]
  }), /duplicate/);
});

test("rollout rejects a database-name mismatch", () => {
  assert.throws(() => assertExpectedDatabase("staging", "test"), /does not match/);
  assert.doesNotThrow(() => assertExpectedDatabase("test", "test"));
});

test("matching indexes make reruns idempotent and duplicate pipelines are aggregation-only", () => {
  const expected = [{ name: "paymentLinkId_1", key: { paymentLinkId: 1 }, options: { unique: true, sparse: true } }];
  const report = classifyMonetizationIndexes([
    { name: "paymentLinkId_1", key: { paymentLinkId: 1 }, unique: true, sparse: true }
  ], expected);
  assert.equal(report.missing.length, 0);
  assert.equal(report.incompatible.length, 0);
  const pipeline = uniqueIndexDuplicatePipeline(expected[0]);
  assert.equal(pipeline.at(-1).$count, "groups");
});

test("sparse unique duplicate pipeline includes explicit null values", () => {
  const spec = { name: "paymentLinkId_1", key: { paymentLinkId: 1 }, options: { unique: true, sparse: true } };
  const pipeline = uniqueIndexDuplicatePipeline(spec);
  assert.deepEqual(pipeline[0], { $match: { $and: [{ paymentLinkId: { $exists: true } }] } });
  const includedValues = [{ paymentLinkId: null }, { paymentLinkId: null }].filter((document) => "paymentLinkId" in document);
  assert.equal(includedValues.length, 2);
});

test("apply without backup reference fails before any write", async () => {
  const db = createFakeDatabase();
  await assert.rejects(
    runMonetizationIndexRollout({ db, topology: replicaSet, options: { apply: true, verify: false, expectedDatabase: "test" } }),
    /MIGRATION_BACKUP_REFERENCE/
  );
  assert.deepEqual(db.writes, []);
});

test("duplicate or incompatible indexes fail before any write", async () => {
  const duplicateDb = createFakeDatabase({ duplicateGroups: { billing_orders: 1 } });
  await assert.rejects(
    runMonetizationIndexRollout({ db: duplicateDb, topology: replicaSet, options: { apply: true, verify: false, expectedDatabase: "test", backupReference: "backup-1" } }),
    /duplicate/
  );
  assert.deepEqual(duplicateDb.writes, []);

  const incompatibleDb = createFakeDatabase({ incompatible: true });
  await assert.rejects(
    runMonetizationIndexRollout({ db: incompatibleDb, topology: replicaSet, options: { apply: true, verify: false, expectedDatabase: "test", backupReference: "backup-1" } }),
    /incompatible/
  );
  assert.deepEqual(incompatibleDb.writes, []);
});

test("database mismatch fails before collection access", async () => {
  const db = createFakeDatabase();
  await assert.rejects(
    runMonetizationIndexRollout({ db, topology: replicaSet, options: { apply: false, verify: false, expectedDatabase: "other" } }),
    /does not match/
  );
  assert.deepEqual(db.writes, []);
});

test("verify mode rejects a missing migration ledger entry", async () => {
  const db = createFakeDatabase();
  await seedMatchingIndexes(db);
  await assert.rejects(
    runMonetizationIndexRollout({ db, topology: replicaSet, options: { apply: false, verify: true, expectedDatabase: "test" } }),
    /verification failed/
  );
  assert.deepEqual(db.writes, []);
});

test("verify mode rejects missing, incompatible, and duplicate index states", async () => {
  const missingDb = createFakeDatabase({ ledger: true });
  await assert.rejects(
    runMonetizationIndexRollout({ db: missingDb, topology: replicaSet, options: { apply: false, verify: true, expectedDatabase: "test" } }),
    /verification failed/
  );

  const incompatibleDb = createFakeDatabase({ incompatible: true, ledger: true });
  await assert.rejects(
    runMonetizationIndexRollout({ db: incompatibleDb, topology: replicaSet, options: { apply: false, verify: true, expectedDatabase: "test" } }),
    /verification failed/
  );

  const duplicateDb = createFakeDatabase({ duplicateGroups: { billing_orders: 1 }, ledger: true });
  await seedMatchingIndexes(duplicateDb);
  await assert.rejects(
    runMonetizationIndexRollout({ db: duplicateDb, topology: replicaSet, options: { apply: false, verify: true, expectedDatabase: "test" } }),
    /verification failed/
  );
});

test("CLI parser wires --apply to the apply option", () => {
  assert.deepEqual(parseCliOptions(["--apply", "--database", "test"]), {
    apply: true,
    verify: false,
    expectedDatabase: "test",
    backupReference: process.env.MIGRATION_BACKUP_REFERENCE?.trim()
  });
});

test("successful apply receives apply=true, verifies actual indexes, and reruns idempotently", async () => {
  const db = createFakeDatabase();
  const result = await runMonetizationIndexRollout({
    db,
    topology: replicaSet,
    options: { apply: true, verify: false, expectedDatabase: "test", backupReference: "backup-1" }
  });
  assert.equal(result.missingIndexes, 0);
  assert.ok(db.writes.some((write) => write.type === "updateOne" && write.name === "migration_ledger"));
  const writesAfterFirstRun = db.writes.length;
  await runMonetizationIndexRollout({
    db,
    topology: replicaSet,
    options: { apply: true, verify: false, expectedDatabase: "test", backupReference: "backup-1" }
  });
  assert.equal(db.writes.filter((write) => write.type === "createIndex" && write.name !== "migration_ledger").length, 14);
  assert.ok(db.writes.length > writesAfterFirstRun);
});
