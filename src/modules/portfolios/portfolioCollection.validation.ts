import mongoose from "mongoose";
import { z } from "zod";

import {
  PORTFOLIO_EXPERIENCE_TYPE_VALUES,
  VISIBILITY_VALUES
} from "../../constants/enums";

const objectId = z.string().refine(
  (value) => mongoose.Types.ObjectId.isValid(value),
  "Must be a valid MongoDB id"
);
const visibility = z.enum(VISIBILITY_VALUES as [string, ...string[]]);
const experienceType = z.enum(
  PORTFOLIO_EXPERIENCE_TYPE_VALUES as [string, ...string[]]
);

const createSchema = z.object({
  title: z.string().trim().min(2).max(100),
  description: z.string().trim().max(2000).optional()
}).strict();

const updateSchema = createSchema.partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

const visibilitySchema = z.object({
  visibility
}).strict();

const experienceSchema = z.object({
  type: experienceType,
  title: z.string().trim().min(2).max(150),
  organization: z.string().trim().max(150).optional(),
  role: z.string().trim().max(150).optional(),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(200).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  isCurrent: z.boolean().optional(),
  responsibilities: z.array(z.string().trim().min(1)).max(30).optional(),
  achievements: z.array(z.string().trim().min(1)).max(30).optional(),
  skills: z.array(z.string().trim().min(1)).max(30).optional()
}).strict();

const momentSchema = z.object({
  caption: z.string().trim().max(500).optional(),
  capturedAt: z.coerce.date().optional()
}).strict();

const errorsFor = (schema: z.ZodType, value: unknown) => {
  const result = schema.safeParse(value);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message
  }));
};

const validatePortfolioId = (req) => {
  const result = objectId.safeParse(req.params.portfolioId);
  return result.success
    ? []
    : [{ field: "portfolioId", message: result.error.issues[0].message }];
};

const validatePortfolioCreate = (req) => errorsFor(createSchema, req.body || {});
const validatePortfolioUpdate = (req) => errorsFor(updateSchema, req.body || {});
const validatePortfolioVisibility = (req) => errorsFor(visibilitySchema, req.body || {});
const validatePortfolioExperienceCreate = (req) =>
  errorsFor(experienceSchema, req.body || {});
const validatePortfolioMomentCreate = (req) => {
  const errors = errorsFor(momentSchema, req.body || {});
  if (!req.file) {
    errors.push({ field: "image", message: "Portfolio Moment image is required" });
  }
  return errors;
};

export {
  validatePortfolioCreate,
  validatePortfolioExperienceCreate,
  validatePortfolioId,
  validatePortfolioMomentCreate,
  validatePortfolioUpdate,
  validatePortfolioVisibility
};
