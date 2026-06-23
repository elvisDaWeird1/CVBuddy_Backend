import ApiError from "../utils/apiError";
import { removeFileIfExists } from "../utils/file";

const validate = (validator) => (req, res, next) => {
  const errors = validator(req);

  if (errors.length > 0) {
    if (req.file) {
      removeFileIfExists(req.file.path).catch(() => undefined);
    }

    return next(new ApiError(400, "Validation failed", errors));
  }

  return next();
};

export {
  validate
};
