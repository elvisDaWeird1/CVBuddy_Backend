import type { AiServiceConfig } from "../ai.config";

type ErrorItem = {
  field?: string;
  message: string;
};

type FastApiCvSections = {
  summary: string[];
  experience: string[];
  education: string[];
  skills: string[];
  projects: string[];
  certifications: string[];
  other: string[];
};

type FastApiLocalMetrics = {
  bullet_count: number;
  quantified_bullet_count: number;
  has_quantified_bullets: boolean;
  avg_bullet_length: number;
  section_count: number;
  detected_languages: string[];
};

type FastApiExtractResponse = {
  sections: FastApiCvSections;
  structured_document?: unknown;
  coverage?: unknown;
  local_metrics: FastApiLocalMetrics;
  meta: Record<string, unknown>;
  normalized_text_length: number;
};

type FastApiJdExtract = {
  role_title?: string;
  company_name?: string;
  required_keywords?: string[];
  preferred_keywords?: string[];
  responsibilities?: string[];
};

type FastApiAnalyzeRequest = {
  sections: FastApiCvSections;
  industry_slug: string;
  vertical_slug?: string;
  company_model: "corporate" | "startup_agency";
  jd_extract?: FastApiJdExtract;
  language: "vi" | "en" | "both";
  tier: "free" | "subscription";
  local_metrics?: FastApiLocalMetrics;
  llm_model?: string;
  strict_industry_match: boolean;
};

type FastApiAnalyzeResponse = {
  overall_score: number;
  dimensions: {
    layout_ats: Record<string, unknown>;
    language: Record<string, unknown>;
    keywords: Record<string, unknown>;
    jd_fit: Record<string, unknown>;
  };
  rewrites: unknown[];
  company_model_feedback: string;
  confidence: number;
  disclaimer: string;
  meta: Record<string, string>;
};

type FastApiTranslateRequest = {
  text: string;
  source_lang: string;
  target_lang: string;
  mode: "literal" | "cv_native";
  tier: "free" | "subscription";
};

type FastApiTranslateResponse = {
  translated: string;
  notes: string[];
  meta: Record<string, string>;
};

type FastApiPortfolioSuggestRequest = {
  activity_text: string;
  industry_slug: string;
  vertical_slug?: string;
  optional_caption?: string;
  tier: "free" | "subscription";
};

type FastApiPortfolioFromImageRequest = {
  image_url: string;
  industry_slug: string;
  vertical_slug?: string;
  optional_caption?: string;
  tier: "free" | "subscription";
};

type FastApiPortfolioSuggestResponse = {
  activity_summary_vi: string;
  activity_summary_en: string;
  suggested_cv_bullet_vi: string;
  suggested_cv_bullet_en: string;
  action_verbs: string[];
  industry_keywords: string[];
  confidence: number;
  meta: Record<string, string>;
};

type LocalCvFile = {
  bytes: Buffer;
  filename: string;
  mimeType: string;
};

type AiServiceErrorKind = "unavailable" | "timeout" | "http" | "invalid_response";

class AiServiceError extends Error {
  readonly kind: AiServiceErrorKind;
  readonly statusCode?: number;
  readonly errors: ErrorItem[];

  constructor(
    kind: AiServiceErrorKind,
    message: string,
    options: { statusCode?: number; errors?: ErrorItem[] } = {}
  ) {
    super(message);
    this.name = "AiServiceError";
    this.kind = kind;
    this.statusCode = options.statusCode;
    this.errors = options.errors || [];
  }
}

const isAiServiceError = (error: unknown): error is AiServiceError =>
  error instanceof AiServiceError;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNumber = (value: unknown) => typeof value === "number" && Number.isFinite(value);

const parseErrorItems = (payload: unknown): ErrorItem[] => {
  if (!isRecord(payload) || !Array.isArray(payload.detail)) {
    return [];
  }

  return payload.detail.flatMap((item): ErrorItem[] => {
    if (typeof item === "string") {
      return [{ message: item }];
    }

    if (!isRecord(item) || typeof item.msg !== "string") {
      return [];
    }

    const location = Array.isArray(item.loc)
      ? item.loc.filter((part): part is string => typeof part === "string").join(".")
      : undefined;

    return [{ field: location, message: item.msg }];
  });
};

const parseJsonBody = (raw: string): unknown => {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new AiServiceError("invalid_response", "AI service returned invalid JSON");
  }
};

const validateExtractResponse = (payload: unknown): FastApiExtractResponse => {
  if (!isRecord(payload) || !isRecord(payload.sections) || !isRecord(payload.local_metrics)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid extraction response");
  }

  if (!isNumber(payload.normalized_text_length)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid extraction response");
  }

  return payload as unknown as FastApiExtractResponse;
};

const validateAnalyzeResponse = (payload: unknown): FastApiAnalyzeResponse => {
  if (!isRecord(payload) || !isRecord(payload.dimensions)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid analysis response");
  }

  const requiredDimensions = ["layout_ats", "language", "keywords", "jd_fit"];
  if (!requiredDimensions.every((key) => isRecord(payload.dimensions?.[key]))) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid analysis response");
  }

  if (!isNumber(payload.overall_score) || !isNumber(payload.confidence)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid analysis response");
  }

  return payload as unknown as FastApiAnalyzeResponse;
};

