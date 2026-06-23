const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");

const ApiError = require("../utils/apiError");

const ALLOWED_CV_EXTENSIONS = [".pdf", ".docx"];
const ALLOWED_CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
];

const getUploadRoot = () => {
  return process.env.UPLOAD_DIR || "uploads";
};

const getCvUploadDirectory = () => {
  return path.join(process.cwd(), getUploadRoot(), "cvs");
};

const ensureDirectoryExists = (directory) => {
  fs.mkdirSync(directory, { recursive: true });
};

const getMaxCvFileSizeBytes = () => {
  const sizeMb = Number.parseInt(process.env.MAX_CV_FILE_SIZE_MB || "10", 10);
  const normalizedSizeMb = Number.isInteger(sizeMb) && sizeMb > 0 ? sizeMb : 10;

  return normalizedSizeMb * 1024 * 1024;
};

const getStoredCvFileUrl = (filename) => {
  return `/${getUploadRoot().replace(/\\/g, "/")}/cvs/${filename}`;
};

const cvStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDirectory = getCvUploadDirectory();
    ensureDirectoryExists(uploadDirectory);
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, extension)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50);
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}`;
    const filename = `${safeBaseName || "cv"}-${uniqueSuffix}${extension}`;

    cb(null, filename);
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

const uploadCv = multer({
  storage: cvStorage,
  fileFilter: cvFileFilter,
  limits: {
    fileSize: getMaxCvFileSizeBytes()
  }
}).single("file");

module.exports = {
  uploadCv,
  getStoredCvFileUrl
};
