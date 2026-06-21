const jwt = require("jsonwebtoken");
const ApiError = require("./apiError");

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not configured.");
  }

  return process.env.JWT_SECRET;
};

const getJwtExpiresIn = () => {
  if (!process.env.JWT_EXPIRES_IN) {
    throw new ApiError(500, "JWT_EXPIRES_IN is not configured.");
  }

  return process.env.JWT_EXPIRES_IN;
};

const signAuthToken = (account) => {
  return jwt.sign(
    {
      accountId: account._id.toString(),
      role: account.role
    },
    getJwtSecret(),
    {
      expiresIn: getJwtExpiresIn()
    }
  );
};

const verifyAuthToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

module.exports = {
  signAuthToken,
  verifyAuthToken
};
