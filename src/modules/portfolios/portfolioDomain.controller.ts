import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as evidenceService from "./portfolioEvidence.service";
import * as experienceService from "./portfolioExperience.service";
import * as momentService from "./portfolioMoment.service";
import * as profileService from "./portfolioProfile.service";
import { getPublicPortfolio } from "./portfolioPublic.service";

const accountId = (req) => req.user._id;

const getMyPortfolio = asyncHandler(async (req, res) => {
  return successResponse(res, "Portfolio fetched successfully", {
    portfolio: await profileService.getMyPortfolio(accountId(req))
  });
});

const updateMyPortfolio = asyncHandler(async (req, res) => {
  return successResponse(res, "Portfolio updated successfully", {
    portfolio: await profileService.updateMyPortfolio(accountId(req), req.body)
  });
});

const publishMyPortfolio = asyncHandler(async (req, res) => {
  return successResponse(res, "Portfolio published successfully", {
    portfolio: await profileService.setPortfolioPublic(accountId(req), true)
  });
});

const unpublishMyPortfolio = asyncHandler(async (req, res) => {
  return successResponse(res, "Portfolio unpublished successfully", {
    portfolio: await profileService.setPortfolioPublic(accountId(req), false)
  });
});

const updateFeaturedExperiences = asyncHandler(async (req, res) => {
  return successResponse(res, "Featured experiences updated successfully", {
    portfolio: await profileService.setFeaturedExperiences(
      accountId(req),
      req.body.featuredExperienceIds
    )
  });
});

const getPublic = asyncHandler(async (req, res) => {
  return successResponse(res, "Public portfolio fetched successfully", await getPublicPortfolio(req.params.slug));
});

const createExperience = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience created successfully", {
    experience: await experienceService.createExperience(accountId(req), req.body)
  }, 201);
});

const listExperiences = asyncHandler(async (req, res) => {
  const result = await experienceService.listExperiences(accountId(req), req.query);
  return successResponse(res, "Experiences fetched successfully", result.items, 200, result.pagination);
});

const getExperience = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience fetched successfully", {
    experience: await experienceService.getExperience(accountId(req), req.params.id)
  });
});

const updateExperience = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience updated successfully", {
    experience: await experienceService.updateExperience(accountId(req), req.params.id, req.body)
  });
});

const deleteExperience = asyncHandler(async (req, res) => {
  await experienceService.deleteExperience(accountId(req), req.params.id);
  return successResponse(res, "Experience deleted successfully");
});

const publishExperience = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience published successfully", {
    experience: await experienceService.publishExperience(accountId(req), req.params.id)
  });
});

const archiveExperience = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience archived successfully", {
    experience: await experienceService.archiveExperience(accountId(req), req.params.id)
  });
});

const updateExperienceCover = asyncHandler(async (req, res) => {
  return successResponse(res, "Experience cover updated successfully", {
    experience: await experienceService.setExperienceCover({
      applicantId: accountId(req),
      experienceId: req.params.id,
      assetId: req.body.assetId,
      file: req.file
    })
  });
});

const createMoment = asyncHandler(async (req, res) => {
  return successResponse(res, "Moment created successfully", {
    moment: await momentService.createMoment({
      applicantId: accountId(req),
      files: req.files,
      payload: req.body
    })
  }, 201);
});

const listMoments = asyncHandler(async (req, res) => {
  const result = await momentService.listMoments(accountId(req), req.query);
  return successResponse(res, "Moments fetched successfully", result.items, 200, result.pagination);
});

const getMoment = asyncHandler(async (req, res) => {
  return successResponse(res, "Moment fetched successfully", {
    moment: await momentService.getMoment(accountId(req), req.params.id)
  });
});

const updateMoment = asyncHandler(async (req, res) => {
  return successResponse(res, "Moment updated successfully", {
    moment: await momentService.updateMoment(accountId(req), req.params.id, req.body)
  });
});

const deleteMoment = asyncHandler(async (req, res) => {
  await momentService.deleteMoment(accountId(req), req.params.id);
  return successResponse(res, "Moment deleted successfully");
});

const assignMoment = asyncHandler(async (req, res) => {
  return successResponse(res, "Moment assigned to experience successfully", {
    moment: await momentService.assignMomentToExperience(accountId(req), req.params.id, req.body.experienceId)
  });
});

const unassignMoment = asyncHandler(async (req, res) => {
  return successResponse(res, "Moment unassigned from experience successfully", {
    moment: await momentService.unassignMomentFromExperience(accountId(req), req.params.id)
  });
});

const createEvidence = asyncHandler(async (req, res) => {
  return successResponse(res, "Evidence created successfully", {
    evidence: await evidenceService.createEvidence({
      applicantId: accountId(req),
      experienceId: req.params.experienceId,
      payload: req.body,
      file: req.file
    })
  }, 201);
});

const listEvidence = asyncHandler(async (req, res) => {
  return successResponse(res, "Evidence fetched successfully", {
    evidence: await evidenceService.listEvidence(accountId(req), req.params.experienceId)
  });
});

const updateEvidence = asyncHandler(async (req, res) => {
  return successResponse(res, "Evidence updated successfully", {
    evidence: await evidenceService.updateEvidence({
      applicantId: accountId(req),
      evidenceId: req.params.id,
      payload: req.body,
      file: req.file
    })
  });
});

const deleteEvidence = asyncHandler(async (req, res) => {
  await evidenceService.deleteEvidence(accountId(req), req.params.id);
  return successResponse(res, "Evidence deleted successfully");
});

export {
  archiveExperience,
  assignMoment,
  createEvidence,
  createExperience,
  createMoment,
  deleteEvidence,
  deleteExperience,
  deleteMoment,
  getExperience,
  getMoment,
  getMyPortfolio,
  getPublic,
  listEvidence,
  listExperiences,
  listMoments,
  publishExperience,
  publishMyPortfolio,
  unassignMoment,
  unpublishMyPortfolio,
  updateEvidence,
  updateExperience,
  updateExperienceCover,
  updateFeaturedExperiences,
  updateMoment,
  updateMyPortfolio
};
