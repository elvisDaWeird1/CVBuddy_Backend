import mongoose, { Document, Types } from "mongoose";

import {
  PORTFOLIO_EXPERIENCE_STATUS_VALUES,
  PORTFOLIO_EXPERIENCE_STATUSES,
  PORTFOLIO_EXPERIENCE_TYPE_VALUES,
  PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES,
  PORTFOLIO_EXPERIENCE_VISIBILITIES
} from "../../constants/enums";

export interface IPortfolioExperience extends Document {
  applicantId: Types.ObjectId;
  portfolioId?: Types.ObjectId;
  type: string;
  title: string;
  organization?: string;
  role?: string;
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
  location?: string;
  description?: string;
  responsibilities: string[];
  achievements: string[];
  skills: string[];
  coverAssetId?: Types.ObjectId;
  status: string;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioExperienceSchema = new mongoose.Schema<IPortfolioExperience>(
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
    type: {
      type: String,
      enum: PORTFOLIO_EXPERIENCE_TYPE_VALUES,
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 150
    },
    organization: { type: String, trim: true, maxlength: 150 },
    role: { type: String, trim: true, maxlength: 150 },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false, required: true },
    location: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    responsibilities: { type: [String], default: [] },
    achievements: { type: [String], default: [] },
    skills: { type: [String], default: [] },
    coverAssetId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortfolioAsset"
    },
    status: {
      type: String,
      enum: PORTFOLIO_EXPERIENCE_STATUS_VALUES,
      default: PORTFOLIO_EXPERIENCE_STATUSES.DRAFT,
      required: true
    },
    visibility: {
      type: String,
      enum: PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES,
      default: PORTFOLIO_EXPERIENCE_VISIBILITIES.PRIVATE,
      required: true
    }
  },
  {
    collection: "portfolio_experiences",
    timestamps: true
  }
);

PortfolioExperienceSchema.index({ applicantId: 1, status: 1 });
PortfolioExperienceSchema.index({ applicantId: 1, type: 1 });
PortfolioExperienceSchema.index({ applicantId: 1, createdAt: -1 });
PortfolioExperienceSchema.index({ portfolioId: 1, createdAt: -1 });

const PortfolioExperience = mongoose.model<IPortfolioExperience>(
  "PortfolioExperience",
  PortfolioExperienceSchema
);

export default PortfolioExperience;
