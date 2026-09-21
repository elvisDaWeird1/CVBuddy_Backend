import bcrypt from "bcrypt";

import ApiError from "../../utils/apiError";
import { signAuthToken } from "../../utils/jwt";
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES
} from "../../constants/enums";
import Account from "../accounts/account.model";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CompanyProfile from "../companyProfiles/companyProfile.model";
import { revokeToken } from "./tokenRevocation.service";

const normalizeEmail = (email) => email.trim().toLowerCase();

const getSaltRounds = () => {
  const saltRounds = Number.parseInt(process.env.BCRYPT_SALT_ROUNDS || "", 10);

  if (!Number.isInteger(saltRounds) || saltRounds < 1) {
    throw new ApiError(500, "BCRYPT_SALT_ROUNDS is not configured correctly.");
  }

  return saltRounds;
};

const serializeAccount = (account) => {
  return {
    id: account._id.toString(),
    email: account.email,
    role: account.role,
    status: account.status
  };
};

const serializeApplicantProfile = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    id: profile._id.toString(),
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl || ""
  };
};

const serializeCompanyProfile = (profile) => {
  if (!profile) {
    return null;
  }

  return {
    id: profile._id.toString(),
    companyName: profile.companyName
  };
};

const assertEmailIsAvailable = async (email) => {
  const existingAccount = await Account.findOne({ email }).lean();

  if (existingAccount) {
    throw new ApiError(409, "Email already exists");
  }
};

const createAccount = async ({ email, password, role }) => {
  const passwordHash = await bcrypt.hash(password, getSaltRounds());

  return Account.create({
    email,
    passwordHash,
    role
  });
};

const registerApplicant = async ({ email, password, fullName }) => {
  const normalizedEmail = normalizeEmail(email);
  await assertEmailIsAvailable(normalizedEmail);

  let account;

  try {
    account = await createAccount({
      email: normalizedEmail,
      password,
      role: ACCOUNT_ROLES.APPLICANT
    });

    const profile = await ApplicantProfile.create({
      accountId: account._id,
      fullName: fullName.trim()
    });

    return {
      account: serializeAccount(account),
      profile: serializeApplicantProfile(profile)
    };
  } catch (error) {
    if (account) {
      await Account.deleteOne({ _id: account._id }).catch(() => undefined);
    }

    if (error.code === 11000) {
      throw new ApiError(409, "Email already exists");
    }

    throw error;
  }
};

const registerCompany = async ({ email, password, companyName }) => {
  const normalizedEmail = normalizeEmail(email);
  await assertEmailIsAvailable(normalizedEmail);

  let account;

  try {
    account = await createAccount({
      email: normalizedEmail,
      password,
      role: ACCOUNT_ROLES.COMPANY
    });

    const profile = await CompanyProfile.create({
      accountId: account._id,
      companyName: companyName.trim()
    });

    return {
      account: serializeAccount(account),
      profile: serializeCompanyProfile(profile)
    };
  } catch (error) {
    if (account) {
      await Account.deleteOne({ _id: account._id }).catch(() => undefined);
    }

    if (error.code === 11000) {
      throw new ApiError(409, "Email already exists");
    }

    throw error;
  }
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const account = await Account.findOne({ email: normalizedEmail }).select("+passwordHash");

  if (!account) {
    throw new ApiError(401, "Not found account");
  }

  const passwordMatches = await bcrypt.compare(password, account.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(401, "Wrong password");
  }

  if (account.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new ApiError(403, "Account is not active");
  }

  return {
    token: signAuthToken(account),
    account: serializeAccount(account)
  };
};

const logout = async ({ token, expiresAt }) => {
  await revokeToken(token, expiresAt);
};

const getCurrentAccount = async (accountId) => {
  const account = await Account.findById(accountId);

  if (!account) {
    throw new ApiError(401, "Account not found");
  }

  let profile = null;

  if (account.role === ACCOUNT_ROLES.APPLICANT) {
    profile = serializeApplicantProfile(
      await ApplicantProfile.findOne({ accountId: account._id })
    );
  }

  if (account.role === ACCOUNT_ROLES.COMPANY) {
    profile = serializeCompanyProfile(
      await CompanyProfile.findOne({ accountId: account._id })
    );
  }

  return {
    account: serializeAccount(account),
    profile
  };
};

const changePassword = async ({ accountId, currentPassword, newPassword }) => {
  const account = await Account.findById(accountId).select("+passwordHash");

  if (!account) {
    throw new ApiError(401, "Account not found");
  }

  if (account.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new ApiError(403, "Account is not active");
  }

  const passwordMatches = await bcrypt.compare(currentPassword, account.passwordHash);

  if (!passwordMatches) {
    throw new ApiError(400, "Current password is incorrect");
  }

  account.passwordHash = await bcrypt.hash(newPassword, getSaltRounds());
  await account.save();
};

export {
  registerApplicant,
  registerCompany,
  login,
  logout,
  getCurrentAccount,
  changePassword
};
