import mongoose from "mongoose";

import {
  PORTFOLIO_ASSET_USAGES,
  PORTFOLIO_EXPERIENCE_STATUSES,
  PORTFOLIO_EXPERIENCE_VISIBILITIES,
  PORTFOLIO_MOMENT_STATUSES,
  VISIBILITIES
} from "../../constants/enums";
import ApiError from "../../utils/apiError";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import { deleteCloudinaryResource as deleteLegacyCloudinaryResource } from "../uploads/upload.service";
import Portfolio from "./portfolio.model";
import PortfolioAsset from "./portfolioAsset.model";
import {
  createPortfolioAsset,
  safeDeleteAssetRecord,
  safeDeleteCloudinaryResource,
  serializeAsset
} from "./portfolioAsset.service";
import PortfolioEvidence from "./portfolioEvidence.model";
import PortfolioExperience from "./portfolioExperience.model";
import { serializeExperience } from "./portfolioExperience.service";
import PortfolioItem from "./portfolioItem.model";
import PortfolioMoment from "./portfolioMoment.model";
import { serializeMoment } from "./portfolioMoment.service";

const toId = (value) => value?.toString();

const slugPart = (value: string) => {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || "portfolio";
};

const buildSlug = (title: string, id = new mongoose.Types.ObjectId()) =>
  slugPart(title) + "-" + id.toString().slice(-6);

const buildPublicUrl = (slug: string) => {
  const configured = process.env.PUBLIC_PORTFOLIO_BASE_URL?.trim().replace(/\/+$/, "");
  return configured ? configured + "/" + slug : "/portfolio/" + slug;
};

const serializePortfolio = (
  portfolio,
  counts: { momentCount?: number; experienceCount?: number } = {},
  includePrivate = true
) => {
  if (!portfolio) return null;

  const visibility = portfolio.visibility ||
    (portfolio.isPublic ? VISIBILITIES.PUBLIC : VISIBILITIES.PRIVATE);
  const payload = {
    id: toId(portfolio._id),
    title: portfolio.title || "My Portfolio",
    description: portfolio.description || portfolio.about || "",
    coverImageUrl: portfolio.coverImageUrl || "",
    visibility,
    slug: portfolio.slug,
    publicUrl: buildPublicUrl(portfolio.slug),
    publishedAt: portfolio.publishedAt || null,
    momentCount: counts.momentCount || 0,
    experienceCount: counts.experienceCount || 0,
    updatedAt: portfolio.updatedAt,
    createdAt: portfolio.createdAt
  };

  if (includePrivate) {
    payload["applicantId"] = toId(portfolio.applicantId);
  }

  return payload;
};

const getOwnedPortfolio = async (applicantId, portfolioId: string) => {
  const portfolio = await Portfolio.findById(portfolioId);
  if (!portfolio) {
    throw new ApiError(404, "Portfolio not found", [], "PORTFOLIO_NOT_FOUND");
  }
  if (toId(portfolio.applicantId) !== toId(applicantId)) {
    throw new ApiError(403, "You do not have permission to access this portfolio", [], "PORTFOLIO_FORBIDDEN");
  }
  return portfolio;
};

const backfillDefaultChildren = async (applicantId, portfolioId) => {
  await Promise.all([
    PortfolioExperience.updateMany(
      { applicantId, portfolioId: { $exists: false } },
      { $set: { portfolioId } }
    ),
    PortfolioMoment.updateMany(
      { applicantId, portfolioId: { $exists: false } },
      { $set: { portfolioId } }
    ),
    PortfolioAsset.updateMany(
      { applicantId, portfolioId: { $exists: false } },
      { $set: { portfolioId } }
    )
  ]);
};

