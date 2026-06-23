const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isBlank = (value) => {
  return typeof value !== "string" || value.trim().length === 0;
};

const validateEmail = (errors, email) => {
  if (isBlank(email)) {
    errors.push({ field: "email", message: "Email is required" });
    return;
  }

  if (!EMAIL_REGEX.test(email.trim())) {
    errors.push({ field: "email", message: "Email must be valid" });
  }
};

const validatePassword = (errors, field, password, options = {}) => {
  if (isBlank(password)) {
    errors.push({ field, message: `${field} is required` });
    return;
  }

  if (options.minLength && password.length < options.minLength) {
    errors.push({
      field,
      message: `${field} must be at least ${options.minLength} characters`
    });
  }
};

const registerApplicantValidation = (req) => {
  const errors = [];
  const { email, password, fullName } = req.body || {};

  validateEmail(errors, email);
  validatePassword(errors, "password", password, { minLength: 6 });

  if (isBlank(fullName)) {
    errors.push({ field: "fullName", message: "Full name is required" });
  }

  return errors;
};

const registerCompanyValidation = (req) => {
  const errors = [];
  const { email, password, companyName } = req.body || {};

  validateEmail(errors, email);
  validatePassword(errors, "password", password, { minLength: 6 });

  if (isBlank(companyName)) {
    errors.push({ field: "companyName", message: "Company name is required" });
  }

  return errors;
};

const loginValidation = (req) => {
  const errors = [];
  const { email, password } = req.body || {};

  validateEmail(errors, email);
  validatePassword(errors, "password", password);

  return errors;
};

const changePasswordValidation = (req) => {
  const errors = [];
  const { currentPassword, newPassword } = req.body || {};

  validatePassword(errors, "currentPassword", currentPassword);
  validatePassword(errors, "newPassword", newPassword, { minLength: 6 });

  return errors;
};

module.exports = {
  registerApplicantValidation,
  registerCompanyValidation,
  loginValidation,
  changePasswordValidation
};
