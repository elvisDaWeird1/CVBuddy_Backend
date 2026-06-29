import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { uploadPortfolioImage } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as mobileController from "./mobile.controller";
import { uploadPortfolioPhotoValidation } from "./mobile.validation";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post(
  "/portfolio/photos",
  uploadPortfolioImage,
  validate(uploadPortfolioPhotoValidation),
  mobileController.uploadPortfolioPhoto
);

export default router;
