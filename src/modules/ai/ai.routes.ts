import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { aiRateLimit } from "../../middlewares/rateLimit.middleware";
import * as aiController from "./ai.controller";
import {
  aiIdempotencyKeyValidation,
  aiResultIdValidation,
  aiResultsQueryValidation,
  cvAiRequestValidation,
  careerTargetAiRequestValidation
} from "./ai.validation";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));
router.use("/cvs/:cvId", aiRateLimit);

router.post(
  "/cvs/:cvId/feedback",
  validate(aiIdempotencyKeyValidation),
  validate(cvAiRequestValidation),
  aiController.generateFeedback
);

router.post(
  "/cvs/:cvId/review",
  validate(aiIdempotencyKeyValidation),
  validate(careerTargetAiRequestValidation),
  aiController.reviewCv
);

router.post(
  "/cvs/:cvId/score",
  validate(aiIdempotencyKeyValidation),
  validate(cvAiRequestValidation),
  aiController.generateScore
);

router.post(
  "/cvs/:cvId/translate-to-english",
  validate(aiIdempotencyKeyValidation),
  validate(cvAiRequestValidation),
  aiController.translateToEnglish
);

router.post(
  "/cvs/:cvId/translate-and-score",
  validate(aiIdempotencyKeyValidation),
  validate(careerTargetAiRequestValidation),
  aiController.translateAndScore
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
