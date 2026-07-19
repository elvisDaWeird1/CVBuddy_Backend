import path from "path";

import ApiError from "./apiError";

const MAX_CV_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const startsWithBytes = (buffer: Buffer, bytes: number[]) =>
  bytes.every((byte, index) => buffer[index] === byte);

const errorWithCode = (
  statusCode: number,
  code: string,
  message: string,
  field: string
) => new ApiError(statusCode, message, [{ field, code, message }], code);

const sanitizeOriginalFilename = (value: string, fallback = "uploaded-file") => {
  const normalized = (value || "")
    .replace(/\\/g, "/")
    .split("/")
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  return (normalized || fallback).slice(0, 255);
};

const assertFileBuffer = (
  file: Express.Multer.File | undefined,
  field: string
): Express.Multer.File => {
  if (!file) {
    throw errorWithCode(400, "FILE_REQUIRED", "File is required", field);
  }

  if (!file.buffer || file.size <= 0 || file.buffer.length <= 0) {
    throw errorWithCode(400, "FILE_EMPTY", "Uploaded file is empty", field);
  }

  return file;
};

const assertImageFileContent = (
  file: Express.Multer.File | undefined,
  field = "image"
) => {
  file = assertFileBuffer(file, field);

  const extension = path.extname(sanitizeOriginalFilename(file.originalname)).toLowerCase();
  const signatures = {
    "image/jpeg": startsWithBytes(file.buffer, [0xff, 0xd8, 0xff]),
    "image/png": startsWithBytes(file.buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    "image/webp":
      startsWithBytes(file.buffer, [0x52, 0x49, 0x46, 0x46]) &&
      file.buffer.toString("ascii", 8, 12) === "WEBP"
  };
  const extensionsByMime = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/webp": [".webp"]
  };
  const supportedMime = Object.prototype.hasOwnProperty.call(signatures, file.mimetype);
  const matchingExtension =
    supportedMime && extensionsByMime[file.mimetype].includes(extension);

  if (!supportedMime || !matchingExtension || !signatures[file.mimetype]) {
    throw errorWithCode(
      400,
      "INVALID_IMAGE_FILE",
      "Image content, extension, or MIME type is invalid",
      field
    );
  }
};

const assertCvFileContent = (file: Express.Multer.File | undefined) => {
  file = assertFileBuffer(file, "file");

  const extension = path.extname(sanitizeOriginalFilename(file.originalname)).toLowerCase();
  const isPdf = file.buffer.toString("ascii", 0, 4) === "%PDF";
  const isDoc = startsWithBytes(
    file.buffer,
    [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]
  );
  const isZip =
    startsWithBytes(file.buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWithBytes(file.buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWithBytes(file.buffer, [0x50, 0x4b, 0x07, 0x08]);
  const isDocx =
    isZip &&
    (file.buffer.includes(Buffer.from("[Content_Types].xml")) ||
      file.buffer.includes(Buffer.from("word/")));

  const valid =
    (extension === ".pdf" && file.mimetype === "application/pdf" && isPdf) ||
    (extension === ".doc" &&
      ["application/msword", "application/octet-stream"].includes(file.mimetype) &&
      isDoc) ||
    (extension === ".docx" &&
      [
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream"
      ].includes(file.mimetype) &&
      isDocx);

  if (!valid) {
    throw errorWithCode(
      400,
      "INVALID_CV_FILE",
      "CV content, extension, or MIME type is invalid",
      "file"
    );
  }
};

export {
  MAX_CV_FILE_SIZE_BYTES,
  MAX_IMAGE_FILE_SIZE_BYTES,
  assertCvFileContent,
  assertFileBuffer,
  assertImageFileContent,
  sanitizeOriginalFilename
};
