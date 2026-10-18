import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import { getMyUsage } from "./usage.service";

const getCurrentUsage = asyncHandler(async (req, res) => {
  const usage = await getMyUsage(req.user._id);
  return successResponse(res, "AI usage fetched successfully", { usage });
});

export { getCurrentUsage };
