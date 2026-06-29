import mongoose, { Document, Types } from "mongoose";

import { VISIBILITIES, VISIBILITY_VALUES } from "../../constants/enums";

export interface IPortfolio extends Document {
  applicantProfileId: Types.ObjectId;
  title: string;
  introduction?: string;
  visibility: "PRIVATE" | "PUBLIC";
  coverImageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transformPortfolio = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const PortfolioSchema = new mongoose.Schema<IPortfolio>(
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
    timestamps: true,
    toJSON: {
      transform: transformPortfolio
    },
    toObject: {
      transform: transformPortfolio
    }
  }
);

PortfolioSchema.index({ applicantProfileId: 1 }, { unique: true });
PortfolioSchema.index({ visibility: 1 });

const Portfolio = mongoose.model<IPortfolio>("Portfolio", PortfolioSchema);

export default Portfolio;
