const express = require("express");
const { successResponse } = require("../utils/apiResponse");

const router = express.Router();

router.get("/", (req, res) => {
  return successResponse(res, "CVBuddy backend is running");
});

module.exports = router;
