import mongoose from "mongoose";

import { AI_STATUS_VALUES, AI_TYPE_VALUES } from "../../constants/enums";

const isNonEmptyString = (value) => {
  return typeof value === "string" && value.trim().length > 0;
};

const validateOptionalString = (errors, body, field, maxLength = 5000) => {
  if (body[field] === undefined) return;

  if (typeof body[field] !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }

  if (body[field].trim().length > maxLength) {
    errors.push({ field, message: `${field} must be at most ${maxLength} characters` });
  }
};

const validateOptionalEnum = (errors, body, field, values) => {
  if (body[field] === undefined) return;
  if (!values.includes(body[field])) {
    errors.push({ field, message: `${field} must be one of: ${values.join(", ")}` });
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
  validateOptionalString(errors, body, "industrySlug", 100);
  validateOptionalString(errors, body, "verticalSlug", 150);
  validateOptionalString(errors, body, "llmModel", 150);
  validateOptionalString(errors, body, "sourceLang", 20);

  if (body.cvText !== undefined && !isNonEmptyString(body.cvText)) {
    errors.push({ field: "cvText", message: "cvText cannot be empty" });
  }

  validateOptionalEnum(errors, body, "companyModel", ["corporate", "startup_agency"]);
  validateOptionalEnum(errors, body, "language", ["vi", "en", "both"]);
  validateOptionalEnum(errors, body, "tier", ["free", "subscription"]);
  validateOptionalEnum(errors, body, "extractionMode", ["local", "ai", "hybrid"]);
  validateOptionalEnum(errors, body, "translationMode", ["literal", "cv_native"]);

  if (body.strictIndustryMatch !== undefined && typeof body.strictIndustryMatch !== "boolean") {
    errors.push({ field: "strictIndustryMatch", message: "strictIndustryMatch must be a boolean" });
  }

  if (body.jdExtract !== undefined &&
      (typeof body.jdExtract !== "object" || body.jdExtract === null || Array.isArray(body.jdExtract))) {
    errors.push({ field: "jdExtract", message: "jdExtract must be an object" });
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
    errors.push({ field: "aiType", message: `aiType must be one of: ${AI_TYPE_VALUES.join(", ")}` });
  }

  if (status !== undefined && !(AI_STATUS_VALUES as readonly string[]).includes(status as string)) {
    errors.push({ field: "status", message: `status must be one of: ${AI_STATUS_VALUES.join(", ")}` });
  }

  return errors;
};

export {
  cvAiRequestValidation,
  aiResultIdValidation,
  aiResultsQueryValidation
};
