import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import {
  uploadAvatarImage,
  uploadCv,
  uploadPortfolioImage
} from "../../middlewares/upload.middleware";
import { cvIdValidation } from "../cvs/cv.validation";
import * as uploadController from "./upload.controller";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post("/avatar", uploadAvatarImage, uploadController.uploadAvatar);
router.post(
  "/portfolio-photo",
  uploadPortfolioImage,
  uploadController.uploadPortfolioPhoto
);
router.post("/cv", uploadCv, uploadController.uploadCv);
router.get("/cv/:id/download", validate(cvIdValidation), uploadController.downloadCv);

export default router;
