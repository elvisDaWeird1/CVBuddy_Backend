import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as aiController from "./ai.controller";
import {
  aiResultIdValidation,
  aiResultsQueryValidation,
  cvAiRequestValidation
} from "./ai.validation";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post(
  "/cvs/:cvId/feedback",
  validate(cvAiRequestValidation),
  aiController.generateFeedback
);

router.post(
  "/cvs/:cvId/score",
  validate(cvAiRequestValidation),
  aiController.generateScore
);

router.post(
  "/cvs/:cvId/translate-to-english",
  validate(cvAiRequestValidation),
  aiController.translateToEnglish
);

router.get(
  "/results",
  validate(aiResultsQueryValidation),
  aiController.getMyAiResults
);

router.get(
  "/results/:id",
  validate(aiResultIdValidation),
  aiController.getMyAiResultById
);

export default router;
