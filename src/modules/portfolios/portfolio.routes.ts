import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as portfolioController from "./portfolio.controller";
import {
  createPortfolioValidation,
  updatePortfolioValidation,
  portfolioIdValidation,
  createPortfolioItemValidation,
  updatePortfolioItemValidation,
  portfolioItemIdValidation
} from "./portfolio.validation";

const portfolioRouter = express.Router();
const portfolioItemRouter = express.Router();

portfolioRouter.get(
  "/public/:portfolioId",
  validate(portfolioIdValidation),
  portfolioController.getPublicPortfolio
);

portfolioRouter.use(authMiddleware);
portfolioRouter.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

portfolioRouter.post(
  "/",
  validate(createPortfolioValidation),
  portfolioController.createPortfolio
);

portfolioRouter.get("/me", portfolioController.getMyPortfolio);

portfolioRouter.patch(
  "/me",
  validate(updatePortfolioValidation),
  portfolioController.updateMyPortfolio
);

portfolioItemRouter.use(authMiddleware);
portfolioItemRouter.use(roleMiddleware(ACCOUNT_ROLES.APPLICANT));

portfolioItemRouter.post(
  "/",
  validate(createPortfolioItemValidation),
  portfolioController.createPortfolioItem
);

portfolioItemRouter.get("/me", portfolioController.getMyPortfolioItems);

portfolioItemRouter.get(
  "/:id",
  validate(portfolioItemIdValidation),
  portfolioController.getMyPortfolioItemById
);

portfolioItemRouter.patch(
  "/:id",
  validate(updatePortfolioItemValidation),
  portfolioController.updatePortfolioItem
);

portfolioItemRouter.delete(
  "/:id",
  validate(portfolioItemIdValidation),
  portfolioController.deletePortfolioItem
);

export {
  portfolioItemRouter
};

export default portfolioRouter;
