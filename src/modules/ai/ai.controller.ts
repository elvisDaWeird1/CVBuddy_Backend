import { AI_FEATURE_KEYS, type AiFeatureKey } from "../../config/planCatalog";
import ApiError from "../../utils/apiError";
import { successResponse } from "../../utils/apiResponse";
import asyncHandler from "../../utils/asyncHandler";
import { writeOperationalLog } from "../../utils/operationalLogger";
import { AI_USAGE_STATES } from "../usage/aiUsage.model";
import {
  attachAiResultToReservation,
  consumeAiUsage,
  refundAiUsage,
  reserveAiUsage
} from "../usage/usage.service";
import { getAiServiceConfig } from "./ai.config";
import * as aiService from "./ai.service";

type MeteredResult = {
  id?: string;
  status?: string;
  result?: unknown;
  resultIds?: { translation?: string; scoring?: string };
};

const requireAiEnabled = () => {
  if (!getAiServiceConfig().enabled) {
    throw new ApiError(
      503,
      "AI features are temporarily unavailable.",
      [],
      "AI_FEATURE_DISABLED"
    );
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const numberOrUndefined = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;

const usageMetadataFromResult = (value: MeteredResult) => {
  if (!isRecord(value.result) || !isRecord(value.result.meta)) return {};
  const meta = value.result.meta;
  const tokenUsage = isRecord(meta.token_usage) ? meta.token_usage : {};

  return {
    provider: typeof meta.provider === "string" ? meta.provider : undefined,
    providerModel: typeof meta.model === "string" ? meta.model : undefined,
    inputTokens: numberOrUndefined(tokenUsage.input_tokens),
    outputTokens: numberOrUndefined(tokenUsage.output_tokens),
    totalTokens: numberOrUndefined(tokenUsage.total_tokens)
  };
};

const usageResultId = (value: MeteredResult) =>
  value.id || value.resultIds?.translation;

const loadIdempotentResult = async (accountId, usage, workflow: boolean) => {
  if (usage.aiResultId) {
    return workflow
      ? aiService.getMyAiWorkflowByResultId(accountId, usage.aiResultId.toString())
      : aiService.getMyAiResultById(accountId, usage.aiResultId.toString());
  }

  if (usage.state === AI_USAGE_STATES.REFUNDED) {
    throw new ApiError(
      409,
      "The previous AI attempt failed and was refunded. Start a new attempt with a new idempotency key.",
      [],
      "IDEMPOTENCY_RETRY_REQUIRED"
    );
  }

  throw new ApiError(
    409,
    "An AI request with this idempotency key is already in progress.",
    [],
    "AI_REQUEST_IN_PROGRESS"
  );
};

const executeMeteredAction = async ({
  req,
  featureKey,
  workflow = false,
  action
}: {
  req;
  featureKey: AiFeatureKey;
  workflow?: boolean;
  action: () => Promise<MeteredResult>;
}) => {
  requireAiEnabled();
  const accountId = req.user._id;
  const idempotencyKey = req.get("Idempotency-Key").trim();
  const reservation = await reserveAiUsage({ accountId, featureKey, idempotencyKey });

  if (!reservation.created) {
    return loadIdempotentResult(accountId, reservation.usage, workflow);
  }

  try {
    const value = await action();
    const aiResultId = usageResultId(value);
    if (!aiResultId) {
      throw new ApiError(502, "AI result identifier is missing", [], "AI_INVALID_PROVIDER_RESPONSE");
    }

    await attachAiResultToReservation({ accountId, idempotencyKey, aiResultId });

    if (value.status === "FAILED") {
      await refundAiUsage({ accountId, idempotencyKey, aiResultId });
      return value;
    }

    await consumeAiUsage({
      accountId,
      idempotencyKey,
      aiResultId,
      metadata: usageMetadataFromResult(value)
    });
    return value;
  } catch (error) {
    const aiResultId = (error as { aiResultId?: string }).aiResultId;
    try {
      await refundAiUsage({ accountId, idempotencyKey, aiResultId });
    } catch (refundError) {
      writeOperationalLog("error", "ai_usage_refund_failed", {
        requestId: req.res?.locals?.requestId,
        featureKey,
        errorName: refundError instanceof Error ? refundError.name : "UnknownError"
      });
    }
    throw error;
  }
};

const generateFeedback = asyncHandler(async (req, res) => {
  const aiResult = await executeMeteredAction({
    req,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    action: () => aiService.generateFeedback(req.user._id, req.params.cvId, req.body || {}, res.locals.requestId)
  });
  return successResponse(res, "AI feedback generated successfully", { aiResult });
});

const reviewCv = asyncHandler(async (req, res) => {
  const aiResult = await executeMeteredAction({
    req,
    featureKey: AI_FEATURE_KEYS.TARGETED_REVIEW,
    action: () => aiService.generateFeedback(req.user._id, req.params.cvId, req.body, res.locals.requestId)
  });
  return successResponse(res, "CV review generated successfully", { aiResult });
});

const generateScore = asyncHandler(async (req, res) => {
  const aiResult = await executeMeteredAction({
    req,
    featureKey: AI_FEATURE_KEYS.CV_EVALUATION,
    action: () => aiService.generateScore(req.user._id, req.params.cvId, req.body || {}, res.locals.requestId)
  });
  return successResponse(res, "CV score generated successfully", { aiResult });
});

const translateToEnglish = asyncHandler(async (req, res) => {
  const aiResult = await executeMeteredAction({
    req,
    featureKey: AI_FEATURE_KEYS.CV_TRANSLATION,
    action: () => aiService.translateToEnglish(req.user._id, req.params.cvId, req.body || {}, res.locals.requestId)
  });
  return successResponse(res, "CV translated to English successfully", { aiResult });
});

const translateAndScore = asyncHandler(async (req, res) => {
  const workflow = await executeMeteredAction({
    req,
    featureKey: AI_FEATURE_KEYS.TRANSLATE_AND_EVALUATE,
    workflow: true,
    action: () => aiService.translateAndScore(req.user._id, req.params.cvId, req.body, res.locals.requestId)
  });
  return successResponse(res, "Translate and score workflow completed", { workflow });
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
  reviewCv,
  generateScore,
  translateToEnglish,
  translateAndScore,
  getMyAiResults,
  getMyAiResultById
};
