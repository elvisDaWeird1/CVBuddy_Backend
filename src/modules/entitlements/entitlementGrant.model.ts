import mongoose, { Document, Types } from "mongoose";

import { PLAN_CODES, type PlanCode } from "../../config/planCatalog";

const ENTITLEMENT_STATUSES = Object.freeze({
  ACTIVE: "ACTIVE",
  EXPIRED: "EXPIRED",
  REVOKED: "REVOKED"
});

const ENTITLEMENT_STATUS_VALUES = Object.values(ENTITLEMENT_STATUSES);
const ENTITLEMENT_PLAN_CODES = Object.values(PLAN_CODES);

type EntitlementStatus = typeof ENTITLEMENT_STATUSES[keyof typeof ENTITLEMENT_STATUSES];

export interface IEntitlementGrant extends Document {
  accountId: Types.ObjectId;
  sourceOrderId: string;
  planCode: PlanCode;
  startsAt: Date;
  endsAt: Date;
  creditsGranted: number;
  creditsConsumed: number;
  status: EntitlementStatus;
  createdAt: Date;
  updatedAt: Date;
}

const transformEntitlementGrant = (_doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const EntitlementGrantSchema = new mongoose.Schema<IEntitlementGrant>(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    sourceOrderId: {
      type: String,
      required: true,
      trim: true
    },
    planCode: {
      type: String,
      enum: ENTITLEMENT_PLAN_CODES,
      required: true
    },
    startsAt: {
      type: Date,
      required: true
    },
    endsAt: {
      type: Date,
      required: true
    },
    creditsGranted: {
      type: Number,
      min: 0,
      required: true
    },
    creditsConsumed: {
      type: Number,
      min: 0,
      default: 0,
      required: true
    },
    status: {
      type: String,
      enum: ENTITLEMENT_STATUS_VALUES,
      default: ENTITLEMENT_STATUSES.ACTIVE,
      required: true
    }
  },
  {
    collection: "entitlement_grants",
    timestamps: true,
    toJSON: { transform: transformEntitlementGrant },
    toObject: { transform: transformEntitlementGrant }
  }
);

EntitlementGrantSchema.index({ sourceOrderId: 1 }, { unique: true });
EntitlementGrantSchema.index({ accountId: 1, endsAt: -1, status: 1 });
EntitlementGrantSchema.index({ accountId: 1, planCode: 1, startsAt: 1, endsAt: 1 });

const EntitlementGrant = mongoose.model<IEntitlementGrant>(
  "EntitlementGrant",
  EntitlementGrantSchema
);

export {
  ENTITLEMENT_STATUSES,
  ENTITLEMENT_STATUS_VALUES
};

export default EntitlementGrant;
