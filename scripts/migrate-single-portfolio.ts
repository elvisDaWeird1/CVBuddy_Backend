import dotenv from "dotenv";
import mongoose, { Model } from "mongoose";

dotenv.config();

import connectDB from "../src/config/db";
import Portfolio from "../src/modules/portfolios/portfolio.model";
import PortfolioAsset from "../src/modules/portfolios/portfolioAsset.model";
import PortfolioEvidence from "../src/modules/portfolios/portfolioEvidence.model";
import PortfolioExperience from "../src/modules/portfolios/portfolioExperience.model";
import PortfolioMoment from "../src/modules/portfolios/portfolioMoment.model";

interface DuplicateOwner {
  _id: mongoose.Types.ObjectId;
  count: number;
}

type ChildModel = Model<unknown>;

const APPLY = process.argv.includes("--apply") || process.env.MIGRATION_APPLY === "true";
const childModels: Array<{ name: string; model: ChildModel }> = [
  { name: "experiences", model: PortfolioExperience },
  { name: "moments", model: PortfolioMoment },
  { name: "assets", model: PortfolioAsset },
  { name: "evidence", model: PortfolioEvidence }
];

const findDuplicateOwners = async () => Portfolio.aggregate<DuplicateOwner>([
  { $match: { applicantId: { $exists: true, $ne: null } } },
  { $group: { _id: "$applicantId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
]);

const getCanonicalPortfolioIds = async () => {
  const portfolios = await Portfolio.find({ applicantId: { $exists: true, $ne: null } })
    .select({ _id: 1, applicantId: 1 })
    .lean();
  const byApplicant = new Map<string, string[]>();

  for (const portfolio of portfolios) {
    const applicantId = portfolio.applicantId.toString();
    const ids = byApplicant.get(applicantId) || [];
    ids.push(portfolio._id.toString());
    byApplicant.set(applicantId, ids);
  }

  return byApplicant;
};

const summarizeChildren = async (model: ChildModel, canonicalIds: Map<string, string[]>) => {
  const summary = { alreadyLinked: 0, needsBackfill: 0, orphan: 0, conflict: 0 };
  const cursor = model.find({}).select({ _id: 1, applicantId: 1, portfolioId: 1 }).lean().cursor();

  for await (const child of cursor) {
    const applicantId = child.applicantId?.toString();
    const portfolioIds = applicantId ? canonicalIds.get(applicantId) || [] : [];
    const portfolioId = child.portfolioId?.toString();

    if (portfolioIds.length === 0) summary.orphan += 1;
    else if (portfolioIds.length > 1) summary.conflict += 1;
    else if (!portfolioId) summary.needsBackfill += 1;
    else if (portfolioId === portfolioIds[0]) summary.alreadyLinked += 1;
    else summary.conflict += 1;
  }

  return summary;
};

const backfillChildren = async (model: ChildModel, canonicalIds: Map<string, string[]>) => {
  let modified = 0;
  for (const [applicantId, portfolioIds] of canonicalIds) {
    if (portfolioIds.length !== 1) continue;
    const result = await model.updateMany(
      { applicantId, portfolioId: { $in: [null] } },
      { $set: { portfolioId: portfolioIds[0] } }
    );
    modified += result.modifiedCount;
  }
  return modified;
};

const ensureUniqueApplicantIndex = async () => {
  const duplicates = await findDuplicateOwners();
  if (duplicates.length) {
    const owners = duplicates.map((item) => `${item._id.toString()} (${item.count})`).join(", ");
    throw new Error(
      `Cannot enforce one Portfolio per applicant while duplicates exist: ${owners}. ` +
      "Resolve these owners manually so no Portfolio media is discarded, then run the migration again."
    );
  }

  const indexes = await Portfolio.collection.indexes();
  const applicantIndex = indexes.find((index) =>
    Object.keys(index.key).length === 1 && index.key.applicantId === 1
  );

  if (applicantIndex?.unique) return false;
  if (applicantIndex?.name) await Portfolio.collection.dropIndex(applicantIndex.name);
  await Portfolio.collection.createIndex({ applicantId: 1 }, { name: "applicantId_1", unique: true });
  return true;
};

const run = async () => {
  await connectDB();
  const duplicateOwners = await findDuplicateOwners();
  const canonicalIds = await getCanonicalPortfolioIds();
  const childReport = Object.fromEntries(
    await Promise.all(childModels.map(async ({ name, model }) => [name, await summarizeChildren(model, canonicalIds)]))
  );

  console.log("Single Portfolio migration preflight", {
    dryRun: !APPLY,
    duplicateOwners: duplicateOwners.length,
    childReport
  });

  if (!APPLY) return;
  if (duplicateOwners.length) {
    throw new Error("Refusing to apply Portfolio child backfill while duplicate Portfolio owners exist.");
  }

  const modifiedChildren = Object.fromEntries(
    await Promise.all(childModels.map(async ({ name, model }) => [name, await backfillChildren(model, canonicalIds)]))
  );
  const createdUniqueApplicantIndex = await ensureUniqueApplicantIndex();
  console.log("Single Portfolio migration applied", {
    modifiedChildren,
    createdUniqueApplicantIndex,
    portfolioCount: await Portfolio.countDocuments({})
  });
};

run()
  .catch((error) => {
    console.error("Single Portfolio migration failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
