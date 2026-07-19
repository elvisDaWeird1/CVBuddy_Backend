import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as service from "./portfolioCollection.service";
import { getPublicPortfolio } from "./portfolioPublic.service";

const accountId = (req) => req.user._id;

const list = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolios fetched successfully", {
    portfolios: await service.listPortfolios(accountId(req))
  })
);

const create = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio created successfully", {
    portfolio: await service.createPortfolio(accountId(req), req.body)
  }, 201)
);

const get = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio fetched successfully", {
    portfolio: await service.getPortfolio(accountId(req), req.params.portfolioId)
  })
);

const update = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio updated successfully", {
    portfolio: await service.updatePortfolio(
      accountId(req),
      req.params.portfolioId,
      req.body
    )
  })
);

const remove = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio deleted successfully", await service.deletePortfolio(
    accountId(req),
    req.params.portfolioId
  ))
);

const setVisibility = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio visibility updated successfully", {
    portfolio: await service.setPortfolioVisibility(
      accountId(req),
      req.params.portfolioId,
      req.body.visibility
    )
  })
);

const listExperiences = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio experiences fetched successfully", {
    experiences: await service.listPortfolioExperiences(
      accountId(req),
      req.params.portfolioId
    )
  })
);

const createExperience = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio experience created successfully", {
    experience: await service.createPortfolioExperience(
      accountId(req),
      req.params.portfolioId,
      req.body
    )
  }, 201)
);

const listMoments = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio moments fetched successfully", {
    moments: await service.listPortfolioMoments(
      accountId(req),
      req.params.portfolioId
    )
  })
);

const createMoment = asyncHandler(async (req, res) =>
  successResponse(res, "Portfolio Moment created successfully", {
    moment: await service.createPortfolioMoment({
      applicantId: accountId(req),
      portfolioId: req.params.portfolioId,
      file: req.file,
      payload: req.body
    })
  }, 201)
);

const getPublic = asyncHandler(async (req, res) =>
  successResponse(
    res,
    "Public portfolio fetched successfully",
    await getPublicPortfolio(req.params.slug)
  )
);

export {
  create,
  createExperience,
  createMoment,
  get,
  getPublic,
  list,
  listExperiences,
  listMoments,
  remove,
  setVisibility,
  update
};
