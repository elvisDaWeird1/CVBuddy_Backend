import { Model } from "mongoose";

import Account from "../modules/accounts/account.model";
import AIResult from "../modules/ai/aiResult.model";
import ApplicantProfile from "../modules/applicantProfiles/applicantProfile.model";
import CompanyProfile from "../modules/companyProfiles/companyProfile.model";
import TokenRevocation from "../modules/auth/tokenRevocation.model";
import CvDocument from "../modules/cvs/cvDocument.model";
import Portfolio from "../modules/portfolios/portfolio.model";
import PortfolioAsset from "../modules/portfolios/portfolioAsset.model";
import PortfolioEvidence from "../modules/portfolios/portfolioEvidence.model";
import PortfolioExperience from "../modules/portfolios/portfolioExperience.model";
import PortfolioItem from "../modules/portfolios/portfolioItem.model";
import LegacyPortfolio from "../modules/portfolios/portfolioLegacy.model";
import PortfolioMoment from "../modules/portfolios/portfolioMoment.model";

type ManagedModel = Model<any>;
type IndexSpec = { name: string; key: Record<string, unknown>; options: Record<string, unknown> };

const managedModels: ManagedModel[] = [
  Account,
  AIResult,
  ApplicantProfile,
  CompanyProfile,
  TokenRevocation,
  CvDocument,
  Portfolio,
  LegacyPortfolio,
  PortfolioExperience,
  PortfolioMoment,
  PortfolioAsset,
  PortfolioEvidence,
  PortfolioItem
];

const indexName = (key: Record<string, unknown>) =>
  Object.entries(key).map(([field, direction]) => `${field}_${direction}`).join("_");

const getManagedIndexSpecs = () => managedModels.flatMap((model) =>
  model.schema.indexes().map(([key, options]) => ({
    collection: model.collection.name,
    name: options.name || indexName(key),
    key,
    options
  }))
);

const indexMatches = (existing, expected: IndexSpec) =>
  JSON.stringify(existing.key) === JSON.stringify(expected.key) &&
  Boolean(existing.unique) === Boolean(expected.options.unique) &&
  Boolean(existing.sparse) === Boolean(expected.options.sparse) &&
  (existing.expireAfterSeconds ?? undefined) === (expected.options.expireAfterSeconds ?? undefined);

const classifyIndexes = (existingIndexes, expectedIndexes: IndexSpec[]) => {
  const missing: IndexSpec[] = [];
  const incompatible: Array<{ expected: IndexSpec; existing: unknown }> = [];

  for (const expected of expectedIndexes) {
    const existing = existingIndexes.find((index) => index.name === expected.name);
    if (!existing) missing.push(expected);
    else if (!indexMatches(existing, expected)) incompatible.push({ expected, existing });
  }

  return { missing, incompatible };
};

export {
  classifyIndexes,
  getManagedIndexSpecs,
  managedModels
};
