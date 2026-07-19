import ApiError from "../utils/apiError";
import { errorResponse } from "../utils/apiResponse";

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || [];
  let code = typeof err.code === "string" ? err.code : undefined;

  if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value";
    errors = Object.keys(err.keyValue || {}).map((field) => ({
      field,
      message: `${field} already exists`
    }));
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors as Record<string, any>).map((error) => ({
      field: error.path,
      message: error.message
    }));
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid resource id";
    errors = [
      {
        field: err.path,
        message: err.message
      }
    ];
  }

  if (err.name === "MulterError") {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? req.originalUrl.startsWith("/api/cvs")
          ? "CV file is too large"
          : "Uploaded file is too large"
        : err.message || "File upload failed";
    code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : 'UPLOAD_INVALID';
    errors = [
      {
        field: err.field || "file",
        message
      }
    ];
  }

  if (process.env.NODE_ENV !== "production" && statusCode >= 500) {
    console.error(err);
  }

  return errorResponse(res, message, statusCode, errors, code);
};

export {
  notFoundHandler,
  errorHandler
};
