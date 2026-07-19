import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as applicantProfileService from "./applicantProfile.service";
import * as uploadService from "../uploads/upload.service";

const getMyApplicantProfile = asyncHandler(async (req, res) => {
  const profile = await applicantProfileService.getProfileByAccountId(req.user._id);

  return successResponse(res, "Applicant profile fetched successfully", {
    profile
  });
});

const updateMyApplicantProfile = asyncHandler(async (req, res) => {
  const profile = await applicantProfileService.updateProfileByAccountId(
    req.user._id,
    req.body
  );

  return successResponse(res, "Applicant profile updated successfully", {
    profile
  });
});

const updateMyAvatar = asyncHandler(async (req, res) => {
  const upload = await uploadService.uploadAvatar({
    accountId: req.user._id,
    file: req.file
  });

  return successResponse(res, "Avatar updated successfully", {
    applicantProfile: upload.profile
  });
});

export {
  getMyApplicantProfile,
  updateMyApplicantProfile,
  updateMyAvatar
};
