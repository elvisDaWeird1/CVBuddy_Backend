import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as mobileService from "./mobile.service";

const uploadPortfolioPhoto = asyncHandler(async (req, res) => {
  const portfolioItem = await mobileService.uploadPortfolioPhoto({
    accountId: req.user._id,
    file: req.file,
    payload: req.body
  });

  return successResponse(
    res,
    "Photo uploaded to portfolio successfully",
    { portfolioItem },
    201
  );
});

export {
  uploadPortfolioPhoto
};
