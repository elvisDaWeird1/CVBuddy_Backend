import path from "path";
import multer from "multer";

import ApiError from "../utils/apiError";

const ALLOWED_CV_EXTENSIONS = [".pdf", ".doc", ".docx"];
const ALLOWED_CV_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const getMaxCvFileSizeBytes = () => {
  const sizeMb = Number.parseInt(process.env.MAX_CV_FILE_SIZE_MB || "10", 10);
  const normalizedSizeMb = Number.isInteger(sizeMb) && sizeMb > 0 ? sizeMb : 10;

  return normalizedSizeMb * 1024 * 1024;
};

const getMaxImageFileSizeBytes = () => {
  const sizeMb = Number.parseInt(process.env.MAX_IMAGE_FILE_SIZE_MB || "5", 10);
  const normalizedSizeMb = Number.isInteger(sizeMb) && sizeMb > 0 ? sizeMb : 5;

  return normalizedSizeMb * 1024 * 1024;
};

const memoryStorage = multer.memoryStorage();

const cvFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_CV_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_CV_MIME_TYPES.includes(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Only PDF, DOC, and DOCX CV files are allowed", [
        {
          field: "file",
          message: "File must be .pdf, .doc, or .docx"
        }
      ])
    );
  }

  return cb(null, true);
};

const imageFileFilter = (fieldName) => (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Only JPG, JPEG, PNG, and WEBP image files are allowed", [
        {
          field: fieldName,
          message: "File must be .jpg, .jpeg, .png, or .webp"
        }
      ])
    );
  }

  return cb(null, true);
};

const uploadCv = multer({
  storage: memoryStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: getMaxCvFileSizeBytes()
  }
}).single("file");

const uploadAvatarImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter("avatar"),
  limits: {
    fileSize: getMaxImageFileSizeBytes()
  }
}).single("avatar");

const uploadPortfolioImage = multer({
  storage: memoryStorage,
  fileFilter: imageFileFilter("image"),
  limits: {
    fileSize: getMaxImageFileSizeBytes()
  }
}).single("image");

export {
  uploadAvatarImage,
  uploadCv,
  uploadPortfolioImage
};
