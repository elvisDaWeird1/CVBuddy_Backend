import mongoose from "mongoose";
import { z } from "zod";

import {
  PORTFOLIO_EVIDENCE_TYPE_VALUES,
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUS_VALUES,
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES,
  PORTFOLIO_EXPERIENCE_STATUS_VALUES,
  PORTFOLIO_EXPERIENCE_TYPE_VALUES,
  PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES,
  PORTFOLIO_MOMENT_STATUS_VALUES
} from "../../constants/enums";

const zodEnum = (values: string[]) => z.enum(values as [string, ...string[]]);
const objectId = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), {
  message: "Must be a valid MongoDB id"
});
const optionalObjectId = z.preprocess(
  (value) => (value === "" ? undefined : value),
  objectId.nullable().optional()
);

const optionalDate = z.preprocess(
  (value) =>
    value === null || value === ""
      ? undefined
      : value instanceof Date
        ? value
        : typeof value === "string"
          ? new Date(value)
          : value,
  z.date().optional()
);
const requiredDate = z.preprocess(
  (value) => (value instanceof Date ? value : typeof value === "string" && value ? new Date(value) : value),
  z.date()
);
const optionalBoolean = z.preprocess(
  (value) =>
    value === ""
      ? undefined
      : value === "true"
        ? true
        : value === "false"
          ? false
          : value,
  z.boolean().optional()
);
const stringArray = z.array(z.string().trim().min(1)).max(30);
const httpUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith("http://") || value.startsWith("https://"), {
    message: "URL must use http or https"
  });
const optionalHttpUrl = z.preprocess(
  (value) => (value === "" ? undefined : value),
  httpUrl.optional()
);
const clientEvidenceVerificationStatus = zodEnum(
  PORTFOLIO_EVIDENCE_VERIFICATION_STATUS_VALUES.filter(
    (value) => value !== PORTFOLIO_EVIDENCE_VERIFICATION_STATUSES.VERIFIED
  )
);
const socialLinks = z.union([
  z.record(httpUrl),
  z.array(z.object({ platform: z.string().trim().min(1).max(50), url: httpUrl }))
]);

const portfolioProfileSchema = z
  .object({
    headline: z.string().trim().max(180).optional(),
    about: z.string().trim().max(5000).optional(),
    desiredRole: z.string().trim().max(180).optional(),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug may contain only lowercase letters, numbers and hyphens")
      .max(120)
      .optional(),
    skills: stringArray.optional(),
    socialLinks: socialLinks.optional()
  })
  .strict();

const experienceShape = {
  type: zodEnum(PORTFOLIO_EXPERIENCE_TYPE_VALUES),
  title: z.string().trim().min(2).max(150),
  organization: z.string().trim().max(150).optional(),
  role: z.string().trim().max(150).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  isCurrent: optionalBoolean,
  location: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
  responsibilities: stringArray.optional(),
  achievements: stringArray.optional(),
  skills: stringArray.optional(),
  visibility: zodEnum(PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES).optional()
};

const experienceSchema = z.object(experienceShape).strict().superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate cannot be before startDate" });
  }

  if (value.isCurrent && value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must be empty when isCurrent is true" });
  }
});

const experienceUpdateSchema = z
  .object(experienceShape)
  .partial()
  .strict()
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate cannot be before startDate" });
    }

    if (value.isCurrent && value.endDate) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "endDate must be empty when isCurrent is true" });
    }
  });

const momentSchema = z
  .object({
    caption: z.string().trim().max(500).optional(),
    capturedAt: requiredDate,
    experienceId: optionalObjectId,
    location: z.string().trim().max(200).optional(),
    skills: stringArray.optional(),
    status: zodEnum(PORTFOLIO_MOMENT_STATUS_VALUES).optional(),
    visibility: zodEnum(PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.capturedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capturedAt"],
        message: "capturedAt cannot be too far in the future"
      });
    }
  });

const momentUpdateSchema = z
  .object({
    caption: z.string().trim().max(500).optional(),
    capturedAt: optionalDate,
    experienceId: optionalObjectId,
    location: z.string().trim().max(200).optional(),
    skills: stringArray.optional(),
    status: zodEnum(PORTFOLIO_MOMENT_STATUS_VALUES).optional(),
    visibility: zodEnum(PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES).optional()
  })
  .strict()
  .superRefine((value, context) => {
    if (value.capturedAt && value.capturedAt.getTime() > Date.now() + 5 * 60 * 1000) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["capturedAt"],
        message: "capturedAt cannot be too far in the future"
      });
    }
  });

