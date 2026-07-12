import ApiError from "../../utils/apiError";
import {
  PORTFOLIO_ASSET_TYPES,
  PORTFOLIO_ASSET_USAGES,
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES
} from "../../constants/enums";
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

const serializeEvidence = (evidence, asset = null, includePrivateFields = true) => {
  if (!evidence) {
    return null;
  }

  const payload = {
    id: toId(evidence._id),
    experienceId: toId(evidence.experienceId),
    type: evidence.type,
    title: evidence.title,
    description: evidence.description || "",
    url: evidence.url || null,
    assetId: toId(evidence.assetId) || null,
    asset: serializeAsset(asset, { public: !includePrivateFields }),
    verificationStatus: evidence.verificationStatus,
    createdAt: evidence.createdAt,
    updatedAt: evidence.updatedAt
  };

  if (includePrivateFields) {
    payload["applicantId"] = toId(evidence.applicantId);
  } else {
    delete payload.assetId;
    delete payload.verificationStatus;
  }

  return payload;
};

const getOwnedExperience = async (applicantId, experienceId) => {
  const experience = await PortfolioExperience.findOne({ _id: experienceId, applicantId });
  if (!experience) {
    throw new ApiError(404, "Experience not found");
  }
  return experience;
};

const getOwnedEvidence = async (applicantId, evidenceId) => {
  const evidence = await PortfolioEvidence.findOne({ _id: evidenceId, applicantId });
  if (!evidence) {
    throw new ApiError(404, "Evidence not found");
  }
  return evidence;
};

const getAsset = async (assetId, applicantId) => {
  if (!assetId) {
    return null;
  }
  return PortfolioAsset.findOne({ _id: assetId, applicantId });
};

const assertHasSource = (payload, file) => {
  if (!payload.url && !file) {
    throw new ApiError(400, "Evidence must contain an external URL or an uploaded file", [
      { field: "url", message: "url or file is required" }
    ]);
  }
};

const assertClientVerificationStatus = (verificationStatus) => {
  if (verificationStatus === PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.VERIFIED) {
    throw new ApiError(400, "Evidence cannot be marked verified by the client", [
      {
        field: "verificationStatus",
        message: "Only unverified or document-provided is accepted"
      }
    ]);
  }
};

const createEvidence = async ({ applicantId, experienceId, payload, file }) => {
  await getOwnedExperience(applicantId, experienceId);
  assertHasSource(payload, file);
  assertClientVerificationStatus(payload.verificationStatus);
  let asset = null;

  try {
    if (file) {
      asset = await createPortfolioAsset({
        applicantId: toId(applicantId),
        file,
        usage: PORTFOLIO_ASSET_USAGES.EXPERIENCE_EVIDENCE,
        resourceId: toId(experienceId),
        assetType:
          payload.type === "certificate" ? PORTFOLIO_ASSET_TYPES.CERTIFICATE : undefined
      });
    }

    const evidence = await PortfolioEvidence.create({
      applicantId,
      experienceId,
      type: payload.type,
      title: payload.title.trim(),
      description: payload.description?.trim(),
      url: payload.url?.trim(),
      assetId: asset?._id,
      verificationStatus:
        payload.verificationStatus ||
        (asset
          ? PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.DOCUMENT_PROVIDED
          : PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.UNVERIFIED)
    });

    return serializeEvidence(evidence, asset);
  } catch (error) {
    if (asset) {
      const deleted = await safeDeleteCloudinaryResource(
        asset,
        "create-evidence-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(asset._id, "create-evidence-rollback");
      }
    }
    throw error;
  }
};

const listEvidence = async (applicantId, experienceId) => {
  await getOwnedExperience(applicantId, experienceId);
  const evidence = await PortfolioEvidence.find({ applicantId, experienceId }).sort({ createdAt: -1 });
  const assets = await PortfolioAsset.find({
    _id: { $in: evidence.map((item) => item.assetId).filter(Boolean) },
    applicantId
  });
  const assetsById = new Map(assets.map((asset) => [asset._id.toString(), asset]));

  return evidence.map((item) => serializeEvidence(item, assetsById.get(toId(item.assetId))));
};

const cleanupUnreferencedAsset = async (assetId) => {
  if (!assetId) {
    return;
  }

  const [cover, media, evidence] = await Promise.all([
    PortfolioExperience.exists({ coverAssetId: assetId }),
    PortfolioMoment.exists({ mediaAssetIds: assetId }),
    PortfolioEvidence.exists({ assetId })
  ]);

  if (cover || media || evidence) {
    return;
  }

  const asset = await PortfolioAsset.findById(assetId);
  if (!asset) {
    return;
  }

  const deleted = await safeDeleteCloudinaryResource(asset, "delete-evidence");
  if (deleted) {
    await safeDeleteAssetRecord(asset._id, "delete-evidence");
  }
};

const updateEvidence = async ({ applicantId, evidenceId, payload, file }) => {
  const evidence = await getOwnedEvidence(applicantId, evidenceId);
  assertClientVerificationStatus(payload.verificationStatus);
  const previousAssetId = evidence.assetId;
  let nextAsset = null;

  if (file) {
    nextAsset = await createPortfolioAsset({
      applicantId: toId(applicantId),
      file,
      usage: PORTFOLIO_ASSET_USAGES.EXPERIENCE_EVIDENCE,
      resourceId: toId(evidence.experienceId),
      assetType:
        payload.type === "certificate" ? PORTFOLIO_ASSET_TYPES.CERTIFICATE : undefined
    });
  }

  Object.assign(evidence, {
    ...payload,
    title: payload.title?.trim() || evidence.title,
    description: payload.description === undefined ? evidence.description : payload.description?.trim(),
    url: payload.url === null ? undefined : payload.url === undefined ? evidence.url : payload.url.trim(),
    assetId: nextAsset?._id || evidence.assetId
  });

  if (!evidence.url && !evidence.assetId) {
    if (nextAsset) {
      const deleted = await safeDeleteCloudinaryResource(
        nextAsset,
        "update-evidence-validation-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(nextAsset._id, "update-evidence-validation-rollback");
      }
    }
    throw new ApiError(400, "Evidence must contain an external URL or an uploaded file");
  }

  if (nextAsset && payload.verificationStatus === undefined) {
    evidence.verificationStatus = PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.DOCUMENT_PROVIDED;
  }

  try {
    await evidence.save();
  } catch (error) {
    if (nextAsset) {
      const deleted = await safeDeleteCloudinaryResource(
        nextAsset,
        "update-evidence-database-rollback"
      );
      if (deleted) {
        await safeDeleteAssetRecord(nextAsset._id, "update-evidence-database-rollback");
      }
    }
    throw error;
  }
  if (previousAssetId && nextAsset && toId(previousAssetId) !== toId(nextAsset._id)) {
    await cleanupUnreferencedAsset(previousAssetId);
  }

  return serializeEvidence(evidence, await getAsset(evidence.assetId, applicantId));
};

const deleteEvidence = async (applicantId, evidenceId) => {
  const evidence = await getOwnedEvidence(applicantId, evidenceId);
  const assetId = evidence.assetId;
  await PortfolioEvidence.deleteOne({ _id: evidence._id });
  await cleanupUnreferencedAsset(assetId);
};

export {
  createEvidence,
  deleteEvidence,
  listEvidence,
  serializeEvidence,
  updateEvidence
};
