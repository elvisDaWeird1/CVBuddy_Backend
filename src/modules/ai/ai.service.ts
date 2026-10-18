import ApiError from "../../utils/apiError";
import { Types } from "mongoose";
import { AI_STATUSES, AI_TYPES, CV_STATUSES } from "../../constants/enums";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CVDocument from "../cvs/cvDocument.model";
import { CvFileSourceAdapter } from "./adapters/cv-file-source.adapter";
import { cvSectionsToText } from "./adapters/cv-sections-to-text";
import { getAiServiceConfig, type AiLanguage, type AiTier } from "./ai.config";
import {
  AiServiceClient,
  isAiServiceError,
  type FastApiAnalyzeRequest,
  type FastApiJdExtract,
  type FastApiLocalMetrics,
  type FastApiExtractResponse,
  type LocalCvFile
} from "./clients/ai-service.client";
import AIResult from "./aiResult.model";

type AiRequestPayload = {
  targetRole?: string;
  cvText?: string;
  industrySlug?: string;
  verticalSlug?: string;
  companyModel?: "corporate" | "startup_agency";
  language?: AiLanguage;
  jdExtract?: FastApiJdExtract;
  llmModel?: string;
  extractionMode?: "local" | "ai" | "hybrid";
  strictIndustryMatch?: boolean;
  sourceLang?: string;
  translationMode?: "literal" | "cv_native";
};

type SerializeAiResultOptions = { includeDetails?: boolean };
type MockAiOutput = { resultText: string; score?: number };
const SERVER_AI_TIER: AiTier = "free";

const getAiFeatureDisabledError = () => new ApiError(
  503,
  "AI features are temporarily unavailable.",
  [],
  "AI_FEATURE_DISABLED"
);

const assertAiFeatureEnabled = () => {
  if (!getAiServiceConfig().enabled) {
    throw getAiFeatureDisabledError();
  }
};

const parseStoredResult = (resultText: unknown): unknown => {
  if (typeof resultText !== "string" || !resultText) {
    return null;
  }

  try {
    return JSON.parse(resultText) as unknown;
  } catch {
    return resultText;
  }
};

const serializeAiResult = (aiResult, options: SerializeAiResultOptions = {}) => {
  if (!aiResult) return null;

  const payload: {
    id: string;
    accountId: string;
    cvDocumentId?: string;
    relatedJobId?: string;
    aiType: string;
    status: string;
    score: number | null;
    createdAt: Date;
    completedAt?: Date;
    inputText?: string;
    resultText?: string;
    result?: unknown;
    errorMessage?: string | null;
    errorCode?: string | null;
    industrySlug?: string;
    targetRole?: string;
    workflowId?: string;
  } = {
    id: aiResult._id.toString(),
    accountId: aiResult.accountId.toString(),
    cvDocumentId: aiResult.cvDocumentId?.toString(),
    relatedJobId: aiResult.relatedJobId?.toString(),
    aiType: aiResult.aiType,
    status: aiResult.status,
    score: aiResult.score ?? null,
    createdAt: aiResult.createdAt,
    completedAt: aiResult.completedAt
  };

  if (aiResult.industrySlug) payload.industrySlug = aiResult.industrySlug;
  if (aiResult.targetRole) payload.targetRole = aiResult.targetRole;
  if (aiResult.workflowId) payload.workflowId = aiResult.workflowId.toString();

  if (options.includeDetails) {
    payload.inputText = aiResult.inputText || "";
    payload.resultText = aiResult.resultText || "";
    payload.result = parseStoredResult(aiResult.resultText);
    payload.errorMessage = aiResult.errorMessage || null;
    payload.errorCode = aiResult.errorCode || null;
  }

  return payload;
};

const getApplicantProfileForAccount = async (accountId) => {
  const profile = await ApplicantProfile.findOne({ accountId });

  if (!profile) {
    throw new ApiError(
      404,
      "Applicant profile not found. Please register an applicant account first."
    );
  }

  return profile;
};

const getOwnedActiveCv = async (accountId, cvId) => {
  const applicantProfile = await getApplicantProfileForAccount(accountId);
  const cv = await CVDocument.findOne({
    _id: cvId,
    applicantProfileId: applicantProfile._id,
    status: CV_STATUSES.ACTIVE
  });

  if (!cv) throw new ApiError(404, "CV not found");
  return cv;
};

const resolveInputText = (cv, payload: AiRequestPayload) => {
  const extractedText = typeof cv.extractedText === "string" ? cv.extractedText.trim() : "";
  const providedText = typeof payload.cvText === "string" ? payload.cvText.trim() : "";

  if (extractedText) return extractedText;
  if (providedText) return providedText;
  return "";
};

