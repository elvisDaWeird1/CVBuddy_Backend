import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import * as adminController from "./admin.controller";

const router = express.Router();

router.get(
  "/metrics/overview",
  authMiddleware,
  roleMiddleware(ACCOUNT_ROLES.ADMIN),
  adminController.getUserMetricsOverview
);

export default router;