const evidenceSchema = z
  .object({
    type: zodEnum(PORTFOLIO_EVIDENCE_TYPE_VALUES),
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(2000).optional(),
    url: optionalHttpUrl,
    verificationStatus: clientEvidenceVerificationStatus.optional()
  })
  .strict();

const evidenceUpdateSchema = z
  .object({
    type: zodEnum(PORTFOLIO_EVIDENCE_TYPE_VALUES).optional(),
    title: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    url: z.preprocess(
      (value) => (value === "" ? undefined : value),
      httpUrl.nullable().optional()
    ),
    verificationStatus: clientEvidenceVerificationStatus.optional()
  })
  .strict();

const featuredExperiencesSchema = z
  .object({
    featuredExperienceIds: z.array(objectId).max(6)
  })
  .strict();

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: zodEnum(PORTFOLIO_EXPERIENCE_STATUS_VALUES).optional(),
  type: zodEnum(PORTFOLIO_EXPERIENCE_TYPE_VALUES).optional(),
  search: z.string().trim().max(150).optional()
});

const momentPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  experienceId: z.preprocess((value) => (value === "" ? undefined : value), objectId.optional()),
  status: zodEnum(PORTFOLIO_MOMENT_STATUS_VALUES).optional(),
  visibility: zodEnum(PORTFOLIO_EXPERIENCE_VISIBILITY_VALUES).optional()
});

const parseJsonField = (value: unknown) => {
  if (typeof value !== "string") {
    return value;
  }

  if (!value.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const normalizeBody = (body: Record<string, unknown> = {}) => {
  const normalized = { ...body };

  ["skills", "responsibilities", "achievements", "socialLinks"].forEach((field) => {
    if (normalized[field] !== undefined) {
      normalized[field] = parseJsonField(normalized[field]);
    }
  });

  return normalized;
};

const zodErrors = (error: z.ZodError) =>
  error.issues.map((issue) => ({
    field: issue.code === "unrecognized_keys" && issue.keys?.length
      ? issue.keys[0]
      : issue.path.length
        ? issue.path.join(".")
        : "body",
    message: issue.message
  }));

const validateSchema = (schema: z.ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  return result.success ? [] : zodErrors(result.error);
};

const validatePortfolioProfile = (req) => validateSchema(portfolioProfileSchema, normalizeBody(req.body));
const validateExperienceCreate = (req) => validateSchema(experienceSchema, normalizeBody(req.body));
const validateExperienceUpdate = (req) => validateSchema(experienceUpdateSchema, normalizeBody(req.body));
const validateMomentCreate = (req) => {
  const errors = validateSchema(momentSchema, normalizeBody(req.body));
  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length < 1) {
    errors.push({ field: "media", message: "At least one media file is required" });
  }

  if (files.length > 5) {
    errors.push({ field: "media", message: "A moment can contain at most 5 media files" });
  }

  return errors;
};
const validateMomentUpdate = (req) => validateSchema(momentUpdateSchema, normalizeBody(req.body));
const validateEvidenceCreate = (req) => validateSchema(evidenceSchema, normalizeBody(req.body));
const validateEvidenceUpdate = (req) => validateSchema(evidenceUpdateSchema, normalizeBody(req.body));
const validateFeaturedExperiences = (req) =>
  validateSchema(featuredExperiencesSchema, normalizeBody(req.body));
const validateExperienceList = (req) => validateSchema(paginationSchema, req.query);
const validateMomentList = (req) => validateSchema(momentPaginationSchema, req.query);

const validateObjectIdParam = (field: string) => (req) => {
  const value = req.params[field];

  return mongoose.Types.ObjectId.isValid(value)
    ? []
    : [{ field, message: `${field} must be a valid MongoDB id` }];
};

const validateSlugParam = (req) => {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(req.params.slug)
    ? []
    : [{ field: "slug", message: "slug may contain only lowercase letters, numbers and hyphens" }];
};

const validateExperienceCover = (req) => {
  if (req.file) {
    return [];
  }

  return mongoose.Types.ObjectId.isValid(req.body?.assetId)
    ? []
    : [{ field: "assetId", message: "assetId or cover file is required" }];
};

const validateMomentAssignment = (req) => {
  return mongoose.Types.ObjectId.isValid(req.body?.experienceId)
    ? []
    : [{ field: "experienceId", message: "experienceId must be a valid MongoDB id" }];
};

export {
  validateEvidenceCreate,
  validateEvidenceUpdate,
  validateExperienceCreate,
  validateExperienceCover,
  validateExperienceList,
  validateExperienceUpdate,
  validateFeaturedExperiences,
  validateMomentCreate,
  validateMomentUpdate,
  validateMomentAssignment,
  validateObjectIdParam,
  validateMomentList,
  validatePortfolioProfile,
  validateSlugParam
};
