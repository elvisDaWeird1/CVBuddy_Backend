const asyncHandler = require("../../utils/asyncHandler");
const { successResponse } = require("../../utils/apiResponse");
const applicantProfileService = require("./applicantProfile.service");

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

module.exports = {
  getMyApplicantProfile,
  updateMyApplicantProfile
};
