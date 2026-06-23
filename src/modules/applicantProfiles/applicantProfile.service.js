const ApiError = require("../../utils/apiError");
const ApplicantProfile = require("./applicantProfile.model");
const { ALLOWED_PROFILE_FIELDS } = require("./applicantProfile.validation");

const serializeApplicantProfile = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    id: profile._id.toString(),
    accountId: profile.accountId.toString(),
    fullName: profile.fullName,
    phone: profile.phone,
    university: profile.university,
    major: profile.major,
    location: profile.location,
    headline: profile.headline,
    summary: profile.summary,
    careerGoal: profile.careerGoal,
    avatarUrl: profile.avatarUrl,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt
  };
};

const getProfileByAccountId = async (accountId) => {
  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return serializeApplicantProfile(profile);
};

const buildProfileUpdates = (payload) => {
  return ALLOWED_PROFILE_FIELDS.reduce((updates, field) => {
    if (payload[field] !== undefined) {
      updates[field] =
        typeof payload[field] === "string" ? payload[field].trim() : payload[field];
    }

    return updates;
  }, {});
};

const updateProfileByAccountId = async (accountId, payload) => {
  const updates = buildProfileUpdates(payload);

  const profile = await ApplicantProfile.findOneAndUpdate(
    { accountId },
    { $set: updates },
    {
      new: true,
      runValidators: true
    }
  );

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return serializeApplicantProfile(profile);
};

module.exports = {
  getProfileByAccountId,
  updateProfileByAccountId,
  serializeApplicantProfile
};
