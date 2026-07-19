import mongoose from "mongoose";

import ApiError from "../../utils/apiError";
import {
  PORTFOLIO_ASSET_USAGES,
  PORTFOLIO_MOMENT_STATUSES
} from "../../constants/enums";
import PortfolioAsset from "./portfolioAsset.model";
import {
  createPortfolioAsset,
  safeDeleteAssetRecord,
  safeDeleteCloudinaryResource,
  serializeAsset
} from "./portfolioAsset.service";
import PortfolioExperience from "./portfolioExperience.model";
import PortfolioMoment from "./portfolioMoment.model";

const toId = (value) => value?.toString();

const serializeMoment = (moment, assets: unknown[] = [], includePrivateFields = true) => {
  if (!moment) {
    return null;
  }

  const payload = {
    id: toId(moment._id),
    portfolioId: toId(moment.portfolioId) || null,
    experienceId: toId(moment.experienceId) || null,
    caption: moment.caption || "",
    capturedAt: moment.capturedAt,
    location: moment.location || "",
    skills: moment.skills || [],
    mediaAssetIds: (moment.mediaAssetIds || []).map(toId),
    mediaAssets: assets.map((asset) =>
      serializeAsset(asset, { public: !includePrivateFields })
    ),
    imageUrl: assets[0]?.secureUrl || "",
    status: moment.status,
    visibility: moment.visibility,
    createdAt: moment.createdAt,
    updatedAt: moment.updatedAt
  };

  if (includePrivateFields) {
    payload["applicantId"] = toId(moment.applicantId);
  } else {
    delete payload.status;
    delete payload.visibility;
    delete payload.mediaAssetIds;
    delete payload.portfolioId;
  }

  return payload;
};

const normalizePayload = (payload) => {
  const normalized = { ...payload };
  if (typeof normalized.skills === "string") {
    try {
      normalized.skills = JSON.parse(normalized.skills);
    } catch (error) {
      normalized.skills = normalized.skills.split(",").map((value) => value.trim()).filter(Boolean);
    }
  }

  return normalized;
};

const getOwnedMoment = async (applicantId, momentId) => {
  const moment = await PortfolioMoment.findOne({ _id: momentId, applicantId });

  if (!moment) {
    throw new ApiError(404, "Moment not found");
  }

  return moment;
};

const getAssets = async (assetIds, applicantId?: string) => {
  const filter: Record<string, unknown> = { _id: { $in: assetIds } };

  if (applicantId) {
    filter.applicantId = applicantId;
  }

  const assets = await PortfolioAsset.find(filter);
  const assetsById = new Map(assets.map((asset) => [asset._id.toString(), asset]));
  return assetIds.map((assetId) => assetsById.get(toId(assetId))).filter(Boolean);
};

const assertExperienceOwnership = async (applicantId, experienceId) => {
  if (!experienceId) {
    return;
  }

  const experience = await PortfolioExperience.findOne({ _id: experienceId, applicantId });
  if (!experience) {
    throw new ApiError(400, "Experience is not owned by the applicant");
  }
};

const createMoment = async ({ applicantId, files, payload }) => {
  if (!files?.length) {
    throw new ApiError(400, "At least one media file is required", [
      { field: "media", message: "At least one media file is required" }
    ]);
  }

  await assertExperienceOwnership(applicantId, payload.experienceId);
  const momentId = new mongoose.Types.ObjectId();
  const assets = [];

  try {
    for (const file of files) {
      assets.push(
        await createPortfolioAsset({
          applicantId: toId(applicantId),
          file,
          usage: PORTFOLIO_ASSET_USAGES.MOMENT_MEDIA,
          resourceId: toId(momentId)
        })
      );
    }

    const moment = await PortfolioMoment.create({
      _id: momentId,
      ...normalizePayload(payload),
      applicantId,
      mediaAssetIds: assets.map((asset) => asset._id),
      status: payload.status || PORTFOLIO_MOMENT_STATUSES.DRAFT,
      visibility: payload.visibility || "private"
    });

    return serializeMoment(moment, assets);
  } catch (error) {
    await Promise.all(
      assets.map(async (asset) => {
        const deleted = await safeDeleteCloudinaryResource(
          asset,
          "create-moment-rollback"
        );
        if (deleted) {
          await safeDeleteAssetRecord(asset._id, "create-moment-rollback");
        }
      })
    );
    throw error;
  }
};

const listMoments = async (applicantId, query: Record<string, unknown> = {}) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = { applicantId };

  if (query.experienceId) {
    filter.experienceId = query.experienceId;
  }
  if (query.status) {
    filter.status = query.status;
  }
  if (query.visibility) {
    filter.visibility = query.visibility;
  }

  const [moments, total] = await Promise.all([
    PortfolioMoment.find(filter).sort({ capturedAt: -1 }).skip((page - 1) * limit).limit(limit),
    PortfolioMoment.countDocuments(filter)
  ]);

  const assetIds = moments.flatMap((moment) => moment.mediaAssetIds || []);
  const assets = await getAssets(assetIds, applicantId);
  const assetsById = new Map(assets.map((asset) => [asset._id.toString(), asset]));

  return {
    items: moments.map((moment) =>
      serializeMoment(
        moment,
        (moment.mediaAssetIds || []).map((assetId) => assetsById.get(toId(assetId))).filter(Boolean)
      )
    ),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
  };
};

const getMoment = async (applicantId, momentId) => {
  const moment = await getOwnedMoment(applicantId, momentId);
  return serializeMoment(moment, await getAssets(moment.mediaAssetIds || [], applicantId));
};

const updateMoment = async (applicantId, momentId, payload) => {
  const moment = await getOwnedMoment(applicantId, momentId);
  if (payload.experienceId !== undefined) {
    await assertExperienceOwnership(applicantId, payload.experienceId);
  }
  Object.assign(moment, normalizePayload(payload));
  await moment.save();

  return serializeMoment(moment, await getAssets(moment.mediaAssetIds || [], applicantId));
};

const deleteMoment = async (applicantId, momentId) => {
  const moment = await getOwnedMoment(applicantId, momentId);
  const assets = await getAssets(moment.mediaAssetIds || [], applicantId);

  for (const asset of assets) {
    const deleted = await safeDeleteCloudinaryResource(asset, "delete-moment");
    if (!deleted) {
      throw new ApiError(502, "Portfolio asset cleanup failed");
    }
  }
  await PortfolioMoment.deleteOne({ _id: moment._id });
  await PortfolioAsset.deleteMany({ _id: { $in: assets.map((asset) => asset._id) } });
};

const assignMomentToExperience = async (applicantId, momentId, experienceId) => {
  const moment = await getOwnedMoment(applicantId, momentId);
  await assertExperienceOwnership(applicantId, experienceId);
  moment.experienceId = experienceId;
  await moment.save();
  return serializeMoment(moment, await getAssets(moment.mediaAssetIds || [], applicantId));
};

const unassignMomentFromExperience = async (applicantId, momentId) => {
  const moment = await getOwnedMoment(applicantId, momentId);
  moment.experienceId = null;
  await moment.save();
  return serializeMoment(moment, await getAssets(moment.mediaAssetIds || [], applicantId));
};

export {
  assignMomentToExperience,
  createMoment,
  deleteMoment,
  getMoment,
  listMoments,
  serializeMoment,
  unassignMomentFromExperience,
  updateMoment
};
