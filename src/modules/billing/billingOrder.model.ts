import mongoose, { Document, Types } from "mongoose";

import { PLAN_CODES } from "../../config/planCatalog";

const BILLING_ORDER_STATUSES = Object.freeze({
  PENDING: "PENDING",
  PAID: "PAID",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
  FAILED: "FAILED"
});

const BILLING_ORDER_STATUS_VALUES = Object.values(BILLING_ORDER_STATUSES);

export interface IBillingOrder extends Document {
  accountId: Types.ObjectId;
  provider: "PAYOS";
  orderCode: number;
  paymentLinkId?: string;
  planCode: "PRO_30D";
  amountVnd: number;
  status: typeof BILLING_ORDER_STATUS_VALUES[number];
  idempotencyKey: string;
  checkoutUrl?: string;
  providerReference?: string;
  expiresAt: Date;
  expiredAt?: Date;
  paidAt?: Date;
  lastReconciledAt?: Date;
  reconciliationAttempts: number;
  lastReconciliationErrorCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BillingOrderSchema = new mongoose.Schema<IBillingOrder>(
  {
    accountId: { type: mongoose.Schema.Types.ObjectId, ref: "Account", required: true },
    provider: { type: String, enum: ["PAYOS"], default: "PAYOS", required: true },
    orderCode: { type: Number, required: true },
    paymentLinkId: { type: String, trim: true },
    planCode: { type: String, enum: [PLAN_CODES.PRO_30D], required: true },
    amountVnd: { type: Number, min: 1, required: true },
    status: {
      type: String,
      enum: BILLING_ORDER_STATUS_VALUES,
      default: BILLING_ORDER_STATUSES.PENDING,
      required: true
    },
    idempotencyKey: { type: String, required: true, trim: true, minlength: 8, maxlength: 128 },
    checkoutUrl: { type: String, trim: true },
    providerReference: { type: String, trim: true },
    expiresAt: { type: Date, required: true },
    expiredAt: { type: Date },
    paidAt: { type: Date },
    lastReconciledAt: { type: Date },
    reconciliationAttempts: { type: Number, default: 0, min: 0, required: true },
    lastReconciliationErrorCode: { type: String, trim: true, maxlength: 100 }
  },
  { collection: "billing_orders", timestamps: true }
);

BillingOrderSchema.index({ orderCode: 1 }, { unique: true });
BillingOrderSchema.index({ paymentLinkId: 1 }, { unique: true, sparse: true });
BillingOrderSchema.index({ accountId: 1, idempotencyKey: 1 }, { unique: true });
BillingOrderSchema.index({ accountId: 1, status: 1, createdAt: -1 });
BillingOrderSchema.index({ status: 1, expiresAt: 1 });

const BillingOrder = mongoose.model<IBillingOrder>("BillingOrder", BillingOrderSchema);

export { BILLING_ORDER_STATUSES, BILLING_ORDER_STATUS_VALUES };
export default BillingOrder;
