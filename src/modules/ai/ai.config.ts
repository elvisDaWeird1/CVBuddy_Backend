const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);
const DEFAULT_INDUSTRY_SLUGS = [
  "ai_software",
  "business_administration",
  "computer_science",
  "language",
  "law",
  "marketing"
];

type AiCompanyModel = "corporate" | "startup_agency";
type AiLanguage = "vi" | "en" | "both";
type AiTier = "free" | "subscription";

type AiServiceConfig = {
  enabled: boolean;
  baseUrl: string;
  timeoutMs: number;
  defaultIndustrySlug: string;
  supportedIndustrySlugs: string[];
  defaultVerticalSlug?: string;
  defaultCompanyModel: AiCompanyModel;
  defaultLanguage: AiLanguage;
  defaultTier: AiTier;
};

const parseBoolean = (value: string | undefined, defaultValue: boolean) => {
  if (!value) {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();

  if (TRUE_VALUES.has(normalized)) {
    return true;
  }

  if (FALSE_VALUES.has(normalized)) {
    return false;
  }

  return defaultValue;
};

const parsePositiveInteger = (value: string | undefined, defaultValue: number) => {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : defaultValue;
};

const parseIndustrySlugs = (value: string | undefined) => {
  const slugs = (value || DEFAULT_INDUSTRY_SLUGS.join(","))
    .split(",")
    .map((slug) => slug.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(slugs)];
};

const getAiServiceConfig = (): AiServiceConfig => {
  const companyModel = process.env.AI_DEFAULT_COMPANY_MODEL;
  const language = process.env.AI_DEFAULT_LANGUAGE;
  const tier = process.env.AI_DEFAULT_TIER;
  const supportedIndustrySlugs = parseIndustrySlugs(process.env.AI_SUPPORTED_INDUSTRY_SLUGS);
  const defaultIndustrySlug = (
    process.env.AI_DEFAULT_INDUSTRY_SLUG || "language"
  ).trim().toLowerCase();

  return {
    enabled: parseBoolean(process.env.AI_SERVICE_ENABLED, true),
    baseUrl: (process.env.AI_SERVICE_URL || "http://localhost:8001").trim().replace(/\/+$/, ""),
    timeoutMs: parsePositiveInteger(process.env.AI_SERVICE_TIMEOUT_MS, 60_000),
    defaultIndustrySlug,
    supportedIndustrySlugs,
    defaultVerticalSlug: process.env.AI_DEFAULT_VERTICAL_SLUG?.trim() || undefined,
    defaultCompanyModel: companyModel === "startup_agency" ? "startup_agency" : "corporate",
    defaultLanguage: language === "vi" || language === "en" ? language : "both",
    defaultTier: tier === "subscription" ? "subscription" : "free"
  };
};

export {
  getAiServiceConfig,
  type AiCompanyModel,
  type AiLanguage,
  type AiServiceConfig,
  type AiTier
};