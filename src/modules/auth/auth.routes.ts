import express from "express";

import * as authController from "./auth.controller";
import {
  registerApplicantValidation,
  registerCompanyValidation,
  loginValidation,
  changePasswordValidation
} from "./auth.validation";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { authRateLimit } from "../../middlewares/rateLimit.middleware";

const router = express.Router();

router.post(
  "/register/applicant",
  authRateLimit,
  validate(registerApplicantValidation),
  authController.registerApplicant
);

router.post(
  "/register/company",
  authRateLimit,
  validate(registerCompanyValidation),
  authController.registerCompany
);

router.post("/login", authRateLimit, validate(loginValidation), authController.login);

router.post("/logout", authMiddleware, authController.logout);

router.get("/me", authMiddleware, authController.getMe);

router.patch(
  "/change-password",
  authMiddleware,
  authRateLimit,
  validate(changePasswordValidation),
  authController.changePassword
);

export default router;
