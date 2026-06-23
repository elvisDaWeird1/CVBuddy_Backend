import mongoose from "mongoose";

import { CV_LANGUAGE_VALUES } from "../../constants/enums";

const isBlank = (value) => {
  return typeof value !== "string" || value.trim().length === 0;
};

const uploadCvValidation = (req) => {
  const errors = [];
  const { title, language } = req.body || {};

  if (!req.file) {
    errors.push({ field: "file", message: "CV file is required" });
  }

  if (isBlank(title)) {
    errors.push({ field: "title", message: "Title is required" });
  } else if (title.trim().length > 150) {
    errors.push({
      field: "title",
      message: "Title must be at most 150 characters"
    });
  }

  if (language !== undefined && !CV_LANGUAGE_VALUES.includes(language)) {
    errors.push({
      field: "language",
      message: `Language must be one of: ${CV_LANGUAGE_VALUES.join(", ")}`
    });
  }

  return errors;
};

const cvIdValidation = (req) => {
  const errors = [];

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    errors.push({ field: "id", message: "Invalid CV id" });
  }

  return errors;
};

export {
  uploadCvValidation,
  cvIdValidation
};