const requireInputText = (inputText: string) => {
  if (inputText) return;

  throw new ApiError(400, "CV text is empty. Please provide cvText or upload a readable CV.", [
    { field: "cvText", message: "cvText is required when CV extractedText is empty" }
  ]);
};

const resolveIndustrySlug = (payload: AiRequestPayload, config: ReturnType<typeof getAiServiceConfig>) => {
  const industrySlug = payload.industrySlug?.trim().toLowerCase() || config.defaultIndustrySlug;

  if (!config.supportedIndustrySlugs.includes(industrySlug)) {
    throw new ApiError(400, "Unsupported industry slug", [
      {
        field: "industrySlug",
        message: "industrySlug must be one of: " + config.supportedIndustrySlugs.join(", ")
      }
    ]);
  }

  return industrySlug;
};

const getAnalyzeRequest = (
  payload: AiRequestPayload,
  extraction: FastApiExtractResponse
): FastApiAnalyzeRequest => {
  const config = getAiServiceConfig();
  const targetRole = payload.targetRole?.trim();
  const jdExtract = payload.jdExtract || (targetRole ? { role_title: targetRole } : undefined);

  return {
    sections: extraction.sections,
    local_metrics: extraction.local_metrics as FastApiLocalMetrics,
    industry_slug: resolveIndustrySlug(payload, config),
    vertical_slug: payload.verticalSlug?.trim() || config.defaultVerticalSlug,
    company_model: payload.companyModel || config.defaultCompanyModel,
    jd_extract: jdExtract,
    language: payload.language || config.defaultLanguage,
    tier: SERVER_AI_TIER,
    llm_model: payload.llmModel?.trim() || undefined,
    strict_industry_match: payload.strictIndustryMatch === true
  };
};

const generateAnalyzeOutput = async ({
  cvFile,
  payload,
  aiType,
  requestId
}: {
  cvFile: LocalCvFile;
  payload: AiRequestPayload;
  aiType: string;
  requestId?: string;
}): Promise<MockAiOutput> => {
  const config = getAiServiceConfig();
  const client = new AiServiceClient({ ...config, requestId });
  const targetRole = payload.targetRole?.trim();
  const hasJdContext = Boolean(targetRole || payload.jdExtract);

  let analysis;
  if (!hasJdContext) {
    const query: Record<string, string> = {
      industry_slug: resolveIndustrySlug(payload, config),
      company_model: payload.companyModel || config.defaultCompanyModel,
      mode: payload.extractionMode || "hybrid",
      target_language: payload.language || config.defaultLanguage,
      strict_industry_match: String(payload.strictIndustryMatch === true)
    };

    const verticalSlug = payload.verticalSlug?.trim() || config.defaultVerticalSlug;
    const llmModel = payload.llmModel?.trim();
    if (verticalSlug) query.vertical_slug = verticalSlug;
    if (llmModel) query.llm_model = llmModel;

    analysis = await client.extractAndAnalyze(cvFile, query);
  } else {
    const extraction = await client.extractCv(cvFile, {
      mode: payload.extractionMode || "hybrid",
      targetLanguage: payload.language || config.defaultLanguage,
      llmModel: payload.llmModel?.trim() || undefined
    });
    analysis = await client.analyzeCv(getAnalyzeRequest(payload, extraction));
  }

  return {
    resultText: JSON.stringify(analysis),
    score: aiType === AI_TYPES.CV_SCORING ? analysis.overall_score : undefined
  };
};

const generateTranslationOutput = async ({
  cv,
  inputText,
  payload,
  requestId
}: {
  cv;
  inputText: string;
  payload: AiRequestPayload;
  requestId?: string;
}): Promise<MockAiOutput> => {
  const config = getAiServiceConfig();
  const client = new AiServiceClient({ ...config, requestId });
  let sourceText = inputText;

  if (!sourceText) {
    const file = await new CvFileSourceAdapter({ timeoutMs: config.timeoutMs }).getFile(cv);
    const extraction = await client.extractCv(file, {
      mode: "hybrid",
      targetLanguage: cv.language === "EN" ? "en" : "vi",
      llmModel: payload.llmModel?.trim() || undefined
    });
    sourceText = cvSectionsToText(extraction.sections);
  }

  requireInputText(sourceText);

  const translation = await client.translate({
    text: sourceText,
    source_lang: payload.sourceLang || (cv.language === "EN" ? "en" : "vi"),
    target_lang: "en",
    mode: payload.translationMode || "cv_native",
    tier: SERVER_AI_TIER
  });

  return { resultText: JSON.stringify(translation) };
};

