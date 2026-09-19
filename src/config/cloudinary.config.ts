import { v2 as cloudinary } from "cloudinary";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";

import ApiError from "../utils/apiError";

type CloudinaryResourceType = "image" | "video" | "raw";
type CloudinaryUploadResourceType = CloudinaryResourceType | "auto";
type CloudinaryDeliveryType = "upload" | "private" | "authenticated";

const logCloudinaryFailure = (operation: string, error) => {
  console.error("Cloudinary operation failed", {
    operation,
    message: error instanceof Error ? error.message : String(error)
  });
};

const controlledCloudinaryError = (operation: string, error) => {
  logCloudinaryFailure(operation, error);
  return new ApiError(
    502,
    operation === "upload"
      ? "File storage upload failed"
      : "File storage cleanup failed",
    operation === "upload"
      ? [{ code: "STORAGE_UPLOAD_FAILED", message: "Unable to store uploaded file" }]
      : [{ code: "STORAGE_CLEANUP_FAILED", message: "Unable to remove stored file" }],
    operation === "upload" ? "STORAGE_UPLOAD_FAILED" : "STORAGE_CLEANUP_FAILED"
  );
};

const getCloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  apiKey: process.env.CLOUDINARY_API_KEY?.trim(),
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim()
});

const assertCloudinaryConfigured = () => {
  const config = getCloudinaryConfig();
  const missingVariables = [
    ["CLOUDINARY_CLOUD_NAME", config.cloudName],
    ["CLOUDINARY_API_KEY", config.apiKey],
    ["CLOUDINARY_API_SECRET", config.apiSecret]
  ].filter(([, value]) => !value);

  if (missingVariables.length > 0) {
    throw new ApiError(
      500,
      "Cloudinary configuration is missing",
      missingVariables.map(([field]) => ({
        field,
        message: `${field} is required`
      })),
      "STORAGE_CONFIGURATION_MISSING"
    );
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  });
};

const getCloudinarySignedDownloadUrl = ({
  publicId,
  resourceType = "raw",
  deliveryType = "upload",
  expiresInSeconds = 300
}: {
  publicId: string;
  resourceType?: CloudinaryResourceType;
  deliveryType?: CloudinaryDeliveryType;
  expiresInSeconds?: number;
}) => {
  assertCloudinaryConfigured();

  const normalizedPublicId = publicId?.trim();
  if (
    !normalizedPublicId ||
    normalizedPublicId.includes("..") ||
    normalizedPublicId.includes("\\") ||
    normalizedPublicId.startsWith("/") ||
    normalizedPublicId.includes("://")
  ) {
    throw new ApiError(400, "Cloudinary public ID is invalid");
  }

  const normalizedExpiry = Number.isInteger(expiresInSeconds) && expiresInSeconds > 0
    ? Math.min(expiresInSeconds, 900)
    : 300;

  return cloudinary.utils.private_download_url(normalizedPublicId, "", {
    resource_type: resourceType,
    type: deliveryType,
    expires_at: Math.floor(Date.now() / 1000) + normalizedExpiry,
    attachment: false
  });
};

const uploadBufferToCloudinary = async ({
  buffer,
  folder,
  resourceType,
  options = {}
}: {
  buffer: Buffer;
  folder: string;
  resourceType: CloudinaryUploadResourceType;
  options?: UploadApiOptions;
}): Promise<UploadApiResponse> => {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    try {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          ...options,
          folder,
          resource_type: resourceType,
          type: "upload"
        },
        (error, result) => {
          if (error || !result) {
            return reject(
              controlledCloudinaryError("upload", error || new Error("Cloudinary upload failed"))
            );
          }

          return resolve(result);
        }
      );

      uploadStream.end(buffer);
    } catch (error) {
      reject(controlledCloudinaryError("upload", error));
    }
  });
};

const deleteCloudinaryResource = async ({
  publicId,
  resourceType
}: {
  publicId: string;
  resourceType: CloudinaryResourceType;
}) => {
  if (!publicId) {
    return;
  }

  assertCloudinaryConfigured();

  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      invalidate: true,
      type: "upload"
    });
  } catch (error) {
    throw controlledCloudinaryError("destroy", error);
  }
};

export {
  assertCloudinaryConfigured,
  deleteCloudinaryResource,
  getCloudinaryConfig,
  getCloudinarySignedDownloadUrl,
  uploadBufferToCloudinary
};

export default cloudinary;
