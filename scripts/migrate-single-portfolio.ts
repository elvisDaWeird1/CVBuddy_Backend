import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import connectDB from "../src/config/db";
import Portfolio from "../src/modules/portfolios/portfolio.model";

interface DuplicateOwner {
  _id: mongoose.Types.ObjectId;
  count: number;
}

const findDuplicateOwners = async () => Portfolio.aggregate<DuplicateOwner>([
  { $match: { applicantId: { $exists: true, $ne: null } } },
  { $group: { _id: "$applicantId", count: { $sum: 1 } } },
  { $match: { count: { $gt: 1 } } },
  { $sort: { count: -1 } }
]);

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
  if (applicantIndex?.name) {
    await Portfolio.collection.dropIndex(applicantIndex.name);
  }
  await Portfolio.collection.createIndex(
    { applicantId: 1 },
    { name: "applicantId_1", unique: true }
  );
  return true;
};

const run = async () => {
  await connectDB();
  const createdIndex = await ensureUniqueApplicantIndex();
  console.log("Single Portfolio migration completed", {
    createdUniqueApplicantIndex: createdIndex,
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
