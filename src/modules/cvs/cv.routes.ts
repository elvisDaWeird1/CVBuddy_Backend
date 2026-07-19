import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { uploadCv } from "../../middlewares/upload.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as cvController from "./cv.controller";
import * as uploadController from "../uploads/upload.controller";
import { uploadCvValidation, cvIdValidation } from "./cv.validation";

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post("/", uploadCv, validate(uploadCvValidation), cvController.uploadCv);

router.get("/", cvController.getMyCvs);

router.get(
  "/:id/download",
  validate(cvIdValidation),
  uploadController.downloadCv
);

router.get(
  "/:id/preview",
  validate(cvIdValidation),
  uploadController.previewCv
);

router.get("/:id", validate(cvIdValidation), cvController.getMyCvById);

router.delete("/:id", validate(cvIdValidation), cvController.deleteMyCvById);

export default router;
