import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { getCurrentUsage } from "./usage.controller";

const router = express.Router();

router.get(
  "/me",
  authMiddleware,
  roleMiddleware(ACCOUNT_ROLES.APPLICANT),
  getCurrentUsage
);

export default router;
