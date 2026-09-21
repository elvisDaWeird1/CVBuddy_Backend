import express from "express";

import { successResponse } from "../utils/apiResponse";
import { getReadiness } from "../config/runtime";

const router = express.Router();

router.get("/", (req, res) => {
  return successResponse(res, "CVBuddy backend is running");
});

router.get("/ready", (req, res) => {
  const readiness = getReadiness();
  return successResponse(
    res,
    readiness.ready ? "CVBuddy backend is ready" : "CVBuddy backend is not ready",
    readiness,
    readiness.ready ? 200 : 503
  );
});

export default router;
