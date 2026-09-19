import bcrypt from "bcrypt";

import { ACCOUNT_ROLES, ACCOUNT_STATUSES } from "../../constants/enums";
import ApiError from "../../utils/apiError";
import Account from "../accounts/account.model";

interface ProvisionAdminInput {
  email: string;
  password: string;
  promoteExisting?: boolean;
}

type ProvisionAdminAction = "created" | "promoted" | "already-admin";

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const getSaltRounds = () => {
  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "", 10);

  if (!Number.isInteger(saltRounds) || saltRounds < 1) {
    throw new ApiError(500, "BCRYPT_SALT_ROUNDS is not configured correctly.");
  }

  return saltRounds;
};

const assertProvisioningInput = (email: string, password: string) => {
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    throw new ApiError(400, "A valid admin email is required.");
  }

  if (password.length < 8) {
    throw new ApiError(400, "Admin password must contain at least 8 characters.");
  }
};

const serializeProvisioningResult = (account, action: ProvisionAdminAction) => ({
  action,
  accountId: account._id.toString(),
  role: account.role,
  status: account.status,
  completedAt: new Date().toISOString()
});

const provisionAdmin = async ({
  email,
  password,
  promoteExisting = false
}: ProvisionAdminInput) => {
  const normalizedEmail = normalizeEmail(email);
  assertProvisioningInput(normalizedEmail, password);

  const existingAccount = await Account.findOne({ email: normalizedEmail })
    .select("+passwordHash");

  if (existingAccount?.role === ACCOUNT_ROLES.ADMIN) {
    return serializeProvisioningResult(existingAccount, "already-admin");
  }

  if (existingAccount) {
    if (!promoteExisting) {
      throw new ApiError(
        409,
        "An account already uses this email. Re-run with --promote-existing to explicitly change its role.",
        [],
        "ADMIN_PROMOTION_REQUIRES_CONFIRMATION"
      );
    }

    existingAccount.passwordHash = await bcrypt.hash(password, getSaltRounds());
    existingAccount.role = ACCOUNT_ROLES.ADMIN;
    existingAccount.status = ACCOUNT_STATUSES.ACTIVE;
    await existingAccount.save();
    return serializeProvisioningResult(existingAccount, "promoted");
  }

  const passwordHash = await bcrypt.hash(password, getSaltRounds());

  try {
    const account = await Account.create({
      email: normalizedEmail,
      passwordHash,
      role: ACCOUNT_ROLES.ADMIN,
      status: ACCOUNT_STATUSES.ACTIVE
    });
    return serializeProvisioningResult(account, "created");
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      const concurrentAccount = await Account.findOne({ email: normalizedEmail });
      if (concurrentAccount?.role === ACCOUNT_ROLES.ADMIN) {
        return serializeProvisioningResult(concurrentAccount, "already-admin");
      }

      throw new ApiError(
        409,
        "An account already uses this email and was not promoted.",
        [],
        "ADMIN_PROMOTION_REQUIRES_CONFIRMATION"
      );
    }

    throw error;
  }
};

export {
  provisionAdmin
};
