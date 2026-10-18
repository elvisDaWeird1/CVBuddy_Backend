import mongoose, { Document, Types } from "mongoose";

import {
  AI_FEATURE_KEYS,
  type AiFeatureKey
} from "../../config/planCatalog";

const AI_USAGE_STATES = Object.freeze({
  RESERVED: "RESERVED",
  CONSUMED: "CONSUMED",
  REFUNDED: "REFUNDED"
});

const AI_USAGE_STATE_VALUES = Object.values(AI_USAGE_STATES);
const AI_FEATURE_KEY_VALUES = Object.values(AI_FEATURE_KEYS);

type AiUsageState = typeof AI_USAGE_STATES[keyof typeof AI_USAGE_STATES];

export interface IAiUsage extends Document {
  accountId: Types.ObjectId;
  entitlementGrantId: Types.ObjectId;
  aiResultId?: Types.ObjectId;
  featureKey: AiFeatureKey;
  credits: number;
  state: AiUsageState;
  idempotencyKey: string;
  provider?: string;
  providerModel?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCost?: number;
  estimatedCostCurrency?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transformAiUsage = (_doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const AiUsageSchema = new mongoose.Schema<IAiUsage>(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    entitlementGrantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "EntitlementGrant",
      required: true
    },
    aiResultId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AIResult"
    },
    featureKey: {
      type: String,
      enum: AI_FEATURE_KEY_VALUES,
      required: true
    },
    credits: {
      type: Number,
      min: 1,
      required: true
    },
    state: {
      type: String,
      enum: AI_USAGE_STATE_VALUES,
      required: true
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      minlength: 8,
      maxlength: 128
    },
    provider: { type: String, trim: true },
    providerModel: { type: String, trim: true },
    inputTokens: { type: Number, min: 0 },
    outputTokens: { type: Number, min: 0 },
    totalTokens: { type: Number, min: 0 },
    estimatedCost: { type: Number, min: 0 },
    estimatedCostCurrency: { type: String, trim: true, uppercase: true }
  },
  {
    collection: "ai_usage",
    timestamps: true,
    toJSON: { transform: transformAiUsage },
    toObject: { transform: transformAiUsage }
  }
);

AiUsageSchema.index({ accountId: 1, idempotencyKey: 1 }, { unique: true });
AiUsageSchema.index({ accountId: 1, createdAt: -1, state: 1 });
AiUsageSchema.index({ entitlementGrantId: 1, state: 1 });
AiUsageSchema.index({ aiResultId: 1 }, { sparse: true });

const AiUsage = mongoose.model<IAiUsage>("AiUsage", AiUsageSchema);

export {
  AI_USAGE_STATES,
  AI_USAGE_STATE_VALUES
};

export default AiUsage;
