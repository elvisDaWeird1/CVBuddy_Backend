import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import connectDB from "../src/config/db";
import Portfolio from "../src/modules/portfolios/portfolio.model";
import PortfolioItem from "../src/modules/portfolios/portfolioItem.model";

const count = async (filter) => Portfolio.collection.countDocuments(filter);

const findDuplicateOwners = async (field: "applicantId" | "applicantProfileId") =>
  Portfolio.collection.aggregate([
    { $match: { [field]: { $exists: true, $ne: null } } },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "owners" }
  ]).toArray();

const run = async () => {
  await connectDB();

  const [
    canonicalOnly,
    legacyOnly,
    canonicalWithProfileLink,
    unknownShape,
    canonicalDuplicateOwners,
    legacyDuplicateOwners,
    portfolioItems,
    orphanPortfolioItems
  ] = await Promise.all([
    count({ applicantId: { $exists: true, $ne: null }, applicantProfileId: { $exists: false } }),
    count({ applicantProfileId: { $exists: true, $ne: null }, applicantId: { $exists: false } }),
    count({ applicantId: { $exists: true, $ne: null }, applicantProfileId: { $exists: true, $ne: null } }),
    count({ applicantId: { $exists: false }, applicantProfileId: { $exists: false } }),
    findDuplicateOwners("applicantId"),
    findDuplicateOwners("applicantProfileId"),
    PortfolioItem.countDocuments({}),
    PortfolioItem.aggregate([
      {
        $lookup: {
          from: "portfolios",
          localField: "portfolioId",
          foreignField: "_id",
          as: "portfolio"
        }
      },
      { $match: { portfolio: { $eq: [] } } },
      { $count: "items" }
    ])
  ]);

  console.log("Legacy Portfolio preflight", {
    writesPerformed: false,
    portfolios: {
      total: canonicalOnly + legacyOnly + canonicalWithProfileLink + unknownShape,
      canonicalOnly,
      legacyOnly,
      canonicalWithProfileLink,
      unknownShape,
      canonicalDuplicateOwners: canonicalDuplicateOwners[0]?.owners || 0,
      legacyDuplicateOwners: legacyDuplicateOwners[0]?.owners || 0
    },
    portfolioItems: {
      total: portfolioItems,
      orphan: orphanPortfolioItems[0]?.items || 0
    }
  });
};

run()
  .catch((error) => {
    console.error("Legacy Portfolio preflight failed", {
      message: error instanceof Error ? error.message : String(error)
    });
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
