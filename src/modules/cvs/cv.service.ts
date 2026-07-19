import path from "path";

import ApiError from "../../utils/apiError";
import { CV_LANGUAGES, CV_STATUSES } from "../../constants/enums";
import { sanitizeOriginalFilename } from "../../utils/uploadFile";
import {
  deleteCloudinaryResource,
  uploadCvFile
} from "../uploads/upload.service";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CVDocument from "./cvDocument.model";
import AIResult from "../ai/aiResult.model";
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
    originalName?: string;
    mimeType?: string;
    size?: number;
    previewAvailable: boolean;
    downloadAvailable: boolean;
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
    previewAvailable: cv.fileType === "pdf",
    downloadAvailable: Boolean(cv.fileUrl),
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

  if (cv.originalName) {
    payload.originalName = cv.originalName;
  }

  if (cv.mimeType) {
    payload.mimeType = cv.mimeType;
  }

  if (cv.size !== undefined) {
    payload.size = cv.size;
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

const getCvMimeType = (fileType: string) => {
  if (fileType === "pdf") return "application/pdf";
  if (fileType === "doc") return "application/msword";
  return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
};

const buildCvTitle = (originalName: string) => {
  const safeName = sanitizeOriginalFilename(originalName, "cv");
  const extension = path.extname(safeName);
  return (path.basename(safeName, extension).trim() || "cv").slice(0, 150);
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
      title: typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : buildCvTitle(file.originalname),
      fileUrl: uploadedFile.url,
      filePublicId: uploadedFile.publicId,
      fileResourceType: uploadedFile.resourceType,
      fileType: getFileType(file),
      fileSize: uploadedFile.bytes || file.size,
      originalName: sanitizeOriginalFilename(file.originalname, "cv"),
      mimeType: getCvMimeType(getFileType(file)),
      size: file.size,
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

  if (await AIResult.exists({ cvDocumentId: cv._id })) {
    throw new ApiError(
      409,
      "CV is referenced by AI results and cannot be deleted",
      [{ field: "cvId", code: "CV_IN_USE", message: "Delete the related AI results first" }],
      "CV_IN_USE"
    );
  }

  cv.status = CV_STATUSES.DELETED;
  await cv.save();

  if (cv.filePublicId) {
    await deleteCloudinaryResource(
      cv.filePublicId,
      cv.fileResourceType || "raw"
    ).catch((error) => {
      console.error("Deleted CV asset cleanup failed", {
        cvId: cv._id.toString(),
        message: error instanceof Error ? error.message : String(error)
      });
    });
  }
};

export {
  createCv,
  getMyCvs,
  getMyCvById,
  deleteMyCvById,
  serializeCv,
  buildCvTitle
};
