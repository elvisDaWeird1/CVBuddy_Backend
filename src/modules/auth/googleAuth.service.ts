import bcrypt from "bcrypt";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";

import ApiError from "../../utils/apiError";
import { signAuthToken } from "../../utils/jwt";
import {
  ACCOUNT_ROLES,
  ACCOUNT_STATUSES,
  AUTH_METHODS
} from "../../constants/enums";
import Account from "../accounts/account.model";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CompanyProfile from "../companyProfiles/companyProfile.model";

export interface VerifiedGoogleTokenPayload {
  sub: string;
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
}

const VALID_GOOGLE_ISSUERS = new Set([
  "accounts.google.com",
  "https://accounts.google.com"
]);

const LINK_CHALLENGE_PURPOSE = "google_account_link";
const LINK_CHALLENGE_EXPIRES_IN = "10m";
const LINK_CHALLENGE_SECRET_DOMAIN = ":google-link-challenge:v1";
const PLACEHOLDER_FULL_NAME = "Applicant";

type GoogleTokenVerifier = (idToken: string) => Promise<VerifiedGoogleTokenPayload>;

let customVerifierForTests: GoogleTokenVerifier | null = null;

const setGoogleTokenVerifierForTests = (verifier: GoogleTokenVerifier | null) => {
  customVerifierForTests = verifier;
};

const getGoogleClientId = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  if (!clientId) {
    throw new ApiError(
      503,
      "Google authentication is not configured.",
      [],
      "GOOGLE_AUTH_UNAVAILABLE"
    );
  }
  return clientId;
};

const getJwtSecretForChallenge = () => {
  if (!process.env.JWT_SECRET) {
    throw new ApiError(500, "JWT_SECRET is not configured.");
  }
  return crypto
    .createHmac("sha256", process.env.JWT_SECRET)
    .update(`${process.env.JWT_SECRET}${LINK_CHALLENGE_SECRET_DOMAIN}`)
    .digest("hex");
};

const signGoogleLinkChallenge = ({
  accountId,
  email,
  googleSubject,
  expiresIn = LINK_CHALLENGE_EXPIRES_IN
}: {
  accountId: string;
  email: string;
  googleSubject: string;
  expiresIn?: string | number;
}) => {
  return jwt.sign(
    {
      purpose: LINK_CHALLENGE_PURPOSE,
      accountId,
      email,
      googleSubject
    },
    getJwtSecretForChallenge(),
    { expiresIn: expiresIn as any }
  );
};

const verifyGoogleLinkChallenge = (
  linkToken: string | undefined,
  expected: { email: string; googleSubject: string }
) => {
  if (typeof linkToken !== "string" || !linkToken.trim()) {
    throw new ApiError(
      401,
      "Google account link session is invalid or has expired. Please sign in with Google again.",
      [],
      "GOOGLE_LINK_CHALLENGE_INVALID"
    );
  }

  try {
    const decoded = jwt.verify(linkToken.trim(), getJwtSecretForChallenge());
    if (
      typeof decoded !== "object" ||
      decoded === null ||
      decoded.purpose !== LINK_CHALLENGE_PURPOSE ||
      typeof decoded.accountId !== "string" ||
      !decoded.accountId.trim() ||
      decoded.email !== expected.email ||
      decoded.googleSubject !== expected.googleSubject
    ) {
      throw new Error("Challenge mismatch");
    }
    return decoded as {
      purpose: string;
      accountId: string;
      email: string;
      googleSubject: string;
    };
  } catch {
    throw new ApiError(
      401,
      "Google account link session is invalid or has expired. Please sign in with Google again.",
      [],
      "GOOGLE_LINK_CHALLENGE_INVALID"
    );
  }
};

