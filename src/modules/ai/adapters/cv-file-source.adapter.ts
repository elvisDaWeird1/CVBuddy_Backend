import fs from "fs";
import path from "path";
import { v2 as cloudinary } from "cloudinary";

import { getCloudinaryConfig } from "../../../config/cloudinary.config";
import ApiError from "../../../utils/apiError";
import type { LocalCvFile } from "../clients/ai-service.client";

type CvDocumentSource = {
  fileUrl?: unknown;
  fileType?: unknown;
};

type CvFileSourceAdapterOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
};

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED_MIME_TYPES = new Set([PDF_MIME, DOCX_MIME]);

const normalizeExtension = (value: string | undefined) => {
  if (!value) {
    return "";
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith(".") ? normalized : "." + normalized;
};

const mimeTypeForExtension = (extension: string) => {
  if (extension === ".pdf") {
    return PDF_MIME;
  }

  if (extension === ".docx") {
    return DOCX_MIME;
  }

  throw new ApiError(415, "CV file type is not supported by the AI service", [
    { field: "file", message: "Only PDF and DOCX files can be sent to the AI service" }
  ]);
};

const getMaxBytes = () => {
  const configured = Number.parseInt(process.env.MAX_CV_FILE_SIZE_MB || "", 10);
  const sizeMb = Number.isInteger(configured) && configured > 0
    ? Math.min(configured, 5)
    : 5;
  return sizeMb * 1024 * 1024;
};

const assertWithinLimit = (size: number, maxBytes: number) => {
  if (size > maxBytes) {
    throw new ApiError(413, "CV file is too large for AI processing", [
      { field: "file", message: "CV file exceeds the configured size limit" }
    ]);
  }
};

const startsWithBytes = (buffer: Buffer, bytes: number[]) =>
  bytes.every((byte, index) => buffer[index] === byte);

const validateFileSignature = (buffer: Buffer, mimeType: string) => {
  if (mimeType === PDF_MIME && buffer.toString("ascii", 0, 4) !== "%PDF") {
    throw new ApiError(415, "CV file content does not match its MIME type", [
      { field: "file", message: "The PDF signature is invalid" }
    ]);
  }

  if (
    mimeType === DOCX_MIME &&
    !startsWithBytes(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
    !startsWithBytes(buffer, [0x50, 0x4b, 0x05, 0x06])
  ) {
    throw new ApiError(415, "CV file content does not match its MIME type", [
      { field: "file", message: "The DOCX ZIP signature is invalid" }
    ]);
  }
};

const normalizeContentType = (value: string | null) =>
  value?.split(";")[0].trim().toLowerCase() || "";

const assertRemoteContentType = (contentType: string, expectedMimeType: string) => {
  if (!contentType || contentType === "application/octet-stream") {
    return;
  }

  if (!ALLOWED_MIME_TYPES.has(contentType) || contentType !== expectedMimeType) {
    throw new ApiError(415, "Remote CV content type is not supported", [
      { field: "file", message: "Remote content type does not match a PDF or DOCX CV" }
    ]);
  }
};

const getSafeFilename = (candidate: string, fileType: unknown, fallback = "cv") => {
  const decoded = (() => {
    try {
      return decodeURIComponent(candidate);
    } catch {
      return candidate;
    }
  })();
  const basename = path.posix.basename(decoded).replace(/[^a-zA-Z0-9._-]/g, "_");
  const extension = normalizeExtension(path.posix.extname(basename))
    || (typeof fileType === "string" ? normalizeExtension(fileType) : "");

  if (!extension) {
    throw new ApiError(415, "CV file type is not supported by the AI service", [
      { field: "file", message: "CV file must have a PDF or DOCX extension" }
    ]);
  }

  const stem = path.posix.basename(basename, path.posix.extname(basename))
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .slice(0, 80);

  return (stem || fallback) + extension;
};

const assertTrustedCloudinaryUrl = (value: string) => {
  const config = getCloudinaryConfig();

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, "CV storage URL is invalid");
  }

  if (parsed.protocol !== "https:" || parsed.hostname.toLowerCase() !== "res.cloudinary.com") {
    throw new ApiError(400, "CV storage URL is not from a trusted Cloudinary host");
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (!config.cloudName || segments[0] !== config.cloudName) {
    throw new ApiError(400, "CV storage URL is not from the configured Cloudinary account");
  }

  return parsed;
};

const cloudinaryUrlFromPublicId = (publicId: string) => {
  const config = getCloudinaryConfig();

  if (!config.cloudName) {
    throw new ApiError(409, "Cloudinary configuration is missing for this CV file");
  }

  if (
    publicId.includes("..") ||
    publicId.includes("\\") ||
    publicId.startsWith("/") ||
    publicId.includes("://")
  ) {
    throw new ApiError(400, "Cloudinary public ID is invalid");
  }

  cloudinary.config({
    cloud_name: config.cloudName,
    secure: true
  });

  return cloudinary.url(publicId, {
    secure: true,
    resource_type: "raw",
    type: "upload"
  });
};

const resolveLocalPath = (fileUrl: string) => {
  const uploadRootName = (process.env.UPLOAD_DIR || "uploads").replace(/\\/g, "/");
  const uploadRoot = path.resolve(process.cwd(), uploadRootName);
  const normalizedUrl = fileUrl.replace(/\\/g, "/");
  const relativePrefix = "/" + uploadRootName.replace(/^\/+|\/+$/g, "") + "/cvs/";

  let filePath: string;
  if (path.isAbsolute(fileUrl) && !fileUrl.startsWith("/")) {
    filePath = path.resolve(fileUrl);
  } else if (normalizedUrl.startsWith(relativePrefix)) {
    const relativeName = normalizedUrl.slice(relativePrefix.length);
    filePath = path.resolve(uploadRoot, "cvs", relativeName);
  } else if (normalizedUrl.startsWith(relativePrefix.slice(1))) {
    const relativeName = normalizedUrl.slice(relativePrefix.length - 1);
    filePath = path.resolve(uploadRoot, "cvs", relativeName);
  } else {
    throw new ApiError(409, "CV file is not available for AI processing", [
      { field: "file", message: "The stored CV is not in local CV storage" }
    ]);
  }

  const relativePath = path.relative(path.resolve(uploadRoot, "cvs"), filePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new ApiError(400, "Invalid stored CV file path");
  }

  return filePath;
};

const readLocalFile = async (
  filePath: string,
  fileType: unknown,
  maxBytes: number
): Promise<LocalCvFile> => {
  let stats: fs.Stats;
  try {
    stats = await fs.promises.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ApiError(409, "CV file is no longer available for AI processing", [
        { field: "file", message: "The stored CV file could not be found" }
      ]);
    }

    throw new ApiError(500, "Unable to access the stored CV file");
  }

  if (!stats.isFile()) {
    throw new ApiError(409, "CV file is not available for AI processing");
  }

  assertWithinLimit(stats.size, maxBytes);
  const filename = getSafeFilename(path.basename(filePath), fileType);
  const mimeType = mimeTypeForExtension(normalizeExtension(path.extname(filename)));

  let bytes: Buffer;
  try {
    bytes = await fs.promises.readFile(filePath);
  } catch {
    throw new ApiError(500, "Unable to read the stored CV file");
  }

  assertWithinLimit(bytes.length, maxBytes);
  validateFileSignature(bytes, mimeType);

  return { bytes, filename, mimeType };
};

