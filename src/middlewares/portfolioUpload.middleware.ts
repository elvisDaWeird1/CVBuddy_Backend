import path from "path";
import multer from "multer";

import ApiError from "../utils/apiError";
import {
  MAX_PORTFOLIO_FILE_SIZE_BYTES,
  PORTFOLIO_FILE_MIME_BY_EXTENSION
} from "../utils/uploadFile";

const MOMENT_MEDIA_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4"
];
const EXPERIENCE_COVER_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const EVIDENCE_MIME_TYPES = Object.values(PORTFOLIO_FILE_MIME_BY_EXTENSION).flat();
const ALLOWED_PORTFOLIO_EXTENSIONS = Object.keys(PORTFOLIO_FILE_MIME_BY_EXTENSION);
const ALLOWED_PORTFOLIO_MIME_TYPES = EVIDENCE_MIME_TYPES;

const getMaxPortfolioFileSizeBytes = () => {
  const sizeMb = Number.parseInt(process.env.MAX_PORTFOLIO_FILE_SIZE_MB || "5", 10);
  const normalizedSizeMb = Number.isInteger(sizeMb) && sizeMb > 0
    ? Math.min(sizeMb, 5)
    : 5;

  return Math.min(normalizedSizeMb * 1024 * 1024, MAX_PORTFOLIO_FILE_SIZE_BYTES);
};

const createPortfolioFileFilter = (allowedMimeTypes: string[], description: string) => (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeTypes = PORTFOLIO_FILE_MIME_BY_EXTENSION[extension];
  const hasAllowedMimeType = Boolean(
    expectedMimeTypes && expectedMimeTypes.includes(file.mimetype) && allowedMimeTypes.includes(file.mimetype)
  );

  if (!hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Unsupported portfolio file", [
        {
          field: file.fieldname,
          code: "INVALID_PORTFOLIO_FILE",
          message: description
        }
      ], "INVALID_PORTFOLIO_FILE")
    );
  }

  return cb(null, true);
};

const createPortfolioUpload = (allowedMimeTypes: string[], description: string) => multer({
  storage: multer.memoryStorage(),
  fileFilter: createPortfolioFileFilter(allowedMimeTypes, description),
  limits: {
    fileSize: getMaxPortfolioFileSizeBytes()
  }
});

const getMaxPortfolioMediaCount = () => {
  const configuredCount = Number.parseInt(process.env.MAX_PORTFOLIO_MEDIA_COUNT || "5", 10);
  return Number.isInteger(configuredCount) && configuredCount > 0
    ? Math.min(configuredCount, 5)
    : 5;
};

const uploadMomentMedia = createPortfolioUpload(
  MOMENT_MEDIA_MIME_TYPES,
  "Moment media must be JPG, JPEG, PNG, WEBP, or MP4"
).array(
  "media",
  getMaxPortfolioMediaCount()
);
const uploadPortfolioEvidence = createPortfolioUpload(
  EVIDENCE_MIME_TYPES,
  "Evidence files must be JPG, JPEG, PNG, WEBP, MP4, PDF, DOC, or DOCX"
).single("file");
const uploadExperienceCover = createPortfolioUpload(
  EXPERIENCE_COVER_MIME_TYPES,
  "Experience covers must be JPG, JPEG, PNG, or WEBP images"
).single("cover");

export {
  ALLOWED_PORTFOLIO_MIME_TYPES,
  ALLOWED_PORTFOLIO_EXTENSIONS,
  EXPERIENCE_COVER_MIME_TYPES,
  EVIDENCE_MIME_TYPES,
  MOMENT_MEDIA_MIME_TYPES,
  getMaxPortfolioFileSizeBytes,
  getMaxPortfolioMediaCount,
  uploadExperienceCover,
  uploadMomentMedia,
  uploadPortfolioEvidence
};
