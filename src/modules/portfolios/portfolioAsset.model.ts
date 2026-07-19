import mongoose, { Document, Types } from "mongoose";

import {
  PORTFOLIO_ASSET_TYPE_VALUES,
  PORTFOLIO_ASSET_USAGE_VALUES,
  PORTFOLIO_CLOUDINARY_RESOURCE_TYPE_VALUES
} from "../../constants/enums";

export interface IPortfolioAsset extends Document {
  applicantId: Types.ObjectId;
  portfolioId?: Types.ObjectId;
  assetType: string;
  usage: string;
  cloudinaryPublicId: string;
  cloudinaryResourceType: string;
  secureUrl: string;
  originalFilename: string;
  mimeType: string;
  format?: string;
  bytes?: number;
  createdAt: Date;
}

const PortfolioAssetSchema = new mongoose.Schema<IPortfolioAsset>(
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
    assetType: { type: String, enum: PORTFOLIO_ASSET_TYPE_VALUES, required: true },
    usage: { type: String, enum: PORTFOLIO_ASSET_USAGE_VALUES, required: true },
    cloudinaryPublicId: { type: String, required: true },
    cloudinaryResourceType: {
      type: String,
      enum: PORTFOLIO_CLOUDINARY_RESOURCE_TYPE_VALUES,
      required: true
    },
    secureUrl: { type: String, required: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    format: { type: String },
    bytes: { type: Number }
  },
  {
    collection: "portfolio_assets",
    timestamps: { createdAt: true, updatedAt: false }
  }
);

PortfolioAssetSchema.index({ applicantId: 1, createdAt: -1 });
PortfolioAssetSchema.index({ portfolioId: 1, createdAt: -1 });

const PortfolioAsset = mongoose.model<IPortfolioAsset>(
  "PortfolioAsset",
  PortfolioAssetSchema
);

export default PortfolioAsset;
