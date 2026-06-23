const express = require("express");

const authController = require("./auth.controller");
const {
  registerApplicantValidation,
  registerCompanyValidation,
  loginValidation,
  changePasswordValidation
} = require("./auth.validation");
const { authMiddleware } = require("../../middlewares/auth.middleware");
const { validate } = require("../../middlewares/validate.middleware");

const router = express.Router();

router.post(
  "/register/applicant",
  validate(registerApplicantValidation),
  authController.registerApplicant
);

router.post(
  "/register/company",
  validate(registerCompanyValidation),
  authController.registerCompany
);

router.post("/login", validate(loginValidation), authController.login);

router.post("/logout", authMiddleware, authController.logout);

router.get("/me", authMiddleware, authController.getMe);

router.patch(
  "/change-password",
  authMiddleware,
  validate(changePasswordValidation),
  authController.changePassword
);

module.exports = router;
