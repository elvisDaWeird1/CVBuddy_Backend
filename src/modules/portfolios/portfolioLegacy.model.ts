import mongoose, { Document, Types } from "mongoose";

import { VISIBILITIES, VISIBILITY_VALUES } from "../../constants/enums";

interface ILegacyPortfolio extends Document {
  applicantProfileId: Types.ObjectId;
  title: string;
  introduction?: string;
  visibility: "PRIVATE" | "PUBLIC";
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const LegacyPortfolioSchema = new mongoose.Schema<ILegacyPortfolio>(
  {
    applicantProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicantProfile",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    introduction: {
      type: String
    },
    visibility: {
      type: String,
      enum: VISIBILITY_VALUES,
      default: VISIBILITIES.PRIVATE,
      required: true
    },
    coverImageUrl: {
      type: String
    }
  },
  {
    collection: "portfolios",
    timestamps: true
  }
);

LegacyPortfolioSchema.index({ applicantProfileId: 1 }, { unique: true, sparse: true });

const LegacyPortfolio = mongoose.model<ILegacyPortfolio>(
  "LegacyPortfolio",
  LegacyPortfolioSchema
);

export default LegacyPortfolio;
