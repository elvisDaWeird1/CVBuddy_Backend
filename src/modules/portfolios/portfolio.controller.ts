import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as portfolioService from "./portfolio.service";

const createPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.createPortfolio(req.user._id, req.body);

  return successResponse(res, "Portfolio created successfully", { portfolio }, 201);
});

const getMyPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.getMyPortfolio(req.user._id);

  return successResponse(res, "Portfolio fetched successfully", { portfolio });
});

const updateMyPortfolio = asyncHandler(async (req, res) => {
  const portfolio = await portfolioService.updateMyPortfolio(req.user._id, req.body);

  return successResponse(res, "Portfolio updated successfully", { portfolio });
});

const getPublicPortfolio = asyncHandler(async (req, res) => {
  const data = await portfolioService.getPublicPortfolio(req.params.portfolioId);

  return successResponse(res, "Public portfolio fetched successfully", data);
});

const createPortfolioItem = asyncHandler(async (req, res) => {
  const portfolioItem = await portfolioService.createPortfolioItem(req.user._id, req.body);

  return successResponse(
    res,
    "Portfolio item created successfully",
    { portfolioItem },
    201
  );
});

const getMyPortfolioItems = asyncHandler(async (req, res) => {
  const portfolioItems = await portfolioService.getMyPortfolioItems(req.user._id);

  return successResponse(res, "Portfolio items fetched successfully", {
    portfolioItems
  });
});

const getMyPortfolioItemById = asyncHandler(async (req, res) => {
  const portfolioItem = await portfolioService.getMyPortfolioItemById(
    req.user._id,
    req.params.id
  );

  return successResponse(res, "Portfolio item fetched successfully", {
    portfolioItem
  });
});

const updatePortfolioItem = asyncHandler(async (req, res) => {
  const portfolioItem = await portfolioService.updatePortfolioItem(
    req.user._id,
    req.params.id,
    req.body
  );

  return successResponse(res, "Portfolio item updated successfully", {
    portfolioItem
  });
});

const deletePortfolioItem = asyncHandler(async (req, res) => {
  await portfolioService.deletePortfolioItem(req.user._id, req.params.id);

  return successResponse(res, "Portfolio item deleted successfully");
});

export {
  createPortfolio,
  getMyPortfolio,
  updateMyPortfolio,
  getPublicPortfolio,
  createPortfolioItem,
  getMyPortfolioItems,
  getMyPortfolioItemById,
  updatePortfolioItem,
  deletePortfolioItem
};
