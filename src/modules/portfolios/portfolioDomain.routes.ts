import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import {
  uploadExperienceCover,
  uploadMomentMedia,
  uploadPortfolioEvidence
} from "../../middlewares/portfolioUpload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./portfolioDomain.controller";
import {
  validateEvidenceCreate,
  validateEvidenceUpdate,
  validateExperienceCover,
  validateExperienceCreate,
  validateExperienceList,
  validateExperienceUpdate,
  validateFeaturedExperiences,
  validateMomentAssignment,
  validateMomentCreate,
  validateMomentList,
  validateMomentUpdate,
  validateObjectIdParam,
  validatePortfolioProfile,
  validateSlugParam
} from "./portfolioDomain.validation";

const router = express.Router();

router.get(
  "/public/:slug",
  validate(validateSlugParam),
  controller.getPublic
);

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.get("/me", controller.getMyPortfolio);
router.put("/me", validate(validatePortfolioProfile), controller.updateMyPortfolio);
router.patch("/me/publish", controller.publishMyPortfolio);
router.patch("/me/unpublish", controller.unpublishMyPortfolio);
router.put(
  "/me/featured-experiences",
  validate(validateFeaturedExperiences),
  controller.updateFeaturedExperiences
);

router.post(
  "/experiences",
  validate(validateExperienceCreate),
  controller.createExperience
);
router.get(
  "/experiences",
  validate(validateExperienceList),
  controller.listExperiences
);
router.get(
  "/experiences/:id",
  validate(validateObjectIdParam("id")),
  controller.getExperience
);
router.patch(
  "/experiences/:id/cover",
  uploadExperienceCover,
  validate(validateObjectIdParam("id")),
  validate(validateExperienceCover),
  controller.updateExperienceCover
);
router.post(
  "/experiences/:id/cover",
  uploadExperienceCover,
  validate(validateObjectIdParam("id")),
  validate(validateExperienceCover),
  controller.updateExperienceCover
);
router.patch(
  "/experiences/:id/publish",
  validate(validateObjectIdParam("id")),
  controller.publishExperience
);
router.patch(
  "/experiences/:id/archive",
  validate(validateObjectIdParam("id")),
  controller.archiveExperience
);
router.patch(
  "/experiences/:id",
  validate(validateObjectIdParam("id")),
  validate(validateExperienceUpdate),
  controller.updateExperience
);
router.delete(
  "/experiences/:id",
  validate(validateObjectIdParam("id")),
  controller.deleteExperience
);

router.post(
  "/moments",
  uploadMomentMedia,
  validate(validateMomentCreate),
  controller.createMoment
);
router.get("/moments", validate(validateMomentList), controller.listMoments);
router.get(
  "/moments/:id",
  validate(validateObjectIdParam("id")),
  controller.getMoment
);
router.patch(
  "/moments/:id/assign-experience",
  validate(validateObjectIdParam("id")),
  validate(validateMomentAssignment),
  controller.assignMoment
);
router.patch(
  "/moments/:id/unassign-experience",
  validate(validateObjectIdParam("id")),
  controller.unassignMoment
);
router.patch(
  "/moments/:id",
  validate(validateObjectIdParam("id")),
  validate(validateMomentUpdate),
  controller.updateMoment
);
router.delete(
  "/moments/:id",
  validate(validateObjectIdParam("id")),
  controller.deleteMoment
);

router.post(
  "/experiences/:experienceId/evidence",
  uploadPortfolioEvidence,
  validate(validateObjectIdParam("experienceId")),
  validate(validateEvidenceCreate),
  controller.createEvidence
);
router.get(
  "/experiences/:experienceId/evidence",
  validate(validateObjectIdParam("experienceId")),
  controller.listEvidence
);
router.patch(
  "/evidence/:id",
  uploadPortfolioEvidence,
  validate(validateObjectIdParam("id")),
  validate(validateEvidenceUpdate),
  controller.updateEvidence
);
router.delete(
  "/evidence/:id",
  validate(validateObjectIdParam("id")),
  controller.deleteEvidence
);

export default router;
