import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

import ApiError from "../utils/apiError";

const ALLOWED_CV_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];
const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];

const getUploadRoot = () => {
  return process.env.UPLOAD_DIR || "uploads";
};

const getCvUploadDirectory = () => {
  return path.join(process.cwd(), getUploadRoot(), "cvs");
};

const getPortfolioUploadDirectory = () => {
  return path.join(process.cwd(), getUploadRoot(), "portfolio");
};

const ensureDirectoryExists = (directory) => {
  fs.mkdirSync(directory, { recursive: true });
};

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

const getStoredCvFileUrl = (filename) => {
  return `/${getUploadRoot().replace(/\\/g, "/")}/cvs/${filename}`;
};

const getStoredPortfolioImageUrl = (filename) => {
  return `/${getUploadRoot().replace(/\\/g, "/")}/portfolio/${filename}`;
};

const getSafeStoredFilename = (originalname, fallbackName) => {
  const extension = path.extname(originalname).toLowerCase();
  const safeBaseName = path
    .basename(originalname, extension)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;

  return `${safeBaseName || fallbackName}-${uniqueSuffix}${extension}`;
};

const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDirectory = getCvUploadDirectory();
    ensureDirectoryExists(uploadDirectory);
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, getSafeStoredFilename(file.originalname, "cv"));
  }
});

const portfolioImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDirectory = getPortfolioUploadDirectory();
    ensureDirectoryExists(uploadDirectory);
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    cb(null, getSafeStoredFilename(file.originalname, "portfolio-photo"));
  }
});

const cvFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_CV_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_CV_MIME_TYPES.includes(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Only PDF and DOCX CV files are allowed", [
        {
          field: "file",
          message: "File must be .pdf or .docx"
        }
      ])
    );
  }

  return cb(null, true);
};

const portfolioImageFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const hasAllowedExtension = ALLOWED_IMAGE_EXTENSIONS.includes(extension);
  const hasAllowedMimeType = ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype);

  if (!hasAllowedExtension || !hasAllowedMimeType) {
    return cb(
      new ApiError(400, "Only JPG, JPEG, PNG, and WEBP image files are allowed", [
        {
          field: "image",
          message: "File must be .jpg, .jpeg, .png, or .webp"
        }
      ])
    );
  }

  return cb(null, true);
};

const uploadCv = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: getMaxCvFileSizeBytes()
  }
}).single("file");

const uploadPortfolioImage = multer({
  storage: portfolioImageStorage,
  fileFilter: portfolioImageFileFilter,
  limits: {
    fileSize: getMaxImageFileSizeBytes()
  }
}).single("image");

export {
  uploadCv,
  uploadPortfolioImage,
  getStoredCvFileUrl,
  getStoredPortfolioImageUrl
};
