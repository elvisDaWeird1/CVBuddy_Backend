import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import connectDB from "../src/config/db";
import { classifyIndexes, getManagedIndexSpecs } from "../src/config/databaseBootstrap";
import Portfolio from "../src/modules/portfolios/portfolio.model";
import PortfolioItem from "../src/modules/portfolios/portfolioItem.model";

const MIGRATION_ID = "2026-09-11-database-bootstrap-v1";
const APPLY = process.argv.includes("--apply");
const BACKUP_REFERENCE = process.env.MIGRATION_BACKUP_REFERENCE?.trim();

const listIndexes = async (collection) => {
  try {
    return await mongoose.connection.db.collection(collection).indexes();
  } catch (error) {
    if (error?.codeName === "NamespaceNotFound") return [];
    throw error;
  }
};

const run = async () => {
  await connectDB();
  const ledger = mongoose.connection.db.collection("migration_ledger");
  const specs = getManagedIndexSpecs();
  const collections = [...new Set(specs.map((spec) => spec.collection))];
  const existingIndexes = Object.fromEntries(
    await Promise.all(collections.map(async (collection) => [collection, await listIndexes(collection)]))
  );
  const indexReport = collections.map((collection) => ({
    collection,
    ...classifyIndexes(existingIndexes[collection], specs.filter((spec) => spec.collection === collection))
  }));
  const duplicateCanonicalOwners = await Portfolio.aggregate([
    { $match: { applicantId: { $exists: true, $ne: null } } },
    { $group: { _id: "$applicantId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "owners" }
  ]);
  const orphanPortfolioItems = await PortfolioItem.aggregate([
    { $lookup: { from: "portfolios", localField: "portfolioId", foreignField: "_id", as: "portfolio" } },
    { $match: { portfolio: { $eq: [] } } },
    { $count: "items" }
  ]);
  const summary = {
    dryRun: !APPLY,
    migrationId: MIGRATION_ID,
    existingLedgerEntry: Boolean(await ledger.findOne({ migrationId: MIGRATION_ID })),
    duplicateCanonicalOwners: duplicateCanonicalOwners[0]?.owners || 0,
    orphanPortfolioItems: orphanPortfolioItems[0]?.items || 0,
    missingIndexes: indexReport.reduce((total, report) => total + report.missing.length, 0),
    incompatibleIndexes: indexReport.reduce((total, report) => total + report.incompatible.length, 0),
    indexes: indexReport.map((report) => ({
      collection: report.collection,
      missing: report.missing.map((index) => index.name),
      incompatible: report.incompatible.map((item) => item.expected.name)
    }))
  };
  console.log("Database bootstrap preflight", summary);

  if (!APPLY) return;
  if (!BACKUP_REFERENCE) throw new Error("MIGRATION_BACKUP_REFERENCE is required before bootstrap apply.");
  if (summary.duplicateCanonicalOwners || summary.orphanPortfolioItems || summary.incompatibleIndexes) {
    throw new Error("Refusing bootstrap apply until duplicate, orphan, and incompatible-index findings are resolved.");
  }

  await ledger.createIndex({ migrationId: 1 }, { unique: true });
  for (const report of indexReport) {
    for (const index of report.missing) {
      await mongoose.connection.db.collection(report.collection).createIndex(index.key, {
        ...index.options,
        name: index.name
      });
    }
  }
  await ledger.updateOne(
    { migrationId: MIGRATION_ID },
    { $setOnInsert: { migrationId: MIGRATION_ID, backupReference: BACKUP_REFERENCE, appliedAt: new Date() } },
    { upsert: true }
  );
  console.log("Database bootstrap applied", { migrationId: MIGRATION_ID, backupReference: BACKUP_REFERENCE });
};

run()
  .catch((error) => {
    console.error("Database bootstrap failed", { message: error instanceof Error ? error.message : String(error) });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