const generateAiOutput = async ({
  aiType,
  cv,
  inputText,
  payload,
  cvFile,
  requestId
}: {
  aiType: string;
  cv;
  inputText: string;
  payload: AiRequestPayload;
  cvFile?: LocalCvFile;
  requestId?: string;
}) => {
  const config = getAiServiceConfig();

  if (!config.enabled) {
    throw getAiFeatureDisabledError();
  }

  if (aiType === AI_TYPES.CV_TRANSLATION) {
    return generateTranslationOutput({ cv, inputText, payload, requestId });
  }

  if (!cvFile) throw new ApiError(409, "CV file is required for AI analysis");
  return generateAnalyzeOutput({ cvFile, payload, aiType, requestId });
};

const mapAiServiceError = (error: unknown) => {
  if (error instanceof ApiError) return error;
  if (!isAiServiceError(error)) {
    return new ApiError(502, "AI provider request failed", [], "AI_PROVIDER_ERROR");
  }

  if (error.kind === "timeout") {
    return new ApiError(504, "AI service request timed out", [], "AI_SERVICE_TIMEOUT");
  }
  if (error.kind === "unavailable") {
    return new ApiError(503, "AI service is unavailable", [], "AI_SERVICE_UNAVAILABLE");
  }
  if (error.kind === "invalid_response") {
    return new ApiError(502, error.message, [], "AI_PROVIDER_ERROR");
  }
  if (
    error.statusCode === 401 ||
    error.statusCode === 403 ||
    error.upstreamCode === "AI_UNAUTHORIZED" ||
    error.upstreamCode === "AI_SERVICE_MISCONFIGURED"
  ) {
    return new ApiError(
      503,
      "AI service authentication failed",
      [],
      "AI_SERVICE_AUTH_FAILED"
    );
  }
  if (error.statusCode === 504 || error.upstreamCode === "AI_PROVIDER_TIMEOUT") {
    return new ApiError(504, "AI provider request timed out", [], "AI_PROVIDER_TIMEOUT");
  }

  const statusCode = error.statusCode === 429
    ? 429
    : error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 502;

  const code = statusCode === 429
    ? "AI_PROVIDER_RATE_LIMIT"
    : statusCode >= 500
      ? "AI_PROVIDER_ERROR"
      : "AI_PROVIDER_REJECTED_REQUEST";

  return new ApiError(statusCode, error.message, error.errors, code);
};

const aiErrorCode = (error: ApiError) => {
  if (error.code) return error.code;
  if (error.statusCode === 429) return "AI_PROVIDER_RATE_LIMIT";
  if (error.statusCode === 503) return "AI_SERVICE_UNAVAILABLE";
  if (error.statusCode === 504) return "AI_SERVICE_TIMEOUT";
  if (error.statusCode === 415) return "AI_UNSUPPORTED_CV_FORMAT";
  if (error.statusCode === 413) return "CV_FILE_TOO_LARGE";
  if (error.statusCode === 409) return "CV_ASSET_MISSING";
  if (error.statusCode === 502) return "AI_INVALID_PROVIDER_RESPONSE";
  return "AI_PROCESSING_FAILED";
};

const runCvAiAction = async ({
  accountId,
  cvId,
  aiType,
  payload,
  requestId,
  onResultCreated
}: {
  accountId;
  cvId: string;
  aiType: string;
  payload: AiRequestPayload;
  requestId?: string;
  onResultCreated?: (aiResultId: string) => Promise<void>;
}) => {
  assertAiFeatureEnabled();
  const cv = await getOwnedActiveCv(accountId, cvId);
  const inputText = resolveInputText(cv, payload);
  const config = getAiServiceConfig();

  if (aiType !== AI_TYPES.CV_TRANSLATION) resolveIndustrySlug(payload, config);
  const cvFile = aiType !== AI_TYPES.CV_TRANSLATION
    ? await new CvFileSourceAdapter({ timeoutMs: config.timeoutMs }).getFile(cv)
    : undefined;

  const aiResult = await AIResult.create({
    accountId,
    cvDocumentId: cv._id,
    aiType,
    status: AI_STATUSES.PENDING,
    inputText,
    industrySlug: payload.industrySlug?.trim().toLowerCase(),
    targetRole: payload.targetRole?.trim()
  });

  try {
    if (onResultCreated) await onResultCreated(aiResult._id.toString());
    const output = await generateAiOutput({
      aiType,
      cv,
      inputText,
      payload,
      cvFile,
      requestId
    });
    aiResult.status = AI_STATUSES.COMPLETED;
    aiResult.resultText = output.resultText;
    aiResult.score = output.score;
    aiResult.completedAt = new Date();
    await aiResult.save();
    return serializeAiResult(aiResult, { includeDetails: true });
  } catch (error) {
    const publicError = mapAiServiceError(error);
    aiResult.status = AI_STATUSES.FAILED;
    aiResult.errorMessage = publicError.message;
    aiResult.errorCode = aiErrorCode(publicError);
    aiResult.completedAt = new Date();
    await aiResult.save().catch(() => undefined);
    (publicError as ApiError & { aiResultId?: string }).aiResultId = aiResult._id.toString();
    throw publicError;
  }
};

