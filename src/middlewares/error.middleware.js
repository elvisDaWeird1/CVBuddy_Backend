const ApiError = require("../utils/apiError");
const { errorResponse } = require("../utils/apiResponse");

const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
};

const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";
  const errors = err.errors || [];

  if (process.env.NODE_ENV !== "production") {
    console.error(err);
  }

  return errorResponse(res, message, statusCode, errors);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
