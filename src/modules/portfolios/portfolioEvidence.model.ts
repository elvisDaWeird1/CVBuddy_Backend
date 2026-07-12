import mongoose, { Document, Types } from "mongoose";

import {
  PORTFOLIO_EVIDENCE_TYPE_VALUES,
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUS_VALUES,
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES
} from "../../constants/enums";

export interface IPortfolioEvidence extends Document {
  applicantId: Types.ObjectId;
  experienceId: Types.ObjectId;
  type: string;
  title: string;
  description?: string;
  url?: string;
  assetId?: Types.ObjectId;
  verificationStatus: string;
  createdAt: Date;
  updatedAt: Date;
}

const PortfolioEvidenceSchema = new mongoose.Schema<IPortfolioEvidence>(
  {
    applicantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Account",
      required: true
    },
    experienceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PortfolioExperience",
      required: true
    },
    type: { type: String, enum: PORTFOLIO_EVIDENCE_TYPE_VALUES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },
    url: { type: String, trim: true },
    assetId: { type: mongoose.Schema.Types.ObjectId, ref: "PortfolioAsset" },
    verificationStatus: {
      type: String,
      enum: PORTFOLIO_EVIDENCE_VERIFICATION_STATUS_VALUES,
      default: PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.UNVERIFIED,
      required: true
    }
  },
  {
    collection: "portfolio_evidence",
    timestamps: true
  }
);

PortfolioEvidenceSchema.pre("validate", function (next) {
  if (!this.url && !this.assetId) {
    this.invalidate("url", "Evidence must contain a URL or an asset");
  }
  next();
});

PortfolioEvidenceSchema.index({ experienceId: 1, createdAt: -1 });

const PortfolioEvidence = mongoose.model<IPortfolioEvidence>(
  "PortfolioEvidence",
  PortfolioEvidenceSchema
);

export default PortfolioEvidence;
