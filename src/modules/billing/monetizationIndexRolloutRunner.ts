import {
  MIGRATION_ID,
  assertApplySafety,
  assertExpectedDatabase,
  classifyMonetizationIndexes,
  getMonetizationIndexSpecs,
  uniqueIndexDuplicatePipeline,
  type DuplicateFinding,
  type IndexSpec
} from "./monetizationIndexRollout";

type RolloutCollection = {
  indexes: () => Promise<any[]>;
  aggregate: (pipeline: unknown[]) => { toArray: () => Promise<any[]> };
  createIndex: (key: Record<string, unknown>, options: Record<string, unknown>) => Promise<unknown>;
  findOne: (filter: Record<string, unknown>) => Promise<unknown>;
  updateOne: (filter: Record<string, unknown>, update: Record<string, unknown>, options: Record<string, unknown>) => Promise<unknown>;
};

type RolloutDatabase = {
  name: string;
  collection: (name: string) => RolloutCollection;
};

type RolloutOptions = {
  apply: boolean;
  verify: boolean;
  backupReference?: string;
  expectedDatabase?: string;
};

type TransactionTopology = {
  supported: boolean;
  topology: string;
};

const getReports = async (db: RolloutDatabase, specs: IndexSpec[]) => {
  const collections = [...new Set(specs.map((spec) => spec.collection))];
  return Promise.all(collections.map(async (collection) => {
    const expected = specs.filter((spec) => spec.collection === collection);
    return { collection, ...classifyMonetizationIndexes(await db.collection(collection).indexes(), expected) };
  }));
};

const getDuplicateFindings = async (db: RolloutDatabase, specs: IndexSpec[]): Promise<DuplicateFinding[]> =>
  Promise.all(specs.filter((spec) => spec.options.unique).map(async (spec) => {
    const result = await db.collection(spec.collection).aggregate(uniqueIndexDuplicatePipeline(spec)).toArray();
    return { collection: spec.collection, index: spec.name, groups: result[0]?.groups || 0 };
  }));

const incompatibleCount = (reports) => reports.reduce((count, report) => count + report.incompatible.length, 0);
const missingCount = (reports) => reports.reduce((count, report) => count + report.missing.length, 0);

const runMonetizationIndexRollout = async ({ db, topology, options }: {
  db: RolloutDatabase;
  topology: TransactionTopology;
  options: RolloutOptions;
}) => {
  assertExpectedDatabase(options.expectedDatabase, db.name);
  if (!topology.supported) throw new Error("MongoDB topology does not support transactions.");

  const specs = getMonetizationIndexSpecs();
  const reports = await getReports(db, specs);
  const duplicateFindings = await getDuplicateFindings(db, specs);
  const incompatibleIndexes = incompatibleCount(reports);
  const ledger = db.collection("migration_ledger");
  const existingLedgerEntry = Boolean(await ledger.findOne({ migrationId: MIGRATION_ID }));

  assertApplySafety({
    apply: options.apply,
    backupReference: options.backupReference,
    incompatibleIndexes,
    duplicateFindings
  });

  const summary = {
    mode: options.apply ? "apply" : options.verify ? "verify" : "dry-run",
    migrationId: MIGRATION_ID,
    database: db.name,
    topology: topology.topology,
    existingLedgerEntry,
    missingIndexes: missingCount(reports),
    incompatibleIndexes,
    duplicateFindings,
    indexes: reports.map((report) => ({
      collection: report.collection,
      missing: report.missing.map((index) => index.name),
      incompatible: report.incompatible.map((finding) => finding.expected.name)
    }))
  };

  if (!options.apply) {
    if (options.verify && (!existingLedgerEntry || summary.missingIndexes || summary.incompatibleIndexes || duplicateFindings.some((finding) => finding.groups))) {
      throw new Error("Index verification failed.");
    }
    return summary;
  }

  await ledger.createIndex({ migrationId: 1 }, { unique: true });
  for (const report of reports) {
    for (const index of report.missing) {
      await db.collection(report.collection).createIndex(index.key, { ...index.options, name: index.name });
    }
  }

  const postApplyReports = await getReports(db, specs);
  if (missingCount(postApplyReports) || incompatibleCount(postApplyReports)) {
    throw new Error("Index creation verification failed; migration ledger was not written.");
  }

  await ledger.updateOne(
    { migrationId: MIGRATION_ID },
    { $setOnInsert: { migrationId: MIGRATION_ID, backupReference: options.backupReference, appliedAt: new Date() } },
    { upsert: true }
  );
  return { ...summary, existingLedgerEntry: true, missingIndexes: 0, incompatibleIndexes: 0 };
};

export {
  runMonetizationIndexRollout,
  type RolloutDatabase,
  type RolloutOptions,
  type TransactionTopology
};
