import mongoose, { Document, Types } from "mongoose";

export interface ICompanyProfile extends Document {
  accountId: Types.ObjectId;
  companyName: string;
  industry?: string;
  websiteUrl?: string;
  logoUrl?: string;
  description?: string;
  address?: string;
  contactEmail?: string;
  contactPhone?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transformProfile = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const CompanyProfileSchema = new mongoose.Schema<ICompanyProfile>(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    companyName: {
      type: String,
      required: true,
      trim: true
    },
    industry: {
      type: String,
      trim: true
    },
    websiteUrl: {
      type: String,
      trim: true
    },
    logoUrl: {
      type: String
    },
    description: {
      type: String
    },
    address: {
      type: String
    },
    contactEmail: {
      type: String,
      trim: true,
      lowercase: true
    },
    contactPhone: {
      type: String,
      trim: true
    }
  },
  {
    collection: "company_profiles",
    timestamps: true,
    toJSON: {
      transform: transformProfile
    },
    toObject: {
      transform: transformProfile
    }
  }
);

CompanyProfileSchema.index({ accountId: 1 }, { unique: true });
CompanyProfileSchema.index({ companyName: "text", industry: "text" });

const CompanyProfile = mongoose.model<ICompanyProfile>(
  "CompanyProfile",
  CompanyProfileSchema
);

export default CompanyProfile;
