import mongoose, { Document, Types } from "mongoose";
import {
  VISIBILITIES,
  VISIBILITY_VALUES
} from "../../constants/enums";

export interface IPortfolio extends Document {
  applicantId: Types.ObjectId;
  applicantProfileId?: Types.ObjectId;
  title: string;
  description?: string;
  coverImageUrl?: string;
  coverImagePublicId?: string;
  visibility: "PRIVATE" | "PUBLIC";
  publishedAt?: Date;
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
    applicantProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApplicantProfile"
    },
    title: {
      type: String,
      trim: true,
      minlength: 2,
      maxlength: 100,
      default: "My Portfolio",
      required: true
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000
    },
    coverImageUrl: {
      type: String,
      trim: true
    },
    coverImagePublicId: {
      type: String,
      trim: true
    },
    visibility: {
      type: String,
      enum: VISIBILITY_VALUES,
      default: VISIBILITIES.PRIVATE,
      required: true
    },
    publishedAt: {
      type: Date
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

PortfolioSchema.index({ applicantId: 1 }, { unique: true });
PortfolioSchema.index({ slug: 1 }, { unique: true, sparse: true });

const Portfolio = mongoose.model<IPortfolio>("Portfolio", PortfolioSchema);

export default Portfolio;
