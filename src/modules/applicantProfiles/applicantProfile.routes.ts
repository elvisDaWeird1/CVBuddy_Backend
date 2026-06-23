import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as applicantProfileController from "./applicantProfile.controller";
import {
  updateApplicantProfileValidation
} from "./applicantProfile.validation";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.get("/me", applicantProfileController.getMyApplicantProfile);

router.patch(
  "/me",
  validate(updateApplicantProfileValidation),
  applicantProfileController.updateMyApplicantProfile
);

export default router;
