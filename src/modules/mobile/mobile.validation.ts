import { VISIBILITY_VALUES } from "../../constants/enums";

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

const validateOptionalDate = (errors, value) => {
  if (value === undefined || value === "") {
    return;
  }

  if (Number.isNaN(Date.parse(value))) {
    errors.push({ field: "eventDate", message: "eventDate must be a valid date" });
  }
};

const uploadPortfolioPhotoValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!req.file) {
    errors.push({ field: "image", message: "Image file is required" });
  }

  validateOptionalString(errors, body, "title", 150);
  validateOptionalString(errors, body, "description", 5000);
  validateOptionalString(errors, body, "eventName", 150);
  validateOptionalString(errors, body, "eventRole", 150);
  validateOptionalDate(errors, body.eventDate);
  validateOptionalString(errors, body, "location", 255);

  if (
    body.visibility !== undefined &&
    !(VISIBILITY_VALUES as readonly string[]).includes(body.visibility)
  ) {
    errors.push({
      field: "visibility",
      message: `visibility must be one of: ${VISIBILITY_VALUES.join(", ")}`
    });
  }

  return errors;
};

export {
  uploadPortfolioPhotoValidation
};