const readResponseBodyWithLimit = async (
  response: Response,
  maxBytes: number
) => {
  const contentLength = Number.parseInt(response.headers.get("content-length") || "", 10);
  if (Number.isFinite(contentLength)) {
    assertWithinLimit(contentLength, maxBytes);
  }

  if (!response.body) {
    const bytes = Buffer.from(await response.arrayBuffer());
    assertWithinLimit(bytes.length, maxBytes);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) {
        break;
      }

      const chunk = Buffer.from(next.value);
      total += chunk.length;
      assertWithinLimit(total, maxBytes);
      chunks.push(chunk);
    }

    return Buffer.concat(chunks, total);
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    reader.releaseLock();
  }
};

class CvFileSourceAdapter {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: CvFileSourceAdapterOptions = {}) {
    this.timeoutMs = options.timeoutMs || 60_000;
    this.maxBytes = options.maxBytes || getMaxBytes();
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async readRemoteFile(
    url: URL,
    fileType: unknown
  ): Promise<LocalCvFile> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(url.toString(), {
        method: "GET",
        redirect: "error",
        signal: controller.signal
      });

      if (!response.ok) {
        throw new ApiError(
          response.status === 404 ? 409 : 502,
          "Unable to download CV from trusted storage"
        );
      }

      const filename = getSafeFilename(path.posix.basename(url.pathname), fileType);
      const mimeType = mimeTypeForExtension(normalizeExtension(path.posix.extname(filename)));
      assertRemoteContentType(normalizeContentType(response.headers.get("content-type")), mimeType);
      const bytes = await readResponseBodyWithLimit(response, this.maxBytes);
      validateFileSignature(bytes, mimeType);

      return { bytes, filename, mimeType };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError(504, "CV storage download timed out");
      }

      throw new ApiError(502, "Unable to download CV from trusted storage");
    } finally {
      clearTimeout(timeout);
    }
  }

  async getFile(cv: CvDocumentSource): Promise<LocalCvFile> {
    const fileUrl = typeof cv.fileUrl === "string" ? cv.fileUrl.trim() : "";
    if (!fileUrl) {
      throw new ApiError(409, "CV file is not available for AI processing");
    }

    if (/^https?:\/\//i.test(fileUrl)) {
      const trustedUrl = assertTrustedCloudinaryUrl(fileUrl);
      return this.readRemoteFile(trustedUrl, cv.fileType);
    }

    if (fileUrl.startsWith("/") || fileUrl.startsWith("uploads/") || fileUrl.startsWith("uploads\\")) {
      return readLocalFile(resolveLocalPath(fileUrl), cv.fileType, this.maxBytes);
    }

    const cloudinaryUrl = cloudinaryUrlFromPublicId(fileUrl);
    const trustedUrl = assertTrustedCloudinaryUrl(cloudinaryUrl);
    return this.readRemoteFile(trustedUrl, cv.fileType);
  }
}

export {
  CvFileSourceAdapter,
  type CvDocumentSource,
  type CvFileSourceAdapterOptions
};