const verifyGoogleIdToken = async (
  idToken: string,
  options: { oauthClient?: Pick<OAuth2Client, "verifyIdToken">; clientId?: string } = {}
): Promise<VerifiedGoogleTokenPayload> => {
  if (typeof idToken !== "string" || !idToken.trim()) {
    throw new ApiError(
      400,
      "Google ID token is required",
      [{ field: "idToken", message: "idToken is required" }],
      "VALIDATION_ERROR"
    );
  }

  if (customVerifierForTests && !options.oauthClient) {
    return customVerifierForTests(idToken.trim());
  }

  const clientId = options.clientId?.trim() || getGoogleClientId();
  const client = options.oauthClient || new OAuth2Client(clientId);

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: idToken.trim(),
      audience: clientId
    });
  } catch {
    throw new ApiError(
      401,
      "Invalid or expired Google ID token",
      [],
      "GOOGLE_TOKEN_INVALID"
    );
  }

  const payload = ticket?.getPayload ? ticket.getPayload() : undefined;
  if (!payload) {
    throw new ApiError(
      401,
      "Invalid Google ID token payload",
      [],
      "GOOGLE_TOKEN_INVALID"
    );
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    !payload.iss ||
    !VALID_GOOGLE_ISSUERS.has(payload.iss) ||
    !audiences.includes(clientId) ||
    typeof payload.exp !== "number" ||
    payload.exp <= nowSeconds ||
    typeof payload.sub !== "string" ||
    !payload.sub.trim() ||
    typeof payload.email !== "string" ||
    !payload.email.trim()
  ) {
    throw new ApiError(
      401,
      "Invalid or expired Google ID token",
      [],
      "GOOGLE_TOKEN_INVALID"
    );
  }

  if (payload.email_verified !== true) {
    throw new ApiError(
      400,
      "Google account email must be verified",
      [],
      "GOOGLE_EMAIL_NOT_VERIFIED"
    );
  }

  return {
    sub: payload.sub.trim(),
    email: payload.email.trim().toLowerCase(),
    email_verified: true,
    name: typeof payload.name === "string" ? payload.name.trim() : "",
    picture: typeof payload.picture === "string" ? payload.picture.trim() : ""
  };
};

const hasValidFullName = (value?: string | null) =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().toLowerCase() !== PLACEHOLDER_FULL_NAME.toLowerCase();

const getEmailLocalPart = (email: string) =>
  email.split("@")[0]?.trim() || "";

const resolveDefaultFullName = (claims: VerifiedGoogleTokenPayload) => {
  if (hasValidFullName(claims.name)) {
    return claims.name.trim();
  }
  return PLACEHOLDER_FULL_NAME;
};

const isApplicantProfileIncomplete = (
  profile: { fullName?: string | null } | null | undefined,
  claims?: VerifiedGoogleTokenPayload
) => {
  if (!profile || !hasValidFullName(profile.fullName)) {
    return true;
  }

  if (claims && !hasValidFullName(claims.name)) {
    const localPart = getEmailLocalPart(claims.email).toLowerCase();
    if (localPart && profile.fullName.trim().toLowerCase() === localPart) {
      return true;
    }
  }

  return false;
};

const serializeAccount = (
  account,
  options: { needsProfileCompletion?: boolean } = {}
) => ({
  id: account._id.toString(),
  email: account.email,
  role: account.role,
  status: account.status,
  authMethods:
    Array.isArray(account.authMethods) && account.authMethods.length > 0
      ? account.authMethods
      : [AUTH_METHODS.PASSWORD],
  ...(typeof options.needsProfileCompletion === "boolean"
    ? { needsProfileCompletion: options.needsProfileCompletion }
    : {})
});

const serializeApplicantProfile = (
  profile,
  claims?: VerifiedGoogleTokenPayload
) => {
  if (!profile) return null;
  const isComplete = !isApplicantProfileIncomplete(profile, claims);
  return {
    id: profile._id.toString(),
    fullName: profile.fullName,
    avatarUrl: profile.avatarUrl || "",
    isComplete
  };
};

const serializeCompanyProfile = (profile) => {
  if (!profile) return null;
  return {
    id: profile._id.toString(),
    companyName: profile.companyName
  };
};

const ensureProfileForAccount = async (
  account,
  claims: VerifiedGoogleTokenPayload
) => {
  if (account.role === ACCOUNT_ROLES.APPLICANT) {
    let profile = await ApplicantProfile.findOne({ accountId: account._id });
    if (!profile) {
      try {
        profile = await ApplicantProfile.create({
          accountId: account._id,
          fullName: resolveDefaultFullName(claims),
          ...(claims.picture ? { avatarUrl: claims.picture } : {})
        });
      } catch (error: any) {
        if (error?.code === 11000) {
          profile = await ApplicantProfile.findOne({ accountId: account._id });
        } else {
          throw error;
        }
      }
    } else {
      let shouldSave = false;
      if (
        isApplicantProfileIncomplete(profile, claims) &&
        hasValidFullName(claims.name)
      ) {
        profile.fullName = claims.name.trim();
        shouldSave = true;
      }
      if (!profile.avatarUrl && claims.picture) {
        profile.avatarUrl = claims.picture;
        shouldSave = true;
      }
      if (shouldSave) {
        await profile.save();
      }
    }
    return serializeApplicantProfile(profile, claims);
  }

  if (account.role === ACCOUNT_ROLES.COMPANY) {
    const profile = await CompanyProfile.findOne({ accountId: account._id });
    return serializeCompanyProfile(profile);
  }

  return null;
};