const validateTranslateResponse = (payload: unknown): FastApiTranslateResponse => {
  if (!isRecord(payload) || typeof payload.translated !== "string" || !Array.isArray(payload.notes)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid translation response");
  }

  return payload as unknown as FastApiTranslateResponse;
};

const validatePortfolioResponse = (payload: unknown): FastApiPortfolioSuggestResponse => {
  if (!isRecord(payload) || !isNumber(payload.confidence)) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid Portfolio response");
  }

  const requiredStrings = [
    "activity_summary_vi",
    "activity_summary_en",
    "suggested_cv_bullet_vi",
    "suggested_cv_bullet_en"
  ];

  if (!requiredStrings.every((key) => typeof payload[key] === "string")) {
    throw new AiServiceError("invalid_response", "AI service returned an invalid Portfolio response");
  }

  return payload as unknown as FastApiPortfolioSuggestResponse;
};

class AiServiceClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(options: Partial<Pick<AiServiceConfig, "baseUrl" | "timeoutMs">> & { fetchImpl?: typeof fetch } = {}) {
    this.baseUrl = (options.baseUrl || "http://localhost:8001").replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs || 60_000;
    this.fetchImpl = options.fetchImpl || fetch;
  }

  private async request<T>(
    path: string,
    options: RequestInit,
    validate: (payload: unknown) => T
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");

    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal
      });
      const payload = parseJsonBody(await response.text());

      if (!response.ok) {
        const statusCode = response.status;
        const message = statusCode === 429
          ? "AI service quota exceeded"
          : statusCode >= 500
            ? "AI service returned an internal error"
            : "AI service rejected the request";

        throw new AiServiceError("http", message, {
          statusCode,
          errors: statusCode >= 500 ? [] : parseErrorItems(payload)
        });
      }

      return validate(payload);
    } catch (error) {
      if (isAiServiceError(error)) {
        console.warn("AI service request failed", { path, kind: error.kind, statusCode: error.statusCode });
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        throw new AiServiceError("timeout", "AI service request timed out");
      }

      throw new AiServiceError("unavailable", "AI service is unavailable");
    } finally {
      clearTimeout(timeout);
    }
  }

  private async requestJson<T>(
    path: string,
    body: unknown,
    validate: (payload: unknown) => T
  ) {
    return this.request(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }, validate);
  }

  async health() {
    return this.request("/health", { method: "GET" }, (payload) => {
      if (!isRecord(payload) || payload.status !== "ok") {
        throw new AiServiceError("invalid_response", "AI service returned an invalid health response");
      }

      return payload as { status: string; service?: string; env?: string };
    });
  }

  async extractCv(file: LocalCvFile, options: { mode: string; targetLanguage: string; llmModel?: string }) {
    const query = new URLSearchParams({
      mode: options.mode,
      target_language: options.targetLanguage
    });

    if (options.llmModel) {
      query.set("llm_model", options.llmModel);
    }

    const form = new FormData();
    form.append("file", new Blob([file.bytes as unknown as BlobPart], { type: file.mimeType }), file.filename);

    return this.request(`/v1/cv/extract?${query.toString()}`, {
      method: "POST",
      body: form
    }, validateExtractResponse);
  }

  async extractAndAnalyze(file: LocalCvFile, query: Record<string, string>) {
    const params = new URLSearchParams(query);
    const form = new FormData();
    form.append("file", new Blob([file.bytes as unknown as BlobPart], { type: file.mimeType }), file.filename);

    return this.request(`/v1/cv/extract-and-analyze?${params.toString()}`, {
      method: "POST",
      body: form
    }, validateAnalyzeResponse);
  }

  analyzeCv(body: FastApiAnalyzeRequest) {
    return this.requestJson("/v1/cv/analyze", body, validateAnalyzeResponse);
  }

  translate(body: FastApiTranslateRequest) {
    return this.requestJson("/v1/translate", body, validateTranslateResponse);
  }

  suggestPortfolio(body: FastApiPortfolioSuggestRequest) {
    return this.requestJson("/v1/portfolio/suggest", body, validatePortfolioResponse);
  }

  suggestPortfolioFromImage(body: FastApiPortfolioFromImageRequest) {
    return this.requestJson("/v1/portfolio/from-image", body, validatePortfolioResponse);
  }
}

export {
  AiServiceClient,
  AiServiceError,
  isAiServiceError,
  type ErrorItem,
  type FastApiAnalyzeRequest,
  type FastApiAnalyzeResponse,
  type FastApiCvSections,
  type FastApiExtractResponse,
  type FastApiJdExtract,
  type FastApiLocalMetrics,
  type FastApiPortfolioFromImageRequest,
  type FastApiPortfolioSuggestRequest,
  type FastApiPortfolioSuggestResponse,
  type FastApiTranslateRequest,
  type FastApiTranslateResponse,
  type LocalCvFile
};
