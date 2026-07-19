import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import connectDB from "../src/config/db";
import ApplicantProfile from "../src/modules/applicantProfiles/applicantProfile.model";
import Portfolio from "../src/modules/portfolios/portfolio.model";
import { ensureDefaultPortfolio } from "../src/modules/portfolios/portfolioCollection.service";

const dropLegacyUniqueApplicantIndex = async () => {
  const indexes = await Portfolio.collection.indexes();
  const legacy = indexes.find((index) =>
    index.unique === true &&
    Object.keys(index.key).length === 1 &&
    index.key.applicantId === 1
  );

  if (!legacy) return false;
  await Portfolio.collection.dropIndex(legacy.name);
  return true;
};

const run = async () => {
  await connectDB();
  const droppedIndex = await dropLegacyUniqueApplicantIndex();
  const profiles = await ApplicantProfile.find({}).select({
    _id: 1,
    accountId: 1
  });

  let migratedApplicants = 0;
  for (const profile of profiles) {
    await ensureDefaultPortfolio(profile.accountId);
    migratedApplicants += 1;
  }

  console.log("Multiple Portfolio migration completed", {
    droppedLegacyUniqueApplicantIndex: droppedIndex,
    migratedApplicants
  });
};

run()
  .catch((error) => {
    console.error("Multiple Portfolio migration failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