const ensureDefaultPortfolio = async (applicantId) => {
  let portfolio = await Portfolio.findOne({ applicantId }).sort({ createdAt: 1 });

  if (!portfolio) {
    const profile = await ApplicantProfile.findOne({ accountId: applicantId });
    if (!profile) {
      throw new ApiError(404, "Applicant profile not found", [], "APPLICANT_PROFILE_NOT_FOUND");
    }

    portfolio = await Portfolio.findOne({ applicantProfileId: profile._id });
    if (portfolio) {
      portfolio.applicantId = applicantId;
      portfolio.title = portfolio.title || "My Portfolio";
      portfolio.description = portfolio.description || portfolio["introduction"] || "";
      portfolio.visibility = portfolio.visibility ||
        (portfolio.isPublic ? VISIBILITIES.PUBLIC : VISIBILITIES.PRIVATE);
      portfolio.slug = portfolio.slug || buildSlug(portfolio.title, portfolio._id);
      portfolio.isPublic = portfolio.visibility === VISIBILITIES.PUBLIC;
      await portfolio.save();
    } else {
      const id = new mongoose.Types.ObjectId();
      portfolio = await Portfolio.create({
        _id: id,
        applicantId,
        applicantProfileId: profile._id,
        title: "My Portfolio",
        slug: buildSlug("My Portfolio", id),
        visibility: VISIBILITIES.PRIVATE,
        isPublic: false
      });
    }
  }

  await backfillDefaultChildren(applicantId, portfolio._id);
  return portfolio;
};

const createPortfolio = async (applicantId, payload) => {
  await ensureDefaultPortfolio(applicantId);
  const id = new mongoose.Types.ObjectId();
  try {
    const portfolio = await Portfolio.create({
      _id: id,
      applicantId,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      slug: buildSlug(payload.title, id),
      visibility: VISIBILITIES.PRIVATE,
      isPublic: false
    });
    return serializePortfolio(portfolio);
  } catch (error) {
    if (error.code === 11000 && error.keyPattern?.applicantId) {
      throw new ApiError(
        409,
        "Multiple Portfolio database migration is required",
        [],
        "MULTI_PORTFOLIO_MIGRATION_REQUIRED"
      );
    }
    throw error;
  }
};

const countPortfolioChildren = async (portfolioId) => {
  const [momentCount, experienceCount] = await Promise.all([
    PortfolioMoment.countDocuments({ portfolioId }),
    PortfolioExperience.countDocuments({ portfolioId })
  ]);
  return { momentCount, experienceCount };
};

const listPortfolios = async (applicantId) => {
  await ensureDefaultPortfolio(applicantId);
  const portfolios = await Portfolio.find({ applicantId }).sort({ updatedAt: -1 });
  const counts = await Promise.all(
    portfolios.map((portfolio) => countPortfolioChildren(portfolio._id))
  );
  return portfolios.map((portfolio, index) =>
    serializePortfolio(portfolio, counts[index])
  );
};

const getPortfolio = async (applicantId, portfolioId: string) => {
  const portfolio = await getOwnedPortfolio(applicantId, portfolioId);
  return serializePortfolio(
    portfolio,
    await countPortfolioChildren(portfolio._id)
  );
};

const updatePortfolio = async (applicantId, portfolioId: string, payload) => {
  const portfolio = await getOwnedPortfolio(applicantId, portfolioId);
  if (payload.title !== undefined) portfolio.title = payload.title.trim();
  if (payload.description !== undefined) {
    portfolio.description = payload.description.trim();
  }
  await portfolio.save();
  return serializePortfolio(
    portfolio,
    await countPortfolioChildren(portfolio._id)
  );
};

const setPortfolioVisibility = async (
  applicantId,
  portfolioId: string,
  visibility: string
) => {
  const portfolio = await getOwnedPortfolio(applicantId, portfolioId);
  portfolio.visibility = visibility as "PRIVATE" | "PUBLIC";
  portfolio.isPublic = visibility === VISIBILITIES.PUBLIC;
  if (portfolio.isPublic && !portfolio.publishedAt) {
    portfolio.publishedAt = new Date();
  }
  await portfolio.save();
  return serializePortfolio(
    portfolio,
    await countPortfolioChildren(portfolio._id)
  );
};

const listPortfolioExperiences = async (applicantId, portfolioId: string) => {
  await getOwnedPortfolio(applicantId, portfolioId);
  const experiences = await PortfolioExperience.find({
    applicantId,
    portfolioId
  }).sort({ createdAt: -1 });
  return experiences.map((experience) => serializeExperience(experience));
};

const createPortfolioExperience = async (
  applicantId,
  portfolioId: string,
  payload
) => {
  await getOwnedPortfolio(applicantId, portfolioId);
  const experience = await PortfolioExperience.create({
    ...payload,
    applicantId,
    portfolioId,
    status: PORTFOLIO_EXPERIENCE_STATUSES.DRAFT,
    visibility: PORTFOLIO_EXPERIENCE_VISIBILITIES.PRIVATE
  });
  return serializeExperience(experience);
};

