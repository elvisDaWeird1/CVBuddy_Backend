import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as applicantProfileService from "./applicantProfile.service";

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

export {
  getMyApplicantProfile,
  updateMyApplicantProfile
};
