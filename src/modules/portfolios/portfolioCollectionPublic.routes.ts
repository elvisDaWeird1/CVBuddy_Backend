import express from "express";

import { validate } from "../../middlewares/validate.middleware";
import * as controller from "./portfolioCollection.controller";
import { validateSlugParam } from "./portfolioDomain.validation";

const router = express.Router();

router.get("/:slug", validate(validateSlugParam), controller.getPublic);

export default router;
