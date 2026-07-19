import path from "path";
import multer from "multer";

import ApiError from "../utils/apiError";

const ALLOWED_PORTFOLIO_EXTENSIONS = [
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".mp4",
  ".pdf",
  ".doc",
  ".docx"
];

const ALLOWED_PORTFOLIO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const getMaxPortfolioFileSizeBytes = () => {
  const sizeMb = Number.parseInt(process.env.MAX_PORTFOLIO_FILE_SIZE_MB || "5", 10);
  const normalizedSizeMb = Number.isInteger(sizeMb) && sizeMb > 0
    ? Math.min(sizeMb, 5)
    : 5;

  return normalizedSizeMb * 1024 * 1024;
};

const portfolioFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_PORTFOLIO_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_PORTFOLIO_MIME_TYPES.includes(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Unsupported portfolio file", [
        {
          field: file.fieldname,
          message: "Supported files are JPG, PNG, WEBP, MP4, PDF, DOC and DOCX"
        }
      ])
    );
  }

  return cb(null, true);
};

const portfolioUpload = multer({
  storage: multer.memoryStorage(),
  fileFilter: portfolioFileFilter,
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

const uploadMomentMedia = portfolioUpload.array(
  "media",
  getMaxPortfolioMediaCount()
);
const uploadPortfolioEvidence = portfolioUpload.single("file");
const uploadExperienceCover = portfolioUpload.single("cover");

export {
  ALLOWED_PORTFOLIO_MIME_TYPES,
  ALLOWED_PORTFOLIO_EXTENSIONS,
  uploadExperienceCover,
  uploadMomentMedia,
  uploadPortfolioEvidence
};