const resolveNeedsProfileCompletion = (
  account,
  serializedProfile: { isComplete?: boolean; [key: string]: unknown } | null
) => {
  if (account.role !== ACCOUNT_ROLES.APPLICANT) {
    return false;
  }
  return serializedProfile?.isComplete !== true;
};

const assertAccountActive = (account) => {
  if (account.status !== ACCOUNT_STATUSES.ACTIVE) {
    throw new ApiError(403, "Account is not active", [], "ACCOUNT_INACTIVE");
  }
};

const authenticateWithGoogle = async ({
  idToken,
  oauthClient
}: {
  idToken: string;
  oauthClient?: Pick<OAuth2Client, "verifyIdToken">;
}) => {
  const claims = await verifyGoogleIdToken(idToken, { oauthClient });
  const now = new Date();

  const existingBySubject = await Account.findOne({ googleSubject: claims.sub });
  if (existingBySubject) {
    assertAccountActive(existingBySubject);

    const updatedExisting =
      (await Account.findOneAndUpdate(
        { _id: existingBySubject._id },
        {
          $set: {
            emailVerifiedAt: existingBySubject.emailVerifiedAt || now,
            lastLoginAt: now
          },
          $addToSet: {
            authMethods: AUTH_METHODS.GOOGLE
          }
        },
        { new: true }
      )) || existingBySubject;

    const profile = await ensureProfileForAccount(updatedExisting, claims);
    const needsProfileCompletion = resolveNeedsProfileCompletion(
      updatedExisting,
      profile
    );
    return {
      requireLink: false as const,
      isNewAccount: false,
      needsProfileCompletion,
      token: signAuthToken(updatedExisting),
      account: serializeAccount(updatedExisting, { needsProfileCompletion }),
      profile
    };
  }

  const existingByEmail = await Account.findOne({ email: claims.email });
  if (existingByEmail) {
    assertAccountActive(existingByEmail);

    if (
      existingByEmail.googleSubject &&
      existingByEmail.googleSubject !== claims.sub
    ) {
      throw new ApiError(
        409,
        "This email is already linked to a different Google account.",
        [],
        "GOOGLE_SUBJECT_MISMATCH"
      );
    }

    const linkToken = signGoogleLinkChallenge({
      accountId: existingByEmail._id.toString(),
      email: existingByEmail.email,
      googleSubject: claims.sub
    });

    return {
      requireLink: true as const,
      email: existingByEmail.email,
      linkToken
    };
  }

  let createdAccount;
  try {
    createdAccount = await Account.create({
      email: claims.email,
      role: ACCOUNT_ROLES.APPLICANT,
      status: ACCOUNT_STATUSES.ACTIVE,
      authMethods: [AUTH_METHODS.GOOGLE],
      googleSubject: claims.sub,
      emailVerifiedAt: now,
      lastLoginAt: now
    });

    const profile = await ensureProfileForAccount(createdAccount, claims);
    const needsProfileCompletion = resolveNeedsProfileCompletion(
      createdAccount,
      profile
    );

    return {
      requireLink: false as const,
      isNewAccount: true,
      needsProfileCompletion,
      token: signAuthToken(createdAccount),
      account: serializeAccount(createdAccount, { needsProfileCompletion }),
      profile
    };
  } catch (error: any) {
    if (error?.code === 11000) {
      const racedBySubject = await Account.findOne({ googleSubject: claims.sub });
      if (racedBySubject) {
        assertAccountActive(racedBySubject);
        const profile = await ensureProfileForAccount(racedBySubject, claims);
        const needsProfileCompletion = resolveNeedsProfileCompletion(
          racedBySubject,
          profile
        );
        return {
          requireLink: false as const,
          isNewAccount: false,
          needsProfileCompletion,
          token: signAuthToken(racedBySubject),
          account: serializeAccount(racedBySubject, { needsProfileCompletion }),
          profile
        };
      }

      const racedByEmail = await Account.findOne({ email: claims.email });
      if (racedByEmail) {
        assertAccountActive(racedByEmail);
        if (
          racedByEmail.googleSubject &&
          racedByEmail.googleSubject !== claims.sub
        ) {
          throw new ApiError(
            409,
            "This email is already linked to a different Google account.",
            [],
            "GOOGLE_SUBJECT_MISMATCH"
          );
        }

        const linkToken = signGoogleLinkChallenge({
          accountId: racedByEmail._id.toString(),
          email: racedByEmail.email,
          googleSubject: claims.sub
        });
        return {
          requireLink: true as const,
          email: racedByEmail.email,
          linkToken
        };
      }
    }

    if (createdAccount) {
      await Account.deleteOne({ _id: createdAccount._id }).catch(() => undefined);
    }

    throw error;
  }
};

