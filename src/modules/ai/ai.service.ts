import ApiError from "../../utils/apiError";
import { Types } from "mongoose";
import { AI_STATUSES, AI_TYPES, CV_STATUSES } from "../../constants/enums";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CVDocument from "../cvs/cvDocument.model";
import { CvFileSourceAdapter } from "./adapters/cv-file-source.adapter";
import { cvSectionsToText } from "./adapters/cv-sections-to-text";
import { buildMockAiResult } from "./aiPrompt.service";
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
  tier?: AiTier;
  jdExtract?: FastApiJdExtract;
  llmModel?: string;
  extractionMode?: "local" | "ai" | "hybrid";
  strictIndustryMatch?: boolean;
  sourceLang?: string;
  translationMode?: "literal" | "cv_native";
};

type SerializeAiResultOptions = { includeDetails?: boolean };
type MockAiOutput = { resultText: string; score?: number };

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
    tier: payload.tier || config.defaultTier,
    llm_model: payload.llmModel?.trim() || undefined,
    strict_industry_match: payload.strictIndustryMatch === true
  };
};

const generateAnalyzeOutput = async ({
  cvFile,
  payload,
  aiType
}: {
  cvFile: LocalCvFile;
  payload: AiRequestPayload;
  aiType: string;
}): Promise<MockAiOutput> => {
  const config = getAiServiceConfig();
  const client = new AiServiceClient(config);
  const targetRole = payload.targetRole?.trim();
  const hasJdContext = Boolean(targetRole || payload.jdExtract);
  const requestedTier = payload.tier || config.defaultTier;

  let analysis;
  if (!hasJdContext && requestedTier === "free") {
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
  payload
}: {
  cv;
  inputText: string;
  payload: AiRequestPayload;
}): Promise<MockAiOutput> => {
  const config = getAiServiceConfig();
  const client = new AiServiceClient(config);
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
    tier: payload.tier || config.defaultTier
  });

  return { resultText: JSON.stringify(translation) };
};

const generateAiOutput = async ({
  aiType,
  cv,
  inputText,
  payload,
  cvFile
}: {
  aiType: string;
  cv;
  inputText: string;
  payload: AiRequestPayload;
  cvFile?: LocalCvFile;
}) => {
  const config = getAiServiceConfig();

  if (!config.enabled) {
    return buildMockAiResult({ aiType, inputText, targetRole: payload.targetRole });
  }

  if (aiType === AI_TYPES.CV_TRANSLATION) {
    return generateTranslationOutput({ cv, inputText, payload });
  }

  if (!cvFile) throw new ApiError(409, "CV file is required for AI analysis");
  return generateAnalyzeOutput({ cvFile, payload, aiType });
};

const mapAiServiceError = (error: unknown) => {
  if (error instanceof ApiError) return error;
  if (!isAiServiceError(error)) return new ApiError(502, "AI service request failed");

  if (error.kind === "timeout") return new ApiError(504, "AI service request timed out");
  if (error.kind === "unavailable") return new ApiError(503, "AI service is unavailable");
  if (error.kind === "invalid_response") return new ApiError(502, "AI service returned an invalid response");

  const statusCode = error.statusCode === 429
    ? 429
    : error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 502;

  return new ApiError(statusCode, error.message, error.errors);
};

const aiErrorCode = (error: ApiError) => {
  if (error.code) return error.code;
  if (error.statusCode === 429) return "AI_PROVIDER_RATE_LIMIT";
  if (error.statusCode === 503) return "AI_PROVIDER_UNAVAILABLE";
  if (error.statusCode === 504) return "AI_PROVIDER_TIMEOUT";
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
  payload
}: {
  accountId;
  cvId: string;
  aiType: string;
  payload: AiRequestPayload;
}) => {
  const cv = await getOwnedActiveCv(accountId, cvId);
  const inputText = resolveInputText(cv, payload);
  const config = getAiServiceConfig();
  if (!config.enabled) requireInputText(inputText);

  if (config.enabled && aiType !== AI_TYPES.CV_TRANSLATION) resolveIndustrySlug(payload, config);
  const cvFile = config.enabled && aiType !== AI_TYPES.CV_TRANSLATION
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
    const output = await generateAiOutput({ aiType, cv, inputText, payload, cvFile });
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
    await aiResult.save().catch(() => undefined);
    throw publicError;
  }
};

const generateFeedback = (accountId, cvId: string, payload: AiRequestPayload) =>
  runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_FEEDBACK, payload });

const generateScore = (accountId, cvId: string, payload: AiRequestPayload) =>
  runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_SCORING, payload });

const translateToEnglish = (accountId, cvId: string, payload: AiRequestPayload) =>
  runCvAiAction({ accountId, cvId, aiType: AI_TYPES.CV_TRANSLATION, payload });

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
  payload: AiRequestPayload
) => {
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
  const scoringResult = await AIResult.create({
    ...common,
    aiType: AI_TYPES.CV_SCORING
  });
  const normalizedPayload = { ...payload, industrySlug, targetRole };

  if (!config.enabled) {
    try {
      requireInputText(inputText);
      await completeAiResult(
        translationResult,
        buildMockAiResult({
          aiType: AI_TYPES.CV_TRANSLATION,
          inputText,
          targetRole
        })
      );
      await completeAiResult(
        scoringResult,
        buildMockAiResult({
          aiType: AI_TYPES.CV_SCORING,
          inputText,
          targetRole
        })
      );
    } catch (error) {
      if (translationResult.status !== AI_STATUSES.COMPLETED) {
        await failAiResult(translationResult, error);
      }
      if (scoringResult.status !== AI_STATUSES.COMPLETED) {
        await failAiResult(scoringResult, error);
      }
    }
  } else {
    let extraction: FastApiExtractResponse;
    let sourceText = inputText;

    try {
      const file = await new CvFileSourceAdapter({
        timeoutMs: config.timeoutMs
      }).getFile(cv);
      const client = new AiServiceClient(config);
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
        tier: normalizedPayload.tier || config.defaultTier
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
        await failAiResult(scoringResult, error, {
          code: "WORKFLOW_DEPENDENCY_FAILED",
          message: "Scoring did not run because translation failed"
        });
      } else if (scoringResult.status !== AI_STATUSES.COMPLETED) {
        await failAiResult(scoringResult, error);
      }
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

export {
  generateFeedback,
  generateScore,
  translateToEnglish,
  translateAndScore,
  getMyAiResults,
  getMyAiResultById,
  serializeAiResult,
  mapAiServiceError,
  parseStoredResult
};
