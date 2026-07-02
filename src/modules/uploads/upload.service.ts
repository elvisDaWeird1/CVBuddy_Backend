import { Readable } from "stream";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import cloudinary from "../../config/cloudinary.config";
import ApiError from "../../utils/apiError";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import { serializeApplicantProfile } from "../applicantProfiles/applicantProfile.service";

const CLOUDINARY_FOLDERS = Object.freeze({
  AVATARS: "cvbuddy/avatars",
  PORTFOLIO: "cvbuddy/portfolio",
  CVS: "cvbuddy/cvs"
});

type CloudinaryResourceType = "image" | "video" | "raw" | "auto";

type UploadFileOptions = {
  folder: string;
  resourceType: CloudinaryResourceType;
};

type UploadedFile = {
  url: string;
  secureUrl: string;
  publicId: string;
  resourceType: string;
  format?: string;
  bytes?: number;
  originalFilename?: string;
};

const getMissingCloudinaryEnvVars = () => {
  return [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET"
  ].filter((key) => !process.env[key]);
};

const assertCloudinaryConfigured = () => {
  const missingVariables = getMissingCloudinaryEnvVars();

  if (missingVariables.length > 0) {
    throw new ApiError(
      500,
      "Cloudinary configuration is missing",
      missingVariables.map((field) => ({
        field,
        message: `${field} is required`
      }))
    );
  }
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

const toUploadedFile = (
  result: UploadApiResponse,
  fallbackOriginalFilename?: string
): UploadedFile => {
  return {
    url: result.secure_url,
    secureUrl: result.secure_url,
    publicId: result.public_id,
    resourceType: result.resource_type,
    format: result.format,
    bytes: result.bytes,
    originalFilename: result.original_filename || fallbackOriginalFilename
  };
};

const uploadBufferToCloudinary = async (
  file: Express.Multer.File,
  options: UploadFileOptions
) => {
  assertCloudinaryConfigured();

  const uploadOptions: UploadApiOptions = {
    folder: options.folder,
    resource_type: options.resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false
  };

  return new Promise<UploadedFile>((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
          return;
        }

        resolve(toUploadedFile(result, file.originalname));
      }
    );

    Readable.from(file.buffer).pipe(uploadStream);
  });
};

const deleteCloudinaryResource = async (
  publicId?: string,
  resourceType: CloudinaryResourceType | string = "image"
) => {
  if (!publicId) {
    return;
  }

  assertCloudinaryConfigured();

  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType as CloudinaryResourceType,
    invalidate: true
  });
};

const uploadAvatar = async ({ accountId, file }) => {
  assertFile(file, "avatar");

  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  const previousPublicId = profile.avatarPublicId;
  const uploadedFile = await uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.AVATARS,
    resourceType: "image"
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

  if (previousPublicId && previousPublicId !== uploadedFile.publicId) {
    await deleteCloudinaryResource(previousPublicId, "image").catch(() => undefined);
  }

  return {
    ...uploadedFile,
    profile: serializeApplicantProfile(profile)
  };
};

const uploadPortfolioPhoto = async ({ file }) => {
  assertFile(file, "image");

  return uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.PORTFOLIO,
    resourceType: "image"
  });
};

const uploadCvFile = async ({ file }) => {
  assertFile(file, "file");

  return uploadBufferToCloudinary(file, {
    folder: CLOUDINARY_FOLDERS.CVS,
    resourceType: "auto"
  });
};

export {
  CLOUDINARY_FOLDERS,
  deleteCloudinaryResource,
  uploadAvatar,
  uploadBufferToCloudinary,
  uploadCvFile,
  uploadPortfolioPhoto
};
