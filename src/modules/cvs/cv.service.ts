import path from "path";

import ApiError from "../../utils/apiError";
import { CV_LANGUAGES, CV_STATUSES } from "../../constants/enums";
import {
  deleteCloudinaryResource,
  uploadCvFile
} from "../uploads/upload.service";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CVDocument from "./cvDocument.model";
import { extractTextFromCv } from "./cvTextExtractor.service";

type SerializeCvOptions = {
  includeExtractedText?: boolean;
};

const serializeCv = (cv, options: SerializeCvOptions = {}) => {
  if (!cv) {
    return null;
  }

  const payload: {
    id: string;
    applicantProfileId: string;
    title: string;
    fileUrl: string;
    filePublicId?: string;
    fileResourceType?: string;
    fileType: string;
    fileSize: number;
    language: string;
    status: string;
    uploadedAt: Date;
    createdAt: Date;
    updatedAt: Date;
    extractedText?: string;
  } = {
    id: cv._id.toString(),
    applicantProfileId: cv.applicantProfileId.toString(),
    title: cv.title,
    fileUrl: cv.fileUrl,
    fileType: cv.fileType,
    fileSize: cv.fileSize,
    language: cv.language,
    status: cv.status,
    uploadedAt: cv.uploadedAt,
    createdAt: cv.createdAt,
    updatedAt: cv.updatedAt
  };

  if (cv.filePublicId) {
    payload.filePublicId = cv.filePublicId;
  }

  if (cv.fileResourceType) {
    payload.fileResourceType = cv.fileResourceType;
  }

  if (options.includeExtractedText) {
    payload.extractedText = cv.extractedText || "";
  }

  return payload;
};

const getApplicantProfileForAccount = async (accountId) => {
  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return profile;
};

const getFileType = (file) => {
  return path.extname(file.originalname).replace(".", "").toLowerCase();
};

const createCv = async ({ accountId, file, payload }) => {
  if (!file) {
    throw new ApiError(400, "CV file is required", [
      { field: "file", message: "CV file is required" }
    ]);
  }

  let uploadedFile: Awaited<ReturnType<typeof uploadCvFile>> | undefined;

  try {
    const applicantProfile = await getApplicantProfileForAccount(accountId);

    let extractedText = "";

    try {
      extractedText = await extractTextFromCv(file);
    } catch (error) {
      extractedText = "";
    }

    uploadedFile = await uploadCvFile({ accountId, file });

    const cv = await CVDocument.create({
      applicantProfileId: applicantProfile._id,
      title: payload.title.trim(),
      fileUrl: uploadedFile.url,
      filePublicId: uploadedFile.publicId,
      fileResourceType: uploadedFile.resourceType,
      fileType: getFileType(file),
      fileSize: uploadedFile.bytes || file.size,
      language: payload.language || CV_LANGUAGES.VI,
      extractedText,
      status: CV_STATUSES.ACTIVE
    });

    return serializeCv(cv, { includeExtractedText: true });
  } catch (error) {
    if (uploadedFile) {
      await deleteCloudinaryResource(
        uploadedFile.publicId,
        uploadedFile.resourceType
      ).catch(() => undefined);
    }

    throw error;
  }
};

const getMyCvs = async (accountId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);

  const cvs = await CVDocument.find({
    applicantProfileId: applicantProfile._id,
    status: CV_STATUSES.ACTIVE
  }).sort({ uploadedAt: -1 });

  return cvs.map((cv) => serializeCv(cv));
};

const getMyCvById = async (accountId, cvId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);

  const cv = await CVDocument.findOne({
    _id: cvId,
    applicantProfileId: applicantProfile._id,
    status: CV_STATUSES.ACTIVE
  });

  if (!cv) {
    throw new ApiError(404, "CV not found");
  }

  return serializeCv(cv, { includeExtractedText: true });
};

const deleteMyCvById = async (accountId, cvId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);

  const cv = await CVDocument.findOne({
    _id: cvId,
    applicantProfileId: applicantProfile._id,
    status: CV_STATUSES.ACTIVE
  });

  if (!cv) {
    throw new ApiError(404, "CV not found");
  }

  if (cv.filePublicId) {
    await deleteCloudinaryResource(
      cv.filePublicId,
      cv.fileResourceType || "raw"
    );
  }

  cv.status = CV_STATUSES.DELETED;
  await cv.save();
};

export {
  createCv,
  getMyCvs,
  getMyCvById,
  deleteMyCvById,
  serializeCv
};
