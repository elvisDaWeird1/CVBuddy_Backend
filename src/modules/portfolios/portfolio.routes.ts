import express from "express";

import { ACCOUNT_ROLES } from "../../constants/enums";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { roleMiddleware } from "../../middlewares/role.middleware";
import { validate } from "../../middlewares/validate.middleware";
import * as portfolioController from "./portfolio.controller";
import * as collectionController from "./portfolioCollection.controller";
import { uploadPortfolioImage } from "../../middlewares/upload.middleware";
import {
  validatePortfolioCreate,
  validatePortfolioExperienceCreate,
  validatePortfolioId as validateCollectionPortfolioId,
  validatePortfolioMomentCreate,
  validatePortfolioUpdate as validateCollectionPortfolioUpdate,
  validatePortfolioVisibility
} from "./portfolioCollection.validation";
import {
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

portfolioRouter.get("/", collectionController.list);
portfolioRouter.post(
  "/",
  validate(validatePortfolioCreate),
  collectionController.create
);

portfolioRouter.get("/me", portfolioController.getMyPortfolio);

portfolioRouter.patch(
  "/me",
  validate(updatePortfolioValidation),
  portfolioController.updateMyPortfolio
);

portfolioRouter.get(
  "/:portfolioId/experiences",
  validate(validateCollectionPortfolioId),
  collectionController.listExperiences
);
portfolioRouter.post(
  "/:portfolioId/experiences",
  validate(validateCollectionPortfolioId),
  validate(validatePortfolioExperienceCreate),
  collectionController.createExperience
);
portfolioRouter.get(
  "/:portfolioId/moments",
  validate(validateCollectionPortfolioId),
  collectionController.listMoments
);
portfolioRouter.post(
  "/:portfolioId/moments",
  uploadPortfolioImage,
  validate(validateCollectionPortfolioId),
  validate(validatePortfolioMomentCreate),
  collectionController.createMoment
);
portfolioRouter.patch(
  "/:portfolioId/visibility",
  validate(validateCollectionPortfolioId),
  validate(validatePortfolioVisibility),
  collectionController.setVisibility
);
portfolioRouter.get(
  "/:portfolioId",
  validate(validateCollectionPortfolioId),
  collectionController.get
);
portfolioRouter.patch(
  "/:portfolioId",
  validate(validateCollectionPortfolioId),
  validate(validateCollectionPortfolioUpdate),
  collectionController.update
);
portfolioRouter.delete(
  "/:portfolioId",
  validate(validateCollectionPortfolioId),
  collectionController.remove
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
