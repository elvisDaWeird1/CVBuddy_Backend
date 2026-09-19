import ApiError from "../../utils/apiError";
import { Types } from "mongoose";
import Portfolio from "./portfolio.model";
import PortfolioExperience from "./portfolioExperience.model";
import {
  ensureDefaultPortfolio,
  findDefaultPortfolio
} from "./portfolioCollection.service";

const toId = (value) => value?.toString();

const serializePortfolio = (portfolio, includePrivateFields = true) => {
  if (!portfolio) {
    return null;
  }

  const payload = {
    id: toId(portfolio._id),
    headline: portfolio.headline || "",
    about: portfolio.about || "",
    desiredRole: portfolio.desiredRole || "",
    slug: portfolio.slug,
    isPublic: portfolio.isPublic,
    skills: portfolio.skills || [],
    socialLinks: portfolio.socialLinks || {},
    featuredExperienceIds: (portfolio.featuredExperienceIds || []).map(toId),
    createdAt: portfolio.createdAt,
    updatedAt: portfolio.updatedAt
  };

  if (includePrivateFields) {
    payload["applicantId"] = toId(portfolio.applicantId);
  } else {
    delete payload.isPublic;
    delete payload.featuredExperienceIds;
  }

  return payload;
};

const getMyPortfolioDocument = async (applicantId) => {
  const portfolio = await findDefaultPortfolio(applicantId);
  if (!portfolio) {
    throw new ApiError(404, "Portfolio not found", [], "PORTFOLIO_NOT_FOUND");
  }
  return portfolio;
};

const getMyPortfolio = async (applicantId) => {
  return serializePortfolio(await findDefaultPortfolio(applicantId));
};

const updateMyPortfolio = async (applicantId, payload) => {
  const existing = await ensureDefaultPortfolio(applicantId);
  const slug = payload.slug?.trim().toLowerCase() || existing?.slug;

  if (!slug) {
    throw new ApiError(400, "slug is required when creating a portfolio", [
      { field: "slug", message: "slug is required" }
    ]);
  }

  const updates = {
    ...payload,
    applicantId,
    slug,
    skills: payload.skills || existing?.skills || [],
    socialLinks: payload.socialLinks || existing?.socialLinks || {}
  };

  try {
    const portfolio = await Portfolio.findOneAndUpdate(
      { _id: existing._id, applicantId },
      { $set: updates },
      { new: true, runValidators: true }
    );

    return serializePortfolio(portfolio);
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, "Portfolio slug already exists", [
        { field: "slug", message: "slug already exists" }
      ]);
    }

    throw error;
  }
};

const setPortfolioPublic = async (applicantId, isPublic: boolean) => {
  const existing = await getMyPortfolioDocument(applicantId);
  const portfolio = await Portfolio.findOneAndUpdate(
    { _id: existing._id, applicantId },
    { $set: {
      isPublic,
      visibility: isPublic ? "PUBLIC" : "PRIVATE",
      publishedAt: isPublic ? existing.publishedAt || new Date() : existing.publishedAt
    } },
    { new: true, runValidators: true }
  );

  if (!portfolio) {
    throw new ApiError(404, "Portfolio not found");
  }

  return serializePortfolio(portfolio);
};

const setFeaturedExperiences = async (applicantId, featuredExperienceIds: string[]) => {
  const portfolio = await getMyPortfolioDocument(applicantId);
  const experiences = await PortfolioExperience.find({
    applicantId,
    portfolioId: portfolio._id,
    _id: { $in: featuredExperienceIds }
  }).select({ _id: 1 });

  if (experiences.length !== featuredExperienceIds.length) {
    throw new ApiError(400, "All featured experiences must belong to the applicant", [
      { field: "featuredExperienceIds", message: "One or more experience ids are not owned by the applicant" }
    ]);
  }

  portfolio.featuredExperienceIds = featuredExperienceIds.map((id) => new Types.ObjectId(id));
  await portfolio.save();

  return serializePortfolio(portfolio);
};

export {
  getMyPortfolio,
  getMyPortfolioDocument,
  serializePortfolio,
  setFeaturedExperiences,
  setPortfolioPublic,
  updateMyPortfolio
};
