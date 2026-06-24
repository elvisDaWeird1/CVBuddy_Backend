import mongoose from "mongoose";

import { AI_STATUS_VALUES, AI_TYPE_VALUES } from "../../constants/enums";

const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const validateOptionalString = (errors, body, field, maxLength = 5000) => {
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

const cvAiRequestValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!mongoose.Types.ObjectId.isValid(req.params.cvId)) {
    errors.push({ field: "cvId", message: "Invalid CV id" });
  }

  validateOptionalString(errors, body, "targetRole", 150);
  validateOptionalString(errors, body, "cvText", 20000);

  if (body.cvText !== undefined && !isNonEmptyString(body.cvText)) {
    errors.push({ field: "cvText", message: "cvText cannot be empty" });
  }

  return errors;
};

const aiResultIdValidation = (req) => {
  const errors = [];

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    errors.push({ field: "id", message: "Invalid AI result id" });
  }

  return errors;
};

const aiResultsQueryValidation = (req) => {
  const errors = [];
  const { aiType, status } = req.query || {};

  if (aiType !== undefined && !(AI_TYPE_VALUES as readonly string[]).includes(aiType as string)) {
    errors.push({
      field: "aiType",
      message: `aiType must be one of: ${AI_TYPE_VALUES.join(", ")}`
    });
  }

  if (status !== undefined && !(AI_STATUS_VALUES as readonly string[]).includes(status as string)) {
    errors.push({
      field: "status",
      message: `status must be one of: ${AI_STATUS_VALUES.join(", ")}`
    });
  }

  return errors;
};

export {
  cvAiRequestValidation,
  aiResultIdValidation,
  aiResultsQueryValidation
};