const listPortfolioMoments = async (applicantId, portfolioId: string) => {
  await getOwnedPortfolio(applicantId, portfolioId);
  const moments = await PortfolioMoment.find({
    applicantId,
    portfolioId
  }).sort({ capturedAt: -1 });
  const assetIds = moments.flatMap((moment) => moment.mediaAssetIds || []);
  const assets = await PortfolioAsset.find({
    applicantId,
    portfolioId,
    _id: { $in: assetIds }
  });
  const byId = new Map(assets.map((asset) => [toId(asset._id), asset]));
  return moments.map((moment) =>
    serializeMoment(
      moment,
      moment.mediaAssetIds.map((assetId) => byId.get(toId(assetId))).filter(Boolean)
    )
  );
};

const createPortfolioMoment = async ({
  applicantId,
  portfolioId,
  file,
  payload
}) => {
  await getOwnedPortfolio(applicantId, portfolioId);
  const momentId = new mongoose.Types.ObjectId();
  let asset;

  try {
    asset = await createPortfolioAsset({
      applicantId: toId(applicantId),
      portfolioId,
      file,
      usage: PORTFOLIO_ASSET_USAGES.MOMENT_MEDIA,
      resourceId: toId(momentId)
    });
    const moment = await PortfolioMoment.create({
      _id: momentId,
      applicantId,
      portfolioId,
      caption: payload.caption?.trim(),
      capturedAt: payload.capturedAt || new Date(),
      mediaAssetIds: [asset._id],
      status: PORTFOLIO_MOMENT_STATUSES.READY,
      visibility: PORTFOLIO_EXPERIENCE_VISIBILITIES.PORTFOLIO
    });
    return serializeMoment(moment, [asset]);
  } catch (error) {
    if (asset) {
      const deleted = await safeDeleteCloudinaryResource(
        asset,
        "portfolio-moment-create-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(asset._id, "portfolio-moment-create-rollback");
      }
    }
    throw error;
  }
};

const deletePortfolio = async (applicantId, portfolioId: string) => {
  const portfolio = await getOwnedPortfolio(applicantId, portfolioId);
  const [experiences, moments, assets, legacyItems] = await Promise.all([
    PortfolioExperience.find({ applicantId, portfolioId }),
    PortfolioMoment.find({ applicantId, portfolioId }),
    PortfolioAsset.find({ applicantId, portfolioId }),
    PortfolioItem.find({ portfolioId })
  ]);
  const experienceIds = experiences.map((item) => item._id);
  const evidenceCount = await PortfolioEvidence.countDocuments({
    applicantId,
    experienceId: { $in: experienceIds }
  });

  await Promise.all([
    PortfolioEvidence.deleteMany({
      applicantId,
      experienceId: { $in: experienceIds }
    }),
    PortfolioExperience.deleteMany({ applicantId, portfolioId }),
    PortfolioMoment.deleteMany({ applicantId, portfolioId }),
    PortfolioItem.deleteMany({ portfolioId })
  ]);
  await Portfolio.deleteOne({ _id: portfolio._id, applicantId });

  let cleanupFailures = 0;
  for (const asset of assets) {
    const deleted = await safeDeleteCloudinaryResource(
      asset,
      "portfolio-delete"
    );
    if (deleted) {
      await safeDeleteAssetRecord(asset._id, "portfolio-delete");
    } else {
      cleanupFailures += 1;
    }
  }
  for (const item of legacyItems) {
    if (item.imagePublicId) {
      await deleteLegacyCloudinaryResource(item.imagePublicId, "image").catch(() => {
        cleanupFailures += 1;
      });
    }
  }

  return {
    deleted: {
      portfolios: 1,
      experiences: experiences.length,
      moments: moments.length,
      evidence: evidenceCount,
      assets: assets.length,
      legacyItems: legacyItems.length
    },
    cleanupFailures
  };
};

export {
  buildPublicUrl,
  createPortfolio,
  createPortfolioExperience,
  createPortfolioMoment,
  deletePortfolio,
  ensureDefaultPortfolio,
  getOwnedPortfolio,
  getPortfolio,
  listPortfolioExperiences,
  listPortfolioMoments,
  listPortfolios,
  serializePortfolio,
  setPortfolioVisibility,
  updatePortfolio
};
