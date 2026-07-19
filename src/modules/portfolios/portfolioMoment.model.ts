import mongoose, { Document, Types } from "mongoose";

import {
  PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES,
  PORTFOLIO_MOMENT_STATUS_VALUES,
  PORTFOLIO_MOMENT_STATUSES
} from "../../constants/enums";

export interface IPortfolioMoment extends Document {
  applicantId: Types.ObjectId;
  portfolioId?: Types.ObjectId;
  experienceId?: Types.ObjectId | null;
  caption?: string;
  capturedAt: Date;
  location?: string;
  mediaAssetIds: Types.ObjectId[];
  skills: string[];
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioMomentSchema = new mongoose.Schema<IPortfolioMoment>(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio"
    },
    experienceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortfolioExperience",
      default: null
    },
    caption: { type: String, trim: true, maxlength: 500 },
    capturedAt: { type: Date, required: true },
    location: { type: String, trim: true, maxlength: 200 },
    mediaAssetIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "PortfolioAsset",
      required: true,
      validate: [
        (value: Types.ObjectId[]) => value.length >= 1 && value.length <= 5,
        "A moment must contain between 1 and 5 media assets"
      ]
    },
    skills: { type: [String], default: [] },
    status: {
      type: String,
      enum: PORTFOLIO_MOMENT_STATUS_VALUES,
      default: PORTFOLIO_MOMENT_STATUSES.DRAFT,
      required: true
    },
    visibility: {
      type: String,
      enum: PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES,
      default: "private",
      required: true
    }
  },
  {
    collection: "portfolio_moments",
    timestamps: true
  }
);

PortfolioMomentSchema.index({ applicantId: 1, createdAt: -1 });
PortfolioMomentSchema.index({ experienceId: 1, capturedAt: -1 });
PortfolioMomentSchema.index({ portfolioId: 1, capturedAt: -1 });

const PortfolioMoment = mongoose.model<IPortfolioMoment>(
  "PortfolioMoment",
  PortfolioMomentSchema
);

export default PortfolioMoment;
