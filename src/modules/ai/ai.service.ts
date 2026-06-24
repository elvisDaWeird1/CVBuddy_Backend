import ApiError from "../../utils/apiError";
import { AI_STATUSES, AI_TYPES, CV_STATUSES } from "../../constants/enums";
import ApplicantProfile from "../applicantProfiles/applicantProfile.model";
import CVDocument from "../cvs/cvDocument.model";
import AIResult from "./aiResult.model";
import { buildMockAiResult } from "./aiPrompt.service";

type AiRequestPayload = {
  targetRole?: string;
  cvText?: string;
};

type SerializeAiResultOptions = {
  includeDetails?: boolean;
};

const serializeAiResult = (aiResult, options: SerializeAiResultOptions = {}) => {
  if (!aiResult) {
    return null;
  }

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
    errorMessage?: string | null;
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

  if (options.includeDetails) {
    payload.inputText = aiResult.inputText || "";
    payload.resultText = aiResult.resultText || "";
    payload.errorMessage = aiResult.errorMessage || null;
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

  if (!cv) {
    throw new ApiError(404, "CV not found");
  }

  return cv;
};

const resolveInputText = (cv, payload: AiRequestPayload) => {
  const extractedText = typeof cv.extractedText === "string" ? cv.extractedText.trim() : "";
  const providedText =
    typeof payload.cvText === "string" ? payload.cvText.trim() : "";

  if (extractedText) {
    return extractedText;
  }

  if (providedText) {
    return providedText;
  }

  throw new ApiError(400, "CV text is empty. Please provide cvText or upload a readable CV.", [
    {
      field: "cvText",
      message: "cvText is required when CV extractedText is empty"
    }
  ]);
};

const generateAiOutput = async ({
  aiType,
  inputText,
  targetRole
}: {
  aiType: string;
  inputText: string;
  targetRole?: string;
}) => {
  const provider = process.env.AI_PROVIDER || "mock";
  const hasApiKey = Boolean(process.env.AI_API_KEY);

  if (provider !== "mock" && hasApiKey) {
    // Real provider integration is intentionally deferred; MVP uses mock output.
  }

  return buildMockAiResult({
    aiType,
    inputText,
    targetRole
  });
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

  const aiResult = await AIResult.create({
    accountId,
    cvDocumentId: cv._id,
    aiType,
    status: AI_STATUSES.PENDING,
    inputText
  });

  try {
    const output = await generateAiOutput({
      aiType,
      inputText,
      targetRole: payload.targetRole
    });

    aiResult.status = AI_STATUSES.COMPLETED;
    aiResult.resultText = output.resultText;
    aiResult.score = output.score;
    aiResult.completedAt = new Date();
    await aiResult.save();

    return serializeAiResult(aiResult, { includeDetails: true });
  } catch (error) {
    aiResult.status = AI_STATUSES.FAILED;
    aiResult.errorMessage = error instanceof Error ? error.message : "AI processing failed";
    await aiResult.save();

    throw new ApiError(500, "AI processing failed");
  }
};

const generateFeedback = async (accountId, cvId: string, payload: AiRequestPayload) => {
  return runCvAiAction({
    accountId,
    cvId,
    aiType: AI_TYPES.CV_FEEDBACK,
    payload
  });
};

const generateScore = async (accountId, cvId: string, payload: AiRequestPayload) => {
  return runCvAiAction({
    accountId,
    cvId,
    aiType: AI_TYPES.CV_SCORING,
    payload
  });
};

const translateToEnglish = async (accountId, cvId: string, payload: AiRequestPayload) => {
  return runCvAiAction({
    accountId,
    cvId,
    aiType: AI_TYPES.CV_TRANSLATION,
    payload
  });
};

const getMyAiResults = async (accountId, filters: { aiType?: string; status?: string }) => {
  const query: {
    accountId;
    aiType?: string;
    status?: string;
  } = {
    accountId
  };

  if (filters.aiType) {
    query.aiType = filters.aiType;
  }

  if (filters.status) {
    query.status = filters.status;
  }

  const aiResults = await AIResult.find(query).sort({ createdAt: -1 });

  return aiResults.map((aiResult) => serializeAiResult(aiResult));
};

const getMyAiResultById = async (accountId, aiResultId: string) => {
  const aiResult = await AIResult.findOne({
    _id: aiResultId,
    accountId
  });

  if (!aiResult) {
    throw new ApiError(404, "AI result not found");
  }

  return serializeAiResult(aiResult, { includeDetails: true });
};

export {
  generateFeedback,
  generateScore,
  translateToEnglish,
  getMyAiResults,
  getMyAiResultById,
  serializeAiResult
};
