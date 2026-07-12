import mongoose, { Document, Types } from "mongoose";

export interface IPortfolio extends Document {
  applicantId: Types.ObjectId;
  headline?: string;
  about?: string;
  desiredRole?: string;
  slug: string;
  isPublic: boolean;
  skills: string[];
  socialLinks: Record<string, string>;
  featuredExperienceIds: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioSchema = new mongoose.Schema<IPortfolio>(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    headline: {
      type: String,
      trim: true
    },
    about: {
      type: String,
      trim: true
    },
    desiredRole: {
      type: String,
      trim: true
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    },
    isPublic: {
      type: Boolean,
      default: false,
      required: true
    },
    skills: {
      type: [String],
      default: []
    },
    socialLinks: {
      type: Object,
      default: {}
    },
    featuredExperienceIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "PortfolioExperience",
      default: [],
      validate: {
        validator: (value: Types.ObjectId[]) => value.length <= 6,
        message: "featuredExperienceIds cannot contain more than 6 experiences"
      }
    }
  },
  {
    collection: "portfolios",
    timestamps: true
  }
);

PortfolioSchema.index({ applicantId: 1 }, { unique: true, sparse: true });
PortfolioSchema.index({ slug: 1 }, { unique: true, sparse: true });

const Portfolio = mongoose.model<IPortfolio>("Portfolio", PortfolioSchema);

export default Portfolio;