const generateFeedback = (
  accountId,
  cvId: string,
  payload: AiRequestPayload,
  requestId?: string,
  onResultCreated?: (aiResultId: string) => Promise<void>
) => runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_FEEDBACK, payload, requestId, onResultCreated });

const generateScore = (
  accountId,
  cvId: string,
  payload: AiRequestPayload,
  requestId?: string,
  onResultCreated?: (aiResultId: string) => Promise<void>
) => runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_SCORING, payload, requestId, onResultCreated });

const translateToEnglish = (
  accountId,
  cvId: string,
  payload: AiRequestPayload,
  requestId?: string,
  onResultCreated?: (aiResultId: string) => Promise<void>
) => runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_TRANSLATION, payload, requestId, onResultCreated });

const completeAiResult = async (
  aiResult,
  output: { resultText: string; score?: number }
) => {
  aiResult.status = AI_STATUSES.COMPLETED;
  aiResult.resultText = output.resultText;
  aiResult.score = output.score;
  aiResult.completedAt = new Date();
  aiResult.errorMessage = undefined;
  aiResult.errorCode = undefined;
  await aiResult.save();
};

const failAiResult = async (
  aiResult,
  error: unknown,
  override?: { code: string; message: string }
) => {
  const publicError = mapAiServiceError(error);
  aiResult.status = AI_STATUSES.FAILED;
  aiResult.errorMessage = override?.message || publicError.message;
  aiResult.errorCode = override?.code || aiErrorCode(publicError);
  aiResult.completedAt = new Date();
  await aiResult.save().catch(() => undefined);
};

const workflowStep = (aiResult) => ({
  status: aiResult.status,
  resultId: aiResult._id.toString(),
  errorCode: aiResult.errorCode || null,
  errorMessage: aiResult.errorMessage || null,
  result: serializeAiResult(aiResult, { includeDetails: true })
});

