import { Model } from "mongoose";

import EntitlementGrant from "../entitlements/entitlementGrant.model";
import AiUsage from "../usage/aiUsage.model";
import BillingOrder from "./billingOrder.model";

type ManagedModel = Model<any>;

type IndexSpec = {
  collection: string;
  name: string;
  key: Record<string, unknown>;
  options: Record<string, unknown>;
};

type DuplicateFinding = { collection: string; index: string; groups: number };

const MIGRATION_ID = "2026-10-18-monetization-indexes-v1";
const monetizationModels: ManagedModel[] = [BillingOrder, EntitlementGrant, AiUsage];

const indexName = (key: Record<string, unknown>) =>
  Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");

const getMonetizationIndexSpecs = (): IndexSpec[] => monetizationModels.flatMap((model) =>
  model.schema.indexes().map(([key, options]) => ({
    collection: model.collection.name,
    name: options.name || indexName(key),
    key,
    options
  }))
);

const optionMatches = (existing, expected: IndexSpec) =>
  Boolean(existing.unique) === Boolean(expected.options.unique) &&
  Boolean(existing.sparse) === Boolean(expected.options.sparse) &&
  (existing.expireAfterSeconds ?? undefined) === (expected.options.expireAfterSeconds ?? undefined) &&
  JSON.stringify(existing.partialFilterExpression ?? undefined) ===
    JSON.stringify(expected.options.partialFilterExpression ?? undefined);

const classifyMonetizationIndexes = (existingIndexes, expectedIndexes: IndexSpec[]) => {
  const missing: IndexSpec[] = [];
  const incompatible: Array<{ expected: IndexSpec; existing: unknown }> = [];

  for (const expected of expectedIndexes) {
    const existingByName = existingIndexes.find((index) => index.name === expected.name);
    const existingByKey = existingIndexes.find((index) => JSON.stringify(index.key) === JSON.stringify(expected.key));
    const existing = existingByName || existingByKey;
    if (!existing) missing.push(expected);
    else if (
      existing.name !== expected.name ||
      JSON.stringify(existing.key) !== JSON.stringify(expected.key) ||
      !optionMatches(existing, expected)
    ) {
      incompatible.push({ expected, existing });
    }
  }

  return { missing, incompatible };
};

const uniqueIndexDuplicatePipeline = (spec: IndexSpec) => {
  const fields = Object.keys(spec.key);
  const sparseMatch = spec.options.sparse
    ? { $match: { $and: fields.map((field) => ({ [field]: { $exists: true } })) } }
    : null;
  return [
    ...(sparseMatch ? [sparseMatch] : []),
    { $group: { _id: fields.reduce((result, field) => ({ ...result, [field]: `$${field}` }), {}), count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" }
  ];
};

const assertExpectedDatabase = (expectedDatabase: string | undefined, actualDatabase: string) => {
  if (!expectedDatabase?.trim()) throw new Error("Expected database name is required. Use --database <name>.");
  if (expectedDatabase.trim() !== actualDatabase) {
    throw new Error("Connected database does not match the expected database name.");
  }
};

const assertApplySafety = ({ apply, backupReference, incompatibleIndexes, duplicateFindings }: {
  apply: boolean;
  backupReference?: string;
  incompatibleIndexes: number;
  duplicateFindings: DuplicateFinding[];
}) => {
  if (!apply) return;
  if (!backupReference?.trim()) throw new Error("MIGRATION_BACKUP_REFERENCE is required before apply.");
  if (incompatibleIndexes || duplicateFindings.some((finding) => finding.groups > 0)) {
    throw new Error("Refusing apply until incompatible indexes and duplicate findings are resolved.");
  }
};

export {
  MIGRATION_ID,
  assertApplySafety,
  assertExpectedDatabase,
  classifyMonetizationIndexes,
  getMonetizationIndexSpecs,
  uniqueIndexDuplicatePipeline,
  type DuplicateFinding,
  type IndexSpec
};
