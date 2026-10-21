import { rateLimit } from "express-rate-limit";

import ApiError from "../utils/apiError";

const rateLimitError = (message: string) => (req, res, next) =>
  next(new ApiError(429, message, [], "RATE_LIMITED"));

const parseLimit = (value: string | undefined, fallback: number, min: number, max: number) => {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

const createRateLimit = (windowMs: number, limit: number, message: string, skip?: (req) => boolean) => rateLimit({
  windowMs,
  limit,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test" || process.env.DISABLE_RATE_LIMIT === "true" || Boolean(skip?.(req)),
  handler: rateLimitError(message)
});

const generalRateLimit = createRateLimit(
  15 * 60 * 1000,
  600,
  "Too many requests. Please try again later.",
  (req) => req.path === "/api/billing/webhooks/payos"
);
const authRateLimit = createRateLimit(
  15 * 60 * 1000,
  10,
  "Too many authentication attempts. Please try again later."
);
const uploadRateLimit = createRateLimit(
  60 * 60 * 1000,
  30,
  "Too many upload attempts. Please try again later."
);
const aiRateLimit = createRateLimit(
  60 * 60 * 1000,
  20,
  "Too many AI requests. Please try again later."
);
const billingCheckoutRateLimit = createRateLimit(
  15 * 60 * 1000,
  10,
  "Too many checkout attempts. Please try again later."
);
const billingWebhookRateLimit = createRateLimit(
  60 * 1000,
  parseLimit(process.env.BILLING_WEBHOOK_RATE_LIMIT, 60, 10, 10_000),
  "Too many payment webhook attempts. Please try again later."
);

export {
  aiRateLimit,
  authRateLimit,
  billingCheckoutRateLimit,
  billingWebhookRateLimit,
  createRateLimit,
  parseLimit,
  generalRateLimit,
  uploadRateLimit
};
