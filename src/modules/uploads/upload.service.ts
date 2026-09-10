import path from "path";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import {
  deleteCloudinaryResource as deleteCloudinaryResourceFromProvider,
  uploadBufferToCloudinary as uploadBufferToCloudinaryProvider
} from "../../config/cloudinary.config";
import { CV_STATUSES } from "../../constants/enums";
import ApiError from "../../utils/apiError";
import {
  assertCvFileContent,
  assertImageFileContent,
  sanitizeOriginalFilename
} from "../../utils/uploadFile";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import { serializeApplicantProfile } from "../applicantProfiles/applicantProfile.service";
import CVDocument from "../cvs/cvDocument.model";

const CLOUDINARY_FOLDERS = Object.freeze({
  APPLICANT_AVATAR: "cvbuddy/applicant-avatar",
  PORTFOLIO: "cvbuddy/portfolio",
  CV: "cvbuddy/cvs"
});

type CloudinaryResourceType = "image" | "video" | "raw" | "auto";

type UploadFileOptions = {
  folder: string;
  resourceType: CloudinaryResourceType;
  publicId: string;
  overwrite?: boolean;
  filenameOverride?: string;
  displayName?: string;
};

type UploadedFile = {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
  originalFilename?: string;
  originalName: string;
  mimeType: string;
  size: number;
};

const assertFile = (file: Express.Multer.File | undefined, field = "file") => {
  if (!file) {
    throw new ApiError(400, "File is required", [
      {
        field,
        message: "File is required"
      }
    ]);
  }
};

const toUploadedFile = (result: UploadApiResponse, file: Express.Multer.File): UploadedFile => {
  const originalName = sanitizeOriginalFilename(file.originalname);

  return {
    url: result.secure_url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    originalFilename: originalName,
    originalName,
    mimeType: file.mimetype,
    size: file.size
  };
};

const getDisplayName = (originalname: string) => {
  return sanitizeOriginalFilename(originalname);
};

const getFileExtension = (originalname: string) => {
  return path.extname(getDisplayName(originalname)).toLowerCase();
};

const sanitizePublicIdPart = (value: string, fallback = "file") => {
  const sanitized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return sanitized || fallback;
};

const getSafeCvPublicIdFilename = (originalname: string) => {
  const displayName = getDisplayName(originalname);
  const extension = getFileExtension(displayName);
  const basename = path.basename(displayName, extension);

  return `${sanitizePublicIdPart(basename, "cv")}${extension}`;
};

const uploadBufferToCloudinary = async (
  file: Express.Multer.File,
  options: UploadFileOptions
) => {
  const uploadOptions: UploadApiOptions = {
    public_id: options.publicId,
    overwrite: Boolean(options.overwrite),
    invalidate: Boolean(options.overwrite),
    filename_override: options.filenameOverride,
    display_name: options.displayName
  };

  const result = await uploadBufferToCloudinaryProvider({
    buffer: file.buffer,
    folder: options.folder,
    resourceType: options.resourceType,
    options: uploadOptions
  });

  return toUploadedFile(result, file);
};

const toAccountIdString = (accountId) => {
  return accountId?.toString();
};

const buildTimestampPublicId = (accountId) => {
  return `${toAccountIdString(accountId)}-${Date.now()}`;
};

const buildCvPublicId = (accountId, originalname: string) => {
  return `${buildTimestampPublicId(accountId)}-${getSafeCvPublicIdFilename(originalname)}`;
};

const getApplicantProfileForAccount = async (accountId) => {
  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return profile;
};

const deleteCloudinaryResource = async (
  publicId?: string,
  resourceType: CloudinaryResourceType | string = "image"
) => {
  if (!publicId) {
    return;
  }

  await deleteCloudinaryResourceFromProvider({
    publicId,
    resourceType: resourceType as "image" | "video" | "raw"
  });
};

const uploadAvatar = async ({ accountId, file }) => {
  assertImageFileContent(file, "avatar");

  const profile = await getApplicantProfileForAccount(accountId);

  const previousPublicId = profile.avatarPublicId;
  const uploadedFile = await uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.APPLICANT_AVATAR + "/" + toAccountIdString(accountId),
    resourceType: "image",
    publicId: "avatar-" + Date.now()
  });

  try {
    profile.avatarUrl = uploadedFile.url;
    profile.avatarPublicId = uploadedFile.publicId;
    await profile.save();
  } catch (error) {
    await deleteCloudinaryResource(uploadedFile.publicId, uploadedFile.resourceType).catch(
      () => undefined
    );
    throw error;
  }

  if (
    previousPublicId &&
    previousPublicId !== uploadedFile.publicId &&
    previousPublicId.startsWith(CLOUDINARY_FOLDERS.APPLICANT_AVATAR + "/")
  ) {
    await deleteCloudinaryResource(previousPublicId, "image").catch((error) => {
      console.error("Previous avatar cleanup failed", {
        accountId: toAccountIdString(accountId),
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }

  return {
    ...uploadedFile,
    profile: serializeApplicantProfile(profile)
  };
};

const uploadPortfolioPhoto = async ({ accountId, file }) => {
  assertImageFileContent(file, "image");

  return uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.PORTFOLIO,
    resourceType: "image",
    publicId: buildTimestampPublicId(accountId)
  });
};

const uploadCvFile = async ({ accountId, file }) => {
  assertCvFileContent(file);

  return uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.CV,
    resourceType: "raw",
    publicId: buildCvPublicId(accountId, file.originalname),
    filenameOverride: file.originalname,
    displayName: getDisplayName(file.originalname)
  });
};

const buildFallbackDownloadName = (cv) => {
  const fileType = cv.fileType ? `.${cv.fileType}` : "";
  return `${sanitizePublicIdPart(cv.title || "cv", "cv")}${fileType || ".bin"}`;
};

const getMyCvDownload = async ({ accountId, cvId }) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);

  const cv = await CVDocument.findOne({
    _id: cvId,
    status: CV_STATUSES.ACTIVE
  });

  if (!cv) {
    throw new ApiError(404, "CV not found", [], "CV_NOT_FOUND");
  }

  if (cv.applicantProfileId.toString() !== applicantProfile._id.toString()) {
    throw new ApiError(403, "You do not have permission to access this CV", [], "CV_FORBIDDEN");
  }

  return {
    url: cv.fileUrl,
    originalName: sanitizeOriginalFilename(
      cv.originalName || buildFallbackDownloadName(cv),
      "cv.bin"
    ),
    mimeType: cv.mimeType || "application/octet-stream",
    size: cv.size ?? cv.fileSize,
    fileType: cv.fileType,
    publicId: cv.filePublicId,
    resourceType: cv.fileResourceType || "raw"
  };
};

export {
  CLOUDINARY_FOLDERS,
  deleteCloudinaryResource,
  getMyCvDownload,
  uploadAvatar,
  uploadBufferToCloudinary,
  uploadCvFile,
  uploadPortfolioPhoto
};
