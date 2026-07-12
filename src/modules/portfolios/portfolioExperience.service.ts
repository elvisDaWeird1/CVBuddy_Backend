import ApiError from "../../utils/apiError";
import {
  PORTFOLIO_ASSET_USAGES,
  PORTFOLIO_EXPERIENCE_STATUSES,
  PORTFOLIO_EXPERIENCE_VISIBILITIES
} from "../../constants/enums";
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
import PortfolioMoment from "./portfolioMoment.model";

const toId = (value) => value?.toString();
const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const serializeExperience = (experience, coverAsset = null, includePrivateFields = true) => {
  if (!experience) {
    return null;
  }

  const payload = {
    id: toId(experience._id),
    applicantId: toId(experience.applicantId),
    type: experience.type,
    title: experience.title,
    organization: experience.organization || "",
    role: experience.role || "",
    startDate: experience.startDate || null,
    endDate: experience.endDate || null,
    isCurrent: experience.isCurrent,
    location: experience.location || "",
    description: experience.description || "",
    responsibilities: experience.responsibilities || [],
    achievements: experience.achievements || [],
    skills: experience.skills || [],
    coverAssetId: toId(experience.coverAssetId) || null,
    coverAsset: serializeAsset(coverAsset, { public: !includePrivateFields }),
    status: experience.status,
    visibility: experience.visibility,
    createdAt: experience.createdAt,
    updatedAt: experience.updatedAt
  };

  if (!includePrivateFields) {
    delete payload.applicantId;
    delete payload.coverAssetId;
    delete payload.status;
    delete payload.visibility;
  }

  return payload;
};

const normalizePayload = (payload) => {
  const normalized = { ...payload };
  ["startDate", "endDate"].forEach((field) => {
    if (normalized[field] === "" || normalized[field] === null) {
      normalized[field] = undefined;
    }
  });
  ["responsibilities", "achievements", "skills"].forEach((field) => {
    if (typeof normalized[field] === "string") {
      try {
        normalized[field] = JSON.parse(normalized[field]);
      } catch (error) {
        normalized[field] = normalized[field].split(",").map((value) => value.trim()).filter(Boolean);
      }
    }
  });

  return normalized;
};

const getOwnedExperience = async (applicantId, experienceId) => {
  const experience = await PortfolioExperience.findOne({ _id: experienceId, applicantId });

  if (!experience) {
    throw new ApiError(404, "Experience not found");
  }

  return experience;
};

const getCoverAsset = async (experience) => {
  if (!experience?.coverAssetId) {
    return null;
  }

  return PortfolioAsset.findOne({ _id: experience.coverAssetId, applicantId: experience.applicantId });
};

const createExperience = async (applicantId, payload) => {
  const experience = await PortfolioExperience.create({
    ...normalizePayload(payload),
    applicantId,
    status: payload.status || PORTFOLIO_EXPERIENCE_STATUSES.DRAFT,
    visibility: payload.visibility || PORTFOLIO_EXPERIENCE_VISIBILITIES.PRIVATE
  });

  return serializeExperience(experience);
};

const listExperiences = async (applicantId, query) => {
  const page = Number(query.page || 1);
  const limit = Number(query.limit || 20);
  const filter: Record<string, unknown> = { applicantId };

  if (query.status) {
    filter.status = query.status;
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.search) {
    const expression = new RegExp(escapeRegex(query.search), "i");
    filter.$or = [
      { title: expression },
      { organization: expression },
      { role: expression },
      { description: expression }
    ];
  }

  const [experiences, total] = await Promise.all([
    PortfolioExperience.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    PortfolioExperience.countDocuments(filter)
  ]);

  const coverIds = experiences.map((experience) => experience.coverAssetId).filter(Boolean);
  const coverAssets = await PortfolioAsset.find({
    _id: { $in: coverIds },
    applicantId
  });
  const coverById = new Map(coverAssets.map((asset) => [asset._id.toString(), asset]));

  return {
    items: experiences.map((experience) =>
      serializeExperience(experience, coverById.get(toId(experience.coverAssetId)))
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
};

const getExperience = async (applicantId, experienceId) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  return serializeExperience(experience, await getCoverAsset(experience));
};

const updateExperience = async (applicantId, experienceId, payload) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  const normalized = normalizePayload(payload);
  const hasStartDate = Object.prototype.hasOwnProperty.call(payload, "startDate");
  const hasEndDate = Object.prototype.hasOwnProperty.call(payload, "endDate");
  const nextStartDate = !hasStartDate
    ? experience.startDate
    : normalized.startDate;
  const nextEndDate = !hasEndDate
    ? experience.endDate
    : normalized.endDate;

  if (normalized.isCurrent === true) {
    normalized.endDate = undefined;
  } else if (nextStartDate && nextEndDate && new Date(nextStartDate) > new Date(nextEndDate)) {
    throw new ApiError(400, "endDate cannot be before startDate", [
      { field: "endDate", message: "endDate cannot be before startDate" }
    ]);
  }

  Object.assign(experience, normalized);
  await experience.save();

  return serializeExperience(experience, await getCoverAsset(experience));
};

