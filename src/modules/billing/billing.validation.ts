import mongoose from "mongoose";

import { PLAN_CODES } from "../../config/planCatalog";

const checkoutValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (body.planCode !== PLAN_CODES.PRO_30D) {
    errors.push({ field: "planCode", message: "planCode must be PRO_30D" });
  }

  const extraFields = Object.keys(body).filter((field) => field !== "planCode");
  for (const field of extraFields) {
    errors.push({ field, message: `${field} is controlled by the server` });
  }
  return errors;
};

const orderIdValidation = (req) => mongoose.Types.ObjectId.isValid(req.params.orderId)
  ? []
  : [{ field: "orderId", message: "Invalid billing order id" }];

export { checkoutValidation, orderIdValidation };
