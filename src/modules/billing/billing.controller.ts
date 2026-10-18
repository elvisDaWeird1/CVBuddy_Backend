import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as billingService from "./billing.service";

const createCheckout = asyncHandler(async (req, res) => {
  const checkout = await billingService.createCheckout({
    accountId: req.user._id,
    planCode: req.body.planCode,
    idempotencyKey: req.get("Idempotency-Key")
  });
  return successResponse(res, checkout.created ? "Checkout created" : "Checkout already exists", {
    order: checkout.order
  });
});

const getMyBilling = asyncHandler(async (req, res) => {
  const billing = await billingService.getMyBilling(req.user._id);
  return successResponse(res, "Billing status fetched successfully", { billing });
});

const getMyOrder = asyncHandler(async (req, res) => {
  const order = await billingService.getMyBillingOrder(req.user._id, req.params.orderId);
  return successResponse(res, "Billing order fetched successfully", { order });
});

const handlePayOSWebhook = asyncHandler(async (req, res) => {
  const result = await billingService.processPayOSWebhook({ payload: req.body });
  return successResponse(res, "Payment webhook processed", result);
});

export { createCheckout, getMyBilling, getMyOrder, handlePayOSWebhook };
