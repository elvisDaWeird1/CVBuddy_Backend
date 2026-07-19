import { v2 as cloudinary } from "cloudinary";
import type { UploadApiResponse } from "cloudinary";

import ApiError from "../utils/apiError";

type CloudinaryResourceType = "image" | "video" | "raw";

const logCloudinaryFailure = (operation: string, error) => {
  console.error("Cloudinary portfolio operation failed", {
    operation,
    message: error instanceof Error ? error.message : String(error)
  });
};

const controlledCloudinaryError = (operation: string, error) => {
  logCloudinaryFailure(operation, error);
  return new ApiError(
    502,
    operation === "upload"
      ? "Portfolio file upload failed"
      : "Portfolio asset cleanup failed"
  );
};

const getCloudinaryConfig = () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
  apiKey: process.env.CLOUDINARY_API_KEY?.trim(),
  apiSecret: process.env.CLOUDINARY_API_SECRET?.trim()
});

const assertCloudinaryConfigured = () => {
  const config = getCloudinaryConfig();

  if (!config.cloudName || !config.apiKey || !config.apiSecret) {
    throw new ApiError(500, "Cloudinary configuration is missing", [
      {
        field: "CLOUDINARY_CLOUD_NAME",
        message: "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required"
      }
    ]);
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true
  });
};

const uploadBufferToCloudinary = async ({
  buffer,
  folder,
  resourceType
}: {
  buffer: Buffer;
  folder: string;
  resourceType: CloudinaryResourceType;
}): Promise<UploadApiResponse> => {
  assertCloudinaryConfigured();

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
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
  uploadBufferToCloudinary
};

export default cloudinary;
