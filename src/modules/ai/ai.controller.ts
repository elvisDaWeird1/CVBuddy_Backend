import asyncHandler from "../../utils/asyncHandler";
import { successResponse } from "../../utils/apiResponse";
import * as aiService from "./ai.service";

const generateFeedback = asyncHandler(async (req, res) => {
  const aiResult = await aiService.generateFeedback(
    req.user._id,
    req.params.cvId,
    req.body || {}
  );

  return successResponse(res, "AI feedback generated successfully", { aiResult });
});

const generateScore = asyncHandler(async (req, res) => {
  const aiResult = await aiService.generateScore(
    req.user._id,
    req.params.cvId,
    req.body || {}
  );

  return successResponse(res, "CV score generated successfully", { aiResult });
});

const translateToEnglish = asyncHandler(async (req, res) => {
  const aiResult = await aiService.translateToEnglish(
    req.user._id,
    req.params.cvId,
    req.body || {}
  );

  return successResponse(res, "CV translated to English successfully", { aiResult });
});

const getMyAiResults = asyncHandler(async (req, res) => {
  const aiResults = await aiService.getMyAiResults(req.user._id, {
    aiType: req.query.aiType as string | undefined,
    status: req.query.status as string | undefined
  });

  return successResponse(res, "AI results fetched successfully", { aiResults });
});

const getMyAiResultById = asyncHandler(async (req, res) => {
  const aiResult = await aiService.getMyAiResultById(req.user._id, req.params.id);

  return successResponse(res, "AI result fetched successfully", { aiResult });
});

export {
  generateFeedback,
  generateScore,
  translateToEnglish,
  getMyAiResults,
  getMyAiResultById
};
