import mongoose, { Document, Types } from "mongoose";

export interface IApplicantProfile extends Document {
  accountId: Types.ObjectId;
  fullName: string;
  phone?: string;
  university?: string;
  major?: string;
  location?: string;
  headline?: string;
  summary?: string;
  careerGoal?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const transformProfile = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const ApplicantProfileSchema = new mongoose.Schema<IApplicantProfile>(
  {
    accountId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      trim: true
    },
    university: {
      type: String,
      trim: true
    },
    major: {
      type: String,
      trim: true
    },
    location: {
      type: String,
      trim: true
    },
    headline: {
      type: String,
      trim: true
    },
    summary: {
      type: String
    },
    careerGoal: {
      type: String
    },
    avatarUrl: {
      type: String
    }
  },
  {
    collection: "applicant_profiles",
    timestamps: true,
    toJSON: {
      transform: transformProfile
    },
    toObject: {
      transform: transformProfile
    }
  }
);

ApplicantProfileSchema.index({ accountId: 1 }, { unique: true });
ApplicantProfileSchema.index({
  fullName: "text",
  university: "text",
  major: "text"
});

const ApplicantProfile = mongoose.model<IApplicantProfile>(
  "ApplicantProfile",
  ApplicantProfileSchema
);

export default ApplicantProfile;
