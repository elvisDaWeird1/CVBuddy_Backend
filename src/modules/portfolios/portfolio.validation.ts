import mongoose from "mongoose";

import { VISIBILITY_VALUES } from "../../constants/enums";

const isBlank = (value) => {
  return typeof value !== "string" || value.trim().length === 0;
};

const validateOptionalString = (errors, body, field, maxLength = 1000) => {
  if (body[field] === undefined) {
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }

  if (body[field].trim().length > maxLength) {
    errors.push({
      field,
      message: `${field} must be at most ${maxLength} characters`
    });
  }
};

const validateVisibility = (errors, visibility) => {
  if (visibility === undefined) {
    return;
  }

  if (!(VISIBILITY_VALUES as readonly string[]).includes(visibility)) {
    errors.push({
      field: "visibility",
      message: `visibility must be one of: ${VISIBILITY_VALUES.join(", ")}`
    });
  }
};

const validateOptionalDate = (errors, value) => {
  if (value === undefined || value === "") {
    return;
  }

  if (Number.isNaN(Date.parse(value))) {
    errors.push({ field: "eventDate", message: "eventDate must be a valid date" });
  }
};

const createPortfolioValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (isBlank(body.title)) {
    errors.push({ field: "title", message: "Title is required" });
  } else if (body.title.trim().length > 150) {
    errors.push({ field: "title", message: "Title must be at most 150 characters" });
  }

  validateOptionalString(errors, body, "introduction", 5000);
  validateOptionalString(errors, body, "coverImageUrl", 1000);
  validateVisibility(errors, body.visibility);

  return errors;
};

const updatePortfolioValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  validateOptionalString(errors, body, "title", 150);
  validateOptionalString(errors, body, "introduction", 5000);
  validateOptionalString(errors, body, "coverImageUrl", 1000);
  validateVisibility(errors, body.visibility);

  if (body.title !== undefined && isBlank(body.title)) {
    errors.push({ field: "title", message: "Title cannot be empty" });
  }

  return errors;
};

const portfolioIdValidation = (req) => {
  const errors = [];

  if (!mongoose.Types.ObjectId.isValid(req.params.portfolioId)) {
    errors.push({ field: "portfolioId", message: "Invalid portfolio id" });
  }

  return errors;
};

const createPortfolioItemValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (isBlank(body.title)) {
    errors.push({ field: "title", message: "Title is required" });
  } else if (body.title.trim().length > 150) {
    errors.push({ field: "title", message: "Title must be at most 150 characters" });
  }

  validateOptionalString(errors, body, "description", 5000);
  validateOptionalString(errors, body, "imageUrl", 1000);
  validateOptionalString(errors, body, "imagePublicId", 255);
  validateOptionalString(errors, body, "eventName", 150);
  validateOptionalString(errors, body, "eventRole", 150);
  validateOptionalDate(errors, body.eventDate);
  validateOptionalString(errors, body, "location", 255);
  validateVisibility(errors, body.visibility);

  return errors;
};

const updatePortfolioItemValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    errors.push({ field: "id", message: "Invalid portfolio item id" });
  }

  validateOptionalString(errors, body, "title", 150);
  validateOptionalString(errors, body, "description", 5000);
  validateOptionalString(errors, body, "imageUrl", 1000);
  validateOptionalString(errors, body, "imagePublicId", 255);
  validateOptionalString(errors, body, "eventName", 150);
  validateOptionalString(errors, body, "eventRole", 150);
  validateOptionalDate(errors, body.eventDate);
  validateOptionalString(errors, body, "location", 255);
  validateVisibility(errors, body.visibility);

  if (body.title !== undefined && isBlank(body.title)) {
    errors.push({ field: "title", message: "Title cannot be empty" });
  }

  return errors;
};

const portfolioItemIdValidation = (req) => {
  const errors = [];

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    errors.push({ field: "id", message: "Invalid portfolio item id" });
  }

  return errors;
};

export {
  createPortfolioValidation,
  updatePortfolioValidation,
  portfolioIdValidation,
  createPortfolioItemValidation,
  updatePortfolioItemValidation,
  portfolioItemIdValidation
};