const linkGoogleAccount = async ({
  idToken,
  password,
  linkToken,
  oauthClient
}: {
  idToken: string;
  password?: string;
  linkToken?: string;
  oauthClient?: Pick<OAuth2Client, "verifyIdToken">;
}) => {
  const claims = await verifyGoogleIdToken(idToken, { oauthClient });

  const challenge = verifyGoogleLinkChallenge(linkToken, {
    email: claims.email,
    googleSubject: claims.sub
  });

  const account = await Account.findOne({ email: claims.email }).select("+passwordHash");
  if (!account) {
    throw new ApiError(404, "Account not found", [], "ACCOUNT_NOT_FOUND");
  }

  if (account._id.toString() !== challenge.accountId) {
    throw new ApiError(
      401,
      "Google account link session is invalid or has expired. Please sign in with Google again.",
      [],
      "GOOGLE_LINK_CHALLENGE_INVALID"
    );
  }

  assertAccountActive(account);

  if (account.googleSubject && account.googleSubject !== claims.sub) {
    throw new ApiError(
      409,
      "This account is already linked to a different Google identity.",
      [],
      "GOOGLE_SUBJECT_MISMATCH"
    );
  }

  const subjectConflict = await Account.findOne({
    googleSubject: claims.sub,
    _id: { $ne: account._id }
  }).lean();
  if (subjectConflict) {
    throw new ApiError(
      409,
      "This Google identity is already linked to another account.",
      [],
      "GOOGLE_ALREADY_LINKED"
    );
  }

  if (typeof password !== "string" || password.length === 0) {
    throw new ApiError(
      401,
      "Current password is required to link Google Sign-In",
      [{ field: "password", message: "password is required" }],
      "PASSWORD_REQUIRED"
    );
  }

  if (!account.passwordHash) {
    throw new ApiError(
      401,
      "Current password is incorrect",
      [],
      "INVALID_PASSWORD"
    );
  }

  const matches = await bcrypt.compare(password, account.passwordHash);
  if (!matches) {
    throw new ApiError(
      401,
      "Current password is incorrect",
      [],
      "INVALID_PASSWORD"
    );
  }

  const now = new Date();
  let updatedAccount;
  try {
    updatedAccount = await Account.findOneAndUpdate(
      {
        _id: account._id,
        $or: [
          { googleSubject: { $exists: false } },
          { googleSubject: null },
          { googleSubject: "" },
          { googleSubject: claims.sub }
        ]
      },
      {
        $set: {
          googleSubject: claims.sub,
          emailVerifiedAt: account.emailVerifiedAt || now,
          lastLoginAt: now
        },
        $addToSet: {
          authMethods: AUTH_METHODS.GOOGLE
        }
      },
      { new: true }
    );
  } catch (error: any) {
    if (error?.code === 11000) {
      const racedConflict = await Account.findOne({
        googleSubject: claims.sub,
        _id: { $ne: account._id }
      }).lean();
      if (racedConflict) {
        throw new ApiError(
          409,
          "This Google identity is already linked to another account.",
          [],
          "GOOGLE_ALREADY_LINKED"
        );
      }
      throw new ApiError(
        409,
        "Unable to link Google identity due to a concurrent conflict.",
        [],
        "GOOGLE_LINK_CONFLICT"
      );
    }
    throw error;
  }

  if (!updatedAccount) {
    const refreshedAccount = await Account.findById(account._id).lean();
    if (
      refreshedAccount?.googleSubject &&
      refreshedAccount.googleSubject !== claims.sub
    ) {
      throw new ApiError(
        409,
        "This account is already linked to a different Google identity.",
        [],
        "GOOGLE_SUBJECT_MISMATCH"
      );
    }
    throw new ApiError(
      409,
      "Unable to link Google identity due to a concurrent conflict.",
      [],
      "GOOGLE_LINK_CONFLICT"
    );
  }

  const profile = await ensureProfileForAccount(updatedAccount, claims);
  const needsProfileCompletion = resolveNeedsProfileCompletion(
    updatedAccount,
    profile
  );

  return {
    needsProfileCompletion,
    token: signAuthToken(updatedAccount),
    account: serializeAccount(updatedAccount, { needsProfileCompletion }),
    profile
  };
};

export {
  verifyGoogleIdToken,
  authenticateWithGoogle,
  linkGoogleAccount,
  signGoogleLinkChallenge,
  verifyGoogleLinkChallenge,
  isApplicantProfileIncomplete,
  setGoogleTokenVerifierForTests
};
