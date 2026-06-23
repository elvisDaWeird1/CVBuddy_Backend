const express = require("express");

const { ACCOUNT_ROLES } = require("../../constants/enums");
const { authMiddleware } = require("../../middlewares/auth.middleware");
const { roleMiddleware } = require("../../middlewares/role.middleware");
const { validate } = require("../../middlewares/validate.middleware");
const applicantProfileController = require("./applicantProfile.controller");
const {
  updateApplicantProfileValidation
} = require("./applicantProfile.validation");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.get("/me", applicantProfileController.getMyApplicantProfile);

router.patch(
  "/me",
  validate(updateApplicantProfileValidation),
  applicantProfileController.updateMyApplicantProfile
);

module.exports = router;
