import { Readable } from "stream";
import { pipeline } from "stream/promises";
import fs from "fs";
import path from "path";

import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import ApiError from "../../utils/apiError";
import { getCloudinaryConfig } from "../../config/cloudinary.config";
import * as uploadService from "./upload.service";

const encodeContentDispositionFilename = (filename: string) => {
  return encodeURIComponent(filename).replace(/['()*]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
  });
};

const asciiFilename = (filename: string) => {
  return filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_")
    .slice(0, 180) || "cv";
};

const assertTrustedStorageUrl = (value: string) => {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(409, "Original CV file is not available", [], "CV_ASSET_MISSING");
  }

  const cloudName = getCloudinaryConfig().cloudName;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname.toLowerCase() !== "res.cloudinary.com" ||
    !cloudName ||
    segments[0] !== cloudName
  ) {
    throw new ApiError(409, "Original CV file is not in trusted storage", [], "CV_ASSET_MISSING");
  }

  return parsed;
};

const resolveLegacyLocalCvPath = (value: string) => {
  const uploadRoot = path.resolve(
    process.cwd(),
    process.env.UPLOAD_DIR || "uploads"
  );
  const normalized = value.replace(/\\/g, "/").replace(/^\/?uploads\//, "");
  const filePath = path.resolve(uploadRoot, normalized);
  const relative = path.relative(uploadRoot, filePath);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new ApiError(400, "Stored CV path is invalid", [], "CV_ASSET_INVALID");
  }

  return filePath;
};

const setDeliveryHeaders = (res, cvDownload, disposition: string, length?) => {
  const quote = String.fromCharCode(34);
  res.setHeader(
    "Content-Disposition",
    disposition + "; filename=" + quote + asciiFilename(cvDownload.originalName) +
      quote + "; filename*=UTF-8''" + encodeContentDispositionFilename(cvDownload.originalName)
  );
  res.setHeader("Content-Type", cvDownload.mimeType || "application/octet-stream");
  if (length) {
    res.setHeader("Content-Length", String(length));
  }
};

const streamCv = async (req, res, disposition: "attachment" | "inline") => {
  const cvDownload = await uploadService.getMyCvDownload({
    accountId: req.user._id,
    cvId: req.params.id
  });

  if (disposition === "inline" && cvDownload.fileType !== "pdf") {
    throw new ApiError(
      415,
      "Preview is only available for PDF CVs",
      [{ field: "id", code: "CV_PREVIEW_UNSUPPORTED", message: "DOC and DOCX require download" }],
      "CV_PREVIEW_UNSUPPORTED"
    );
  }

  if (!/^https:\/\//i.test(cvDownload.url)) {
    const filePath = resolveLegacyLocalCvPath(cvDownload.url);
    let stats;
    try {
      stats = await fs.promises.stat(filePath);
    } catch (error) {
      throw new ApiError(
        409,
        "Original CV file no longer exists",
        [],
        "CV_ASSET_MISSING"
      );
    }
    if (!stats.isFile()) {
      throw new ApiError(409, "Original CV file no longer exists", [], "CV_ASSET_MISSING");
    }
    setDeliveryHeaders(res, cvDownload, disposition, stats.size);
    await pipeline(fs.createReadStream(filePath), res);
    return;
  }

  const fileResponse = await fetch(assertTrustedStorageUrl(cvDownload.url), {
    redirect: "error"
  });

  if (!fileResponse.ok || !fileResponse.body) {
    const missing = fileResponse.status === 404;
    throw new ApiError(
      missing ? 409 : 502,
      missing ? "Original CV file no longer exists" : "Unable to read CV storage asset",
      [],
      missing ? "CV_ASSET_MISSING" : "STORAGE_DOWNLOAD_FAILED"
    );
  }

  const contentLength = fileResponse.headers.get("content-length") || cvDownload.size;
  setDeliveryHeaders(res, cvDownload, disposition, contentLength);

  await pipeline(Readable.fromWeb(fileResponse.body as any), res);
};

const uploadAvatar = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadAvatar({
    accountId: req.user._id,
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

const uploadPortfolioPhoto = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadPortfolioPhoto({
    accountId: req.user._id,
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

const uploadCv = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadCvFile({
    accountId: req.user._id,
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

const downloadCv = asyncHandler(async (req, res) => {
  return streamCv(req, res, "attachment");
});

const previewCv = asyncHandler(async (req, res) => {
  return streamCv(req, res, "inline");
});

export {
  uploadAvatar,
  uploadPortfolioPhoto,
  uploadCv,
  downloadCv,
  previewCv
};
