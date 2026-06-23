const ALLOWED_PROFILE_FIELDS = [
  "fullName",
  "phone",
  "university",
  "major",
  "location",
  "headline",
  "summary",
  "careerGoal",
  "avatarUrl"
];

const FORBIDDEN_PROFILE_FIELDS = [
  "accountId",
  "role",
  "status",
  "password",
  "passwordHash"
];

const isPlainObject = (value) => {
  return value !== null && typeof value === "object" && !Array.isArray(value);
};

const isBlank = (value) => {
  return typeof value !== "string" || value.trim().length === 0;
};

const validateOptionalString = (errors, body, field, options = {}) => {
  if (body[field] === undefined) {
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }

  if (options.requiredWhenPresent && isBlank(body[field])) {
    errors.push({ field, message: `${field} cannot be empty` });
    return;
  }

  if (options.maxLength && body[field].trim().length > options.maxLength) {
    errors.push({
      field,
      message: `${field} must be at most ${options.maxLength} characters`
    });
  }
};

const validateOptionalUrl = (errors, body, field) => {
  if (body[field] === undefined || body[field] === "") {
    return;
  }

  if (typeof body[field] !== "string") {
    errors.push({ field, message: `${field} must be a string` });
    return;
  }

  try {
    const url = new URL(body[field]);

    if (!["http:", "https:"].includes(url.protocol)) {
      errors.push({ field, message: `${field} must be a valid URL` });
    }
  } catch (error) {
    errors.push({ field, message: `${field} must be a valid URL` });
  }
};

const updateApplicantProfileValidation = (req) => {
  const errors = [];
  const body = req.body || {};

  if (!isPlainObject(body)) {
    return [{ field: "body", message: "Request body must be an object" }];
  }

  const fields = Object.keys(body);
  const updatableFields = fields.filter((field) =>
    ALLOWED_PROFILE_FIELDS.includes(field)
  );

  if (updatableFields.length === 0) {
    errors.push({
      field: "body",
      message: "At least one applicant profile field is required"
    });
  }

  fields.forEach((field) => {
    if (FORBIDDEN_PROFILE_FIELDS.includes(field)) {
      errors.push({ field, message: `${field} cannot be updated here` });
      return;
    }

    if (!ALLOWED_PROFILE_FIELDS.includes(field)) {
      errors.push({ field, message: `${field} is not allowed` });
    }
  });

  validateOptionalString(errors, body, "fullName", {
    requiredWhenPresent: true,
    maxLength: 120
  });
  validateOptionalString(errors, body, "phone", { maxLength: 30 });
  validateOptionalString(errors, body, "university", { maxLength: 150 });
  validateOptionalString(errors, body, "major", { maxLength: 150 });
  validateOptionalString(errors, body, "location", { maxLength: 150 });
  validateOptionalString(errors, body, "headline", { maxLength: 160 });
  validateOptionalString(errors, body, "summary", { maxLength: 2000 });
  validateOptionalString(errors, body, "careerGoal", { maxLength: 2000 });
  validateOptionalUrl(errors, body, "avatarUrl");

  return errors;
};

module.exports = {
  ALLOWED_PROFILE_FIELDS,
  updateApplicantProfileValidation
};