const translateAndScore = async (
  accountId,
  cvId: string,
  payload: AiRequestPayload,
  requestId?: string,
  onResultCreated?: (aiResultId: string) => Promise<void>
) => {
  assertAiFeatureEnabled();
  const cv = await getOwnedActiveCv(accountId, cvId);
  const config = getAiServiceConfig();
  const industrySlug = resolveIndustrySlug(payload, config);
  const targetRole = payload.targetRole?.trim();
  const workflowId = new Types.ObjectId();
  const inputText = resolveInputText(cv, payload);
  const common = {
    accountId,
    cvDocumentId: cv._id,
    status: AI_STATUSES.PENDING,
    inputText,
    industrySlug,
    targetRole,
    workflowId
  };
  const translationResult = await AIResult.create({
    ...common,
    aiType: AI_TYPES.CV_TRANSLATION
  });
  let scoringResult;
  try {
    scoringResult = await AIResult.create({
      ...common,
      aiType: AI_TYPES.CV_SCORING
    });
  } catch (error) {
    await failAiResult(translationResult, error, {
      code: "AI_RESULT_INITIALIZATION_FAILED",
      message: "AI workflow could not be initialized"
    });
    throw error;
  }
  const normalizedPayload = { ...payload, industrySlug, targetRole };

  let extraction: FastApiExtractResponse;
  let sourceText = inputText;

  try {
    if (onResultCreated) await onResultCreated(translationResult._id.toString());
    assertAiFeatureEnabled();
    const file = await new CvFileSourceAdapter({
      timeoutMs: config.timeoutMs
    }).getFile(cv);
    const client = new AiServiceClient({ ...config, requestId });
    extraction = await client.extractCv(file, {
      mode: normalizedPayload.extractionMode || "hybrid",
      targetLanguage: cv.language === "EN" ? "en" : "vi",
      llmModel: normalizedPayload.llmModel?.trim() || undefined
    });
    sourceText = sourceText || cvSectionsToText(extraction.sections);
    requireInputText(sourceText);

    const translation = await client.translate({
      text: sourceText,
      source_lang: normalizedPayload.sourceLang || (cv.language === "EN" ? "en" : "vi"),
      target_lang: "en",
      mode: normalizedPayload.translationMode || "cv_native",
      tier: SERVER_AI_TIER
    });
    await completeAiResult(translationResult, {
      resultText: JSON.stringify(translation)
    });

    try {
      const analysis = await client.analyzeCv(
        getAnalyzeRequest(normalizedPayload, extraction)
      );
      await completeAiResult(scoringResult, {
        resultText: JSON.stringify(analysis),
        score: analysis.overall_score
      });
    } catch (error) {
      await failAiResult(scoringResult, error);
    }
  } catch (error) {
    if (translationResult.status !== AI_STATUSES.COMPLETED) {
      await failAiResult(translationResult, error);
      const publicError = mapAiServiceError(error);
      if (publicError.code === "AI_FEATURE_DISABLED") {
        await failAiResult(scoringResult, error, {
          code: publicError.code,
          message: publicError.message
        });
      } else {
        await failAiResult(scoringResult, error, {
          code: "WORKFLOW_DEPENDENCY_FAILED",
          message: "Scoring did not run because translation failed"
        });
      }
    } else if (scoringResult.status !== AI_STATUSES.COMPLETED) {
      await failAiResult(scoringResult, error);
    }
  }

  const completed =
    translationResult.status === AI_STATUSES.COMPLETED &&
    scoringResult.status === AI_STATUSES.COMPLETED;

  return {
    id: workflowId.toString(),
    status: completed ? AI_STATUSES.COMPLETED : AI_STATUSES.FAILED,
    cvId: cv._id.toString(),
    industrySlug,
    targetRole,
    resultIds: {
      translation: translationResult._id.toString(),
      scoring: scoringResult._id.toString()
    },
    steps: {
      translation: workflowStep(translationResult),
      scoring: workflowStep(scoringResult)
    }
  };
};

const getMyAiResults = async (accountId, filters: { aiType?: string; status?: string }) => {
  const query: { accountId; aiType?: string; status?: string } = { accountId };
  if (filters.aiType) query.aiType = filters.aiType;
  if (filters.status) query.status = filters.status;

  const aiResults = await AIResult.find(query).sort({ createdAt: -1 });
  return aiResults.map((aiResult) => serializeAiResult(aiResult));
};

const getMyAiResultById = async (accountId, aiResultId: string) => {
  const aiResult = await AIResult.findOne({ _id: aiResultId, accountId });
  if (!aiResult) throw new ApiError(404, "AI result not found");
  return serializeAiResult(aiResult, { includeDetails: true });
};

const getMyAiWorkflowByResultId = async (accountId, aiResultId: string) => {
  const seed = await AIResult.findOne({ _id: aiResultId, accountId });
  if (!seed?.workflowId) throw new ApiError(404, "AI workflow not found");

  const results = await AIResult.find({ accountId, workflowId: seed.workflowId });
  const translationResult = results.find((result) => result.aiType === AI_TYPES.CV_TRANSLATION);
  const scoringResult = results.find((result) => result.aiType === AI_TYPES.CV_SCORING);
  if (!translationResult || !scoringResult) {
    throw new ApiError(409, "AI workflow is incomplete", [], "AI_WORKFLOW_INCOMPLETE");
  }

  const completed =
    translationResult.status === AI_STATUSES.COMPLETED &&
    scoringResult.status === AI_STATUSES.COMPLETED;

  return {
    id: seed.workflowId.toString(),
    status: completed ? AI_STATUSES.COMPLETED : AI_STATUSES.FAILED,
    cvId: seed.cvDocumentId?.toString(),
    industrySlug: seed.industrySlug,
    targetRole: seed.targetRole,
    resultIds: {
      translation: translationResult._id.toString(),
      scoring: scoringResult._id.toString()
    },
    steps: {
      translation: workflowStep(translationResult),
      scoring: workflowStep(scoringResult)
    }
  };
};

export {
  generateFeedback,
  generateScore,
  translateToEnglish,
  translateAndScore,
  getMyAiResults,
  getMyAiResultById,
  getMyAiWorkflowByResultId,
  serializeAiResult,
  mapAiServiceError,
  parseStoredResult
};