const assertPublishable = (experience) => {
  const hasProfessionalContent = [
    experience.organization,
    experience.role,
    experience.description,
    ...(experience.responsibilities || []),
    ...(experience.achievements || []),
    ...(experience.skills || [])
  ].some((value) => typeof value === "string" && value.trim().length > 0);

  if (!experience.title || !experience.type || !hasProfessionalContent) {
    throw new ApiError(400, "Experience is missing publishable professional content", [
      { field: "experience", message: "Title, type and at least one professional content field are required before publishing" }
    ]);
  }
};

const publishExperience = async (applicantId, experienceId) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  assertPublishable(experience);
  experience.status = PORTFOLIO_EXPERIENCE_STATUSES.PUBLISHED;
  experience.visibility = PORTFOLIO_EXPERIENCE_VISIBILITIES.PORTFOLIO;
  await experience.save();

  return serializeExperience(experience, await getCoverAsset(experience));
};

const archiveExperience = async (applicantId, experienceId) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  experience.status = PORTFOLIO_EXPERIENCE_STATUSES.ARCHIVED;
  await experience.save();

  return serializeExperience(experience, await getCoverAsset(experience));
};

const cleanupAssetIfUnreferenced = async (assetId) => {
  if (!assetId) {
    return;
  }

  const [experienceReference, momentReference, evidenceReference] = await Promise.all([
    PortfolioExperience.exists({ coverAssetId: assetId }),
    PortfolioMoment.exists({ mediaAssetIds: assetId }),
    PortfolioEvidence.exists({ assetId })
  ]);

  if (experienceReference || momentReference || evidenceReference) {
    return;
  }

  const asset = await PortfolioAsset.findById(assetId);

  if (!asset) {
    return;
  }

  const deleted = await safeDeleteCloudinaryResource(asset, "experience-asset-cleanup");
  if (deleted) {
    await safeDeleteAssetRecord(asset._id, "experience-asset-cleanup");
  }
};

const deleteExperience = async (applicantId, experienceId) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  const evidence = await PortfolioEvidence.find({ applicantId, experienceId });
  const assetIds = evidence.map((item) => item.assetId).filter(Boolean);
  if (experience.coverAssetId) {
    assetIds.push(experience.coverAssetId);
  }

  await PortfolioMoment.updateMany(
    { applicantId, experienceId: experience._id },
    { $set: { experienceId: null } }
  );
  await PortfolioEvidence.deleteMany({ applicantId, experienceId: experience._id });
  await PortfolioExperience.deleteOne({ _id: experience._id });
  await Portfolio.updateMany(
    { applicantId },
    { $pull: { featuredExperienceIds: experience._id } }
  );

  await Promise.all([...new Set(assetIds.map(toId))].map(cleanupAssetIfUnreferenced));
};

const setExperienceCover = async ({ applicantId, experienceId, assetId, file }) => {
  const experience = await getOwnedExperience(applicantId, experienceId);
  const previousAssetId = experience.coverAssetId;
  let nextAssetId = assetId;
  let createdAsset = null;

  if (file) {
    createdAsset = await createPortfolioAsset({
      applicantId: toId(applicantId),
      file,
      usage: PORTFOLIO_ASSET_USAGES.EXPERIENCE_COVER,
      resourceId: toId(experience._id)
    });
    nextAssetId = createdAsset._id;
  }

  if (!nextAssetId) {
    throw new ApiError(400, "assetId or cover file is required");
  }

  const asset = await PortfolioAsset.findOne({
    _id: nextAssetId,
    applicantId,
    usage: PORTFOLIO_ASSET_USAGES.EXPERIENCE_COVER
  });

  if (!asset) {
    if (createdAsset) {
      const deleted = await safeDeleteCloudinaryResource(
        createdAsset,
        "cover-asset-ownership-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(createdAsset._id, "cover-asset-ownership-rollback");
      }
    }
    throw new ApiError(400, "Cover asset is not owned by the applicant");
  }

  try {
    experience.coverAssetId = asset._id;
    await experience.save();
  } catch (error) {
    if (createdAsset) {
      const deleted = await safeDeleteCloudinaryResource(
        createdAsset,
        "cover-database-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(createdAsset._id, "cover-database-rollback");
      }
    }
    throw error;
  }
  if (previousAssetId && toId(previousAssetId) !== toId(asset._id)) {
    await cleanupAssetIfUnreferenced(previousAssetId);
  }

  return serializeExperience(experience, asset);
};

export {
  archiveExperience,
  createExperience,
  deleteExperience,
  getExperience,
  getOwnedExperience,
  listExperiences,
  publishExperience,
  serializeExperience,
  setExperienceCover,
  updateExperience
};
