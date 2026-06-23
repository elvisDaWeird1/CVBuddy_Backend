import jwt, { type SignOptions } from "jsonwebtoken";

import ApiError from "./apiError";

const getJwtSecret = () => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not configured.");
  }

  return process.env.JWT_SECRET;
};

const getJwtExpiresIn = (): SignOptions["expiresIn"] => {
  if (!process.env.JWT_EXPIRES_IN) {
    throw new ApiError(500, "JWT_EXPIRES_IN is not configured.");
  }

  return process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"];
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

export {
  signAuthToken,
  verifyAuthToken
};
