import mongoose, { Document, Types } from "mongoose";

import { VISIBILITIES, VISIBILITY_VALUES } from "../../constants/enums";

export interface IPortfolioItem extends Document {
  portfolioId: Types.ObjectId;
  title: string;
  description?: string;
  imageUrl?: string;
  imagePublicId?: string;
  eventName?: string;
  eventRole?: string;
  eventDate?: Date;
  location?: string;
  visibility: "PRIVATE" | "PUBLIC";
  createdFromMobile: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const transformPortfolioItem = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const PortfolioItemSchema = new mongoose.Schema<IPortfolioItem>(
  {
    portfolioId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Portfolio",
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String
    },
    imageUrl: {
      type: String
    },
    imagePublicId: {
      type: String
    },
    eventName: {
      type: String,
      trim: true
    },
    eventRole: {
      type: String,
      trim: true
    },
    eventDate: {
      type: Date
    },
    location: {
      type: String,
      trim: true
    },
    visibility: {
      type: String,
      enum: VISIBILITY_VALUES,
      default: VISIBILITIES.PUBLIC,
      required: true
    },
    createdFromMobile: {
      type: Boolean,
      default: false,
      required: true
    }
  },
  {
    collection: "portfolio_items",
    timestamps: true,
    toJSON: {
      transform: transformPortfolioItem
    },
    toObject: {
      transform: transformPortfolioItem
    }
  }
);

PortfolioItemSchema.index({ portfolioId: 1 });
PortfolioItemSchema.index({ visibility: 1 });
PortfolioItemSchema.index({ createdFromMobile: 1 });
PortfolioItemSchema.index({ createdAt: -1 });

const PortfolioItem = mongoose.model<IPortfolioItem>(
  "PortfolioItem",
  PortfolioItemSchema
);

export default PortfolioItem;
