import ApiError from "../utils/apiError";
import { errorResponse } from "../utils/apiResponse";
import { getSafeRequestPath, writeOperationalLog } from "../utils/operationalLogger";

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, "Route not found", [], "ROUTE_NOT_FOUND"));
};

const defaultCodeForStatus = (statusCode: number) => ({
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "RATE_LIMITED",
  502: "UPSTREAM_FAILURE",
  503: "SERVICE_UNAVAILABLE",
  504: "GATEWAY_TIMEOUT"
}[statusCode] || "INTERNAL_ERROR");

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let errors = err.errors || [];
  let code = typeof err.code === "string" ? err.code : undefined;
  const isApiError = err instanceof ApiError;

  if (err.code === 11000) {
    statusCode = 409;
    message = "Duplicate field value";
    errors = Object.keys(err.keyValue || {}).map((field) => ({
      field,
      message: `${field} already exists`
    }));
    code = "DUPLICATE_RESOURCE";
  }

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation failed";
    errors = Object.values(err.errors as Record<string, any>).map((error) => ({
      field: error.path,
      message: error.message
    }));
    code = "VALIDATION_ERROR";
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
    code = "INVALID_RESOURCE_ID";
  }

  if (err.name === "MulterError") {
    statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? req.originalUrl.startsWith("/api/cvs")
          ? "CV file is too large"
          : req.originalUrl.startsWith("/api/portfolio")
            ? "Portfolio file must not exceed 5 MB"
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

  if (!isApiError && !["ValidationError", "CastError", "MulterError"].includes(err.name) && err.code !== 11000) {
    statusCode = 500;
    message = "Internal server error";
    errors = [];
    code = "INTERNAL_ERROR";
  } else {
    code ||= defaultCodeForStatus(statusCode);
  }

  if (statusCode >= 400) {
    writeOperationalLog(statusCode >= 500 ? "error" : "info", "http_error", {
      requestId: res.locals?.requestId,
      method: req.method,
      path: getSafeRequestPath(req.originalUrl, req.path),
      statusCode,
      code,
      errorName: err.name || "Error"
    });
  }

  return errorResponse(res, message, statusCode, errors, code);
};

export {
  notFoundHandler,
  errorHandler
};
