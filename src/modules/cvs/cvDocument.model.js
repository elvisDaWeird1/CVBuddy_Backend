const mongoose = require("mongoose");
const {
  CV_LANGUAGES,
  CV_LANGUAGE_VALUES,
  CV_STATUSES,
  CV_STATUS_VALUES
} = require("../../constants/enums");

const transformCvDocument = (doc, ret) => {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
};

const CVDocumentSchema = new mongoose.Schema(
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
    fileUrl: {
      type: String,
      required: true
    },
    fileType: {
      type: String,
      trim: true
    },
    fileSize: {
      type: Number
    },
    language: {
      type: String,
      enum: CV_LANGUAGE_VALUES,
      default: CV_LANGUAGES.VI,
      required: true
    },
    extractedText: {
      type: String
    },
    status: {
      type: String,
      enum: CV_STATUS_VALUES,
      default: CV_STATUSES.ACTIVE,
      required: true
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
      required: true
    }
  },
  {
    collection: "cv_documents",
    timestamps: true,
    toJSON: {
      transform: transformCvDocument
    },
    toObject: {
      transform: transformCvDocument
    }
  }
);

CVDocumentSchema.index({ applicantProfileId: 1 });
CVDocumentSchema.index({ status: 1 });
CVDocumentSchema.index({ uploadedAt: -1 });

module.exports = mongoose.model("CVDocument", CVDocumentSchema);
