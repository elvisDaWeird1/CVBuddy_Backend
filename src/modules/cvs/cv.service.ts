import path from "path";

import ApiError from "../../utils/apiError";
import { removeFileIfExists } from "../../utils/file";
import { CV_LANGUAGES, CV_STATUSES } from "../../constants/enums";
import { getStoredCvFileUrl } from "../../middlewares/upload.middleware";
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

  try {
    const applicantProfile = await getApplicantProfileForAccount(accountId);

    let extractedText = "";

    try {
      extractedText = await extractTextFromCv(file);
    } catch (error) {
      extractedText = "";
    }

    const cv = await CVDocument.create({
      applicantProfileId: applicantProfile._id,
      title: payload.title.trim(),
      fileUrl: getStoredCvFileUrl(file.filename),
      fileType: getFileType(file),
      fileSize: file.size,
      language: payload.language || CV_LANGUAGES.VI,
      extractedText,
      status: CV_STATUSES.ACTIVE
    });

    return serializeCv(cv, { includeExtractedText: true });
  } catch (error) {
    await removeFileIfExists(file.path).catch(() => undefined);
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
