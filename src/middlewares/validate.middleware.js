const ApiError = require("../utils/apiError");

const validate = (validator) => (req, res, next) => {
  const errors = validator(req);

  if (errors.length > 0) {
    return next(new ApiError(400, "Validation failed", errors));
  }

  return next();
};

module.exports = {
  validate
};
