import mongoose, { Document, Types } from "mongoose";

import {
  AI_STATUSES,
  AI_STATUS_VALUES,
  AI_TYPES,
  AI_TYPE_VALUES
} from "../../constants/enums";

export interface IAIResult extends Document {
  accountId: Types.ObjectId;
  cvDocumentId?: Types.ObjectId;
  relatedJobId?: Types.ObjectId;
  aiType: "CV_FEEDBACK" | "CV_TRANSLATION" | "CV_SCORING" | "JOB_RECOMMENDATION";
  status: "PENDING" | "COMPLETED" | "FAILED";
  inputText?: string;
  resultText?: string;
  score?: number;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}

const transformAIResult = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const AIResultSchema = new mongoose.Schema<IAIResult>(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    cvDocumentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CVDocument"
    },
    relatedJobId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
    },
    aiType: {
      type: String,
      enum: AI_TYPE_VALUES,
      required: true
    },
    status: {
      type: String,
      enum: AI_STATUS_VALUES,
      default: AI_STATUSES.PENDING,
      required: true
    },
    inputText: {
      type: String
    },
    resultText: {
      type: String
    },
    score: {
      type: Number,
      min: 0,
      max: 100
    },
    errorMessage: {
      type: String
    },
    completedAt: {
      type: Date
    }
  },
  {
    collection: "ai_results",
    timestamps: {
      createdAt: "createdAt",
      updatedAt: false
    },
    toJSON: {
      transform: transformAIResult
    },
    toObject: {
      transform: transformAIResult
    }
  }
);

AIResultSchema.index({ accountId: 1 });
AIResultSchema.index({ cvDocumentId: 1 });
AIResultSchema.index({ relatedJobId: 1 });
AIResultSchema.index({ aiType: 1 });
AIResultSchema.index({ status: 1 });
AIResultSchema.index({ createdAt: -1 });

const AIResult = mongoose.model<IAIResult>("AIResult", AIResultSchema);

export default AIResult;
