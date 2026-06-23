import ApiError from "../utils/apiError";
import asyncHandler from "../utils/asyncHandler";
import { verifyAuthToken } from "../utils/jwt";
import { ACCOUNT_STATUSES } from "../constants/enums";
import Account from "../modules/accounts/account.model";

const getBearerToken = (authorizationHeader) => {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice(7).trim() || null;
};

const authMiddleware = asyncHandler(async (req, res, next) => {
  const token = getBearerToken(req.headers.authorization);

  if (!token) {
    throw new ApiError(401, "Authentication token is required");
  }

  let payload;

  try {
    payload = verifyAuthToken(token) as { accountId: string };
  } catch (error) {
    throw new ApiError(401, "Invalid or expired token");
  }

  const account = await Account.findById(payload.accountId);

  if (!account) {
    throw new ApiError(401, "Account not found");
  }

  if (account.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new ApiError(403, "Account is not active");
  }

  req.user = account;
  req.account = account;
  next();
});

export {
  authMiddleware
};
