import express from "express";

import { successResponse } from "../utils/apiResponse";

const router = express.Router();

router.get("/", (req, res) => {
  return successResponse(res, "CVBuddy backend is running");
});

export default router;
