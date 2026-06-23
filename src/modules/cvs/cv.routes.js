const express = require("express");

const { ACCOUNT_ROLES } = require("../../constants/enums");
const { authMiddleware } = require("../../middlewares/auth.middleware");
const { roleMiddleware } = require("../../middlewares/role.middleware");
const { uploadCv } = require("../../middlewares/upload.middleware");
const { validate } = require("../../middlewares/validate.middleware");
const cvController = require("./cv.controller");
const { uploadCvValidation, cvIdValidation } = require("./cv.validation");

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post("/", uploadCv, validate(uploadCvValidation), cvController.uploadCv);

router.get("/", cvController.getMyCvs);

router.get("/:id", validate(cvIdValidation), cvController.getMyCvById);

router.delete("/:id", validate(cvIdValidation), cvController.deleteMyCvById);

module.exports = router;
