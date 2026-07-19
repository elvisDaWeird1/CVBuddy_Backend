import path from "path";

import ApiError from "../../utils/apiError";
import {
  deleteCloudinaryResource,
  uploadBufferToCloudinary
} from "../../config/cloudinary.config";
import {
  PORTFOLIO_ASSET_TYPES,
  PORTFOLIO_ASSET_USAGES,
  PORTFOLIO_CLOUDINARY_RESOURCE_TYPES
} from "../../constants/enums";
import PortfolioAsset from "./portfolioAsset.model";

type PortfolioFile = Express.Multer.File;
type AssetUsage = (typeof PORTFOLIO_ASSET_USAGES)[keyof typeof PORTFOLIO_ASSET_USAGES];
type CloudinaryResourceType = "image" | "video" | "raw";

const logPortfolioCleanupFailure = (context: string, error) => {
  console.error("Portfolio asset cleanup failed", {
    context,
    message: error instanceof Error ? error.message : String(error)
  });
};

const safeDeleteCloudinaryResource = async (
  asset: { cloudinaryPublicId: string; cloudinaryResourceType: string },
  context: string
) => {
  try {
    await deleteCloudinaryResource({
      publicId: asset.cloudinaryPublicId,
      resourceType: asset.cloudinaryResourceType as CloudinaryResourceType
    });
    return true;
  } catch (error) {
    logPortfolioCleanupFailure(context, error);
    return false;
  }
};

const safeDeleteAssetRecord = async (assetId, context: string) => {
  try {
    await PortfolioAsset.deleteOne({ _id: assetId });
  } catch (error) {
    logPortfolioCleanupFailure(context, error);
  }
};

const getPortfolioFolder = (
  usage: AssetUsage,
  applicantId: string,
  resourceId: string,
  portfolioId?: string
) => {
  if (portfolioId && usage === PORTFOLIO_ASSET_USAGES.MOMENT_MEDIA) {
    return "cvbuddy/portfolios/" + portfolioId + "/moments/" + resourceId;
  }

  if (usage === PORTFOLIO_ASSET_USAGES.MOMENT_MEDIA) {
    return `cvbuddy/applicants/${applicantId}/portfolio/moments/${resourceId}`;
  }

  if (usage === PORTFOLIO_ASSET_USAGES.EXPERIENCE_COVER) {
    return `cvbuddy/applicants/${applicantId}/portfolio/experiences/${resourceId}`;
  }

  return `cvbuddy/applicants/${applicantId}/portfolio/evidence/${resourceId}`;
};

const classifyFile = (file: PortfolioFile, usage: AssetUsage) => {
  const mimeType = file.mimetype.toLowerCase();
  const extension = path.extname(file.originalname).toLowerCase();

  if (mimeType.startsWith("image/")) {
    return {
      assetType: PORTFOLIO_ASSET_TYPES.IMAGE,
      resourceType: PORTFOLIO_CLOUDINARY_RESOURCE_TYPES.IMAGE
    };
  }

  if (mimeType.startsWith("video/")) {
    return {
      assetType: PORTFOLIO_ASSET_TYPES.VIDEO,
      resourceType: PORTFOLIO_CLOUDINARY_RESOURCE_TYPES.VIDEO
    };
  }

  if ([".pdf", ".doc", ".docx"].includes(extension)) {
    return {
      assetType: usage === PORTFOLIO_ASSET_USAGES.EXPERIENCE_EVIDENCE
        ? PORTFOLIO_ASSET_TYPES.DOCUMENT
        : PORTFOLIO_ASSET_TYPES.DOCUMENT,
      resourceType: PORTFOLIO_CLOUDINARY_RESOURCE_TYPES.RAW
    };
  }

  return {
    assetType: PORTFOLIO_ASSET_TYPES.OTHER,
    resourceType: PORTFOLIO_CLOUDINARY_RESOURCE_TYPES.RAW
  };
};

const assertFileSignature = (file: PortfolioFile) => {
  const { buffer, mimetype } = file;
  const startsWith = (bytes: number[]) => bytes.every((byte, index) => buffer[index] === byte);

  if (mimetype === "image/jpeg" && !startsWith([0xff, 0xd8, 0xff])) {
    throw new ApiError(400, "Uploaded file content does not match its MIME type");
  }

  if (mimetype === "image/png" && !startsWith([0x89, 0x50, 0x4e, 0x47])) {
    throw new ApiError(400, "Uploaded file content does not match its MIME type");
  }

  if (mimetype === "image/webp" &&
      (!startsWith([0x52, 0x49, 0x46, 0x46]) || buffer.toString("ascii", 8, 12) !== "WEBP")) {
    throw new ApiError(400, "Uploaded file content does not match its MIME type");
  }

  if (mimetype === "application/pdf" && buffer.toString("ascii", 0, 4) !== "%PDF") {
    throw new ApiError(400, "Uploaded file content does not match its MIME type");
  }
};

const serializeAsset = (asset, options: { public?: boolean } = {}) => {
  if (!asset) {
    return null;
  }

  const payload = {
    id: asset._id.toString(),
    assetType: asset.assetType,
    usage: asset.usage,
    secureUrl: asset.secureUrl,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    format: asset.format || null,
    bytes: asset.bytes || null,
    createdAt: asset.createdAt
  };

  if (options.public) {
    delete payload.usage;
  }

  return payload;
};

const createPortfolioAsset = async ({
  applicantId,
  file,
  usage,
  resourceId,
  assetType,
  portfolioId
}: {
  applicantId: string;
  file: PortfolioFile;
  usage: AssetUsage;
  resourceId: string;
  assetType?: string;
  portfolioId?: string;
}) => {
  if (!file?.buffer) {
    throw new ApiError(400, "Uploaded file is required");
  }

  assertFileSignature(file);
  const classification = classifyFile(file, usage);
  const uploaded = await uploadBufferToCloudinary({
    buffer: file.buffer,
    folder: getPortfolioFolder(usage, applicantId, resourceId, portfolioId),
    resourceType: classification.resourceType
  });

  try {
    return await PortfolioAsset.create({
      applicantId,
      portfolioId,
      assetType: assetType || classification.assetType,
      usage,
      cloudinaryPublicId: uploaded.public_id,
      cloudinaryResourceType: classification.resourceType,
      secureUrl: uploaded.secure_url,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      format: uploaded.format,
      bytes: uploaded.bytes
    });
  } catch (error) {
    await safeDeleteCloudinaryResource(
      {
        cloudinaryPublicId: uploaded.public_id,
        cloudinaryResourceType: classification.resourceType
      },
      "create-asset-database-rollback"
    );
    throw error;
  }
};

const deletePortfolioAsset = async (asset) => {
  if (!asset) {
    return;
  }

  await deleteCloudinaryResource({
    publicId: asset.cloudinaryPublicId,
    resourceType: asset.cloudinaryResourceType as CloudinaryResourceType
  });
  await PortfolioAsset.deleteOne({ _id: asset._id });
};

export {
  createPortfolioAsset,
  deletePortfolioAsset,
  getPortfolioFolder,
  logPortfolioCleanupFailure,
  safeDeleteAssetRecord,
  safeDeleteCloudinaryResource,
  serializeAsset
};
