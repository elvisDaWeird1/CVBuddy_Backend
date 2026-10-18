import express from "express";
import mongoose from "mongoose";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { billingCheckoutRateLimit, billingWebhookRateLimit } from "../../middlewares/rateLimit.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import { aiIdempotencyKeyValidation } from "../ai/ai.validation";
import * as billingController from "./billing.controller";
import { checkoutValidation, orderIdValidation } from "./billing.validation";

const router = express.Router();

router.post("/webhooks/payos", billingWebhookRateLimit, billingController.handlePayOSWebhook);

router.use(authMiddleware);
router.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

router.post(
  "/checkout",
  billingCheckoutRateLimit,
  validate(aiIdempotencyKeyValidation),
  validate(checkoutValidation),
  billingController.createCheckout
);
router.get("/me", billingController.getMyBilling);
router.get("/orders/:orderId", validate(orderIdValidation), billingController.getMyOrder);

export default router;
