import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as authService from "./auth.service";

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
  logout,
  getMe,
  changePassword
};
