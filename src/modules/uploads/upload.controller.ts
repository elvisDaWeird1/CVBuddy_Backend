import { Readable } from "stream";
import { pipeline } from "stream/promises";

import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import ApiError from "../../utils/apiError";
import * as uploadService from "./upload.service";

const encodeContentDispositionFilename = (filename: string) => {
  return encodeURIComponent(filename).replace(/['()*]/g, (character) => {
    return `%${character.charCodeAt(0).toString(16).toUpperCase()}`;
  });
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
  const cvDownload = await uploadService.getMyCvDownload({
    accountId: req.user._id,
    cvId: req.params.id
  });

  const fileResponse = await fetch(cvDownload.url);

  if (!fileResponse.ok || !fileResponse.body) {
    throw new ApiError(502, "Unable to download CV file");
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename*=UTF-8''${encodeContentDispositionFilename(
      cvDownload.originalName
    )}`
  );
  res.setHeader("Content-Type", cvDownload.mimeType || "application/octet-stream");

  await pipeline(Readable.fromWeb(fileResponse.body as any), res);
});

export {
  uploadAvatar,
  uploadPortfolioPhoto,
  uploadCv,
  downloadCv
};
