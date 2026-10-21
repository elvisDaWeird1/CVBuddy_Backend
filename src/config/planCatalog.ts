const PLAN_CATALOG_VERSION = "2026-10-22";

const PLAN_CODES = Object.freeze({
  FREE: "FREE",
  PRO_30D: "PRO_30D"
});

const AI_FEATURE_KEYS = Object.freeze({
  CV_EVALUATION: "CV_EVALUATION",
  CV_TRANSLATION: "CV_TRANSLATION",
  TRANSLATE_AND_EVALUATE: "TRANSLATE_AND_EVALUATE",
  TARGETED_REVIEW: "TARGETED_REVIEW"
});

const PLAN_CATALOG = Object.freeze({
  [PLAN_CODES.FREE]: Object.freeze({
    code: PLAN_CODES.FREE,
    durationDays: null,
    creditsGranted: 4,
    priceVnd: 0
  }),
  [PLAN_CODES.PRO_30D]: Object.freeze({
    code: PLAN_CODES.PRO_30D,
    durationDays: 30,
    creditsGranted: 60,
    priceVnd: 49_000
  })
});

const AI_CREDIT_COSTS = Object.freeze({
  [AI_FEATURE_KEYS.CV_EVALUATION]: 2,
  [AI_FEATURE_KEYS.CV_TRANSLATION]: 2,
  [AI_FEATURE_KEYS.TRANSLATE_AND_EVALUATE]: 4,
  [AI_FEATURE_KEYS.TARGETED_REVIEW]: 3
});

type PlanCode = typeof PLAN_CODES[keyof typeof PLAN_CODES];
type AiFeatureKey = typeof AI_FEATURE_KEYS[keyof typeof AI_FEATURE_KEYS];

export {
  AI_CREDIT_COSTS,
  AI_FEATURE_KEYS,
  PLAN_CATALOG,
  PLAN_CATALOG_VERSION,
  PLAN_CODES,
  type AiFeatureKey,
  type PlanCode
};
