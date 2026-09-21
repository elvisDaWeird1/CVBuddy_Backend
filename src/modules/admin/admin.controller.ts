import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as adminService from "./admin.service";

const getUserMetricsOverview = asyncHandler(async (req, res) => {
  const data = await adminService.getUserMetricsOverview();
  return successResponse(res, "Admin user metrics fetched successfully", data);
});

export {
  getUserMetricsOverview
};
