import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as uploadService from "./upload.service";

const uploadAvatar = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadAvatar({
    accountId: req.user._id,
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

const uploadPortfolioPhoto = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadPortfolioPhoto({
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

const uploadCv = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadCvFile({
    file: req.file
  });

  return successResponse(res, "Upload successful", upload, 201);
});

export {
  uploadAvatar,
  uploadPortfolioPhoto,
  uploadCv
};
