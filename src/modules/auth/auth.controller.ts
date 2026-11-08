import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";
import * as googleAuthService from "./googleAuth.service";

const registerApplicant = asyncHandler(async (req, res) => {
  const data = await authService.registerApplicant(req.body);
  return successResponse(res, "Applicant registered successfully", data, 201);
});

const registerCompany = asyncHandler(async (req, res) => {
  const data = await authService.registerCompany(req.body);
  return successResponse(res, "Company registered successfully", data, 201);
});

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.body);
  return successResponse(res, "Login successful", data);
});

const googleLogin = asyncHandler(async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" && req.body.idToken.trim()
    ? req.body.idToken
    : req.body?.credential;

  const data = await googleAuthService.authenticateWithGoogle({ idToken });

  if (data.requireLink) {
    return res.status(409).json({
      success: false,
      code: "GOOGLE_ACCOUNT_LINK_REQUIRED",
      message: "An account with this email already exists. Confirm your password to link Google Sign-In.",
      errors: [],
      requireLink: true,
      email: data.email,
      linkToken: data.linkToken,
      data,
      ...(typeof res.locals?.requestId === "string"
        ? { requestId: res.locals.requestId }
        : {})
    });
  }

  return successResponse(
    res,
    data.isNewAccount ? "Google account registered successfully" : "Google login successful",
    data,
    data.isNewAccount ? 201 : 200
  );
});

const linkGoogleAccount = asyncHandler(async (req, res) => {
  const idToken = typeof req.body?.idToken === "string" && req.body.idToken.trim()
    ? req.body.idToken
    : req.body?.credential;

  const data = await googleAuthService.linkGoogleAccount({
    idToken,
    password: req.body?.password,
    linkToken: req.body?.linkToken
  });

  return successResponse(res, "Google account linked successfully", data);
});

const logout = asyncHandler(async (req, res) => {
  await authService.logout({
    token: req.authToken,
    expiresAt: req.authTokenExpiresAt
  });

  return successResponse(res, "Logout successful");
});

const getMe = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentAccount(req.user._id);
  return successResponse(res, "Current account fetched successfully", data);
});

const changePassword = asyncHandler(async (req, res) => {
  await authService.changePassword({
    accountId: req.user._id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword
  });

  return successResponse(res, "Password changed successfully");
});

export {
  registerApplicant,
  registerCompany,
  login,
  googleLogin,
  linkGoogleAccount,
  logout,
  getMe,
  changePassword
};
