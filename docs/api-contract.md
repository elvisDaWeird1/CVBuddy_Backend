# API Contract

This document is the source of truth for intended public CVBuddy backend API behavior and response contracts. `src/docs/swagger.paths.ts` is the implementation source used to generate Swagger/OpenAPI documentation and should stay aligned with this file.

If this file and `src/docs/swagger.paths.ts` disagree, do not guess. Inspect the route and controller code, then reconcile the mismatch according to the current task or report it clearly.

## General

- All paths below are full API paths with the `/api` prefix.
- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/docs.json`
- Protected routes use `Authorization: Bearer <token>`.
- Success response shape: `{ success: true, message, data? }`.
- Error response shape: `{ success: false, message, errors }`.

## Current Routes

- `GET /api/health`
- `POST /api/auth/register/applicant`
- `POST /api/auth/register/company`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/change-password`
- `GET /api/applicant-profile/me`
- `PATCH /api/applicant-profile/me`
- `POST /api/uploads/avatar`
- `POST /api/uploads/portfolio-photo`
- `POST /api/uploads/cv`
- `GET /api/uploads/cv/:id/download`
- `POST /api/cvs`
- `GET /api/cvs`
- `GET /api/cvs/:id`
- `DELETE /api/cvs/:id`
- `POST /api/ai/cvs/:cvId/feedback`
- `POST /api/ai/cvs/:cvId/score`
- `POST /api/ai/cvs/:cvId/translate-to-english`
- `GET /api/ai/results`
- `GET /api/ai/results/:id`
- `POST /api/portfolios`
- `GET /api/portfolios/me`
- `PATCH /api/portfolios/me`
- `GET /api/portfolios/public/:portfolioId`
- `POST /api/portfolio-items`
- `GET /api/portfolio-items/me`
- `GET /api/portfolio-items/:id`
- `PATCH /api/portfolio-items/:id`
- `DELETE /api/portfolio-items/:id`
- `POST /api/mobile/portfolio/photos`

## Portfolio Domain APIs

The current portfolio domain uses `/api/portfolio`. All private endpoints require an Applicant JWT; ownership is derived from the authenticated account and clients must not send `applicantId`.

### Portfolio profile

- `GET /api/portfolio/me`
- `PUT /api/portfolio/me`
- `PATCH /api/portfolio/me/publish`
- `PATCH /api/portfolio/me/unpublish`
- `PUT /api/portfolio/me/featured-experiences`
- `GET /api/portfolio/public/:slug` (public, only when `isPublic` is true)

### Experiences

- `POST /api/portfolio/experiences`
- `GET /api/portfolio/experiences?page=1&limit=20&status=draft&type=project&search=node`
- `GET /api/portfolio/experiences/:id`
- `PATCH /api/portfolio/experiences/:id`
- `DELETE /api/portfolio/experiences/:id`
- `PATCH /api/portfolio/experiences/:id/publish`
- `PATCH /api/portfolio/experiences/:id/archive`
- `PATCH /api/portfolio/experiences/:id/cover` (JSON `assetId` or multipart `cover`)
- `POST /api/portfolio/experiences/:id/cover` (compatibility alias for cover update)

### Moments

- `POST /api/portfolio/moments` (multipart `media`, 1�5 files; `capturedAt` is required)
- `GET /api/portfolio/moments`
- `GET /api/portfolio/moments/:id`
- `PATCH /api/portfolio/moments/:id`
- `DELETE /api/portfolio/moments/:id`
- `PATCH /api/portfolio/moments/:id/assign-experience`
- `PATCH /api/portfolio/moments/:id/unassign-experience`

### Evidence

- `POST /api/portfolio/experiences/:experienceId/evidence` (JSON URL or multipart `file`)
- `GET /api/portfolio/experiences/:experienceId/evidence`
- `PATCH /api/portfolio/evidence/:id`
- `DELETE /api/portfolio/evidence/:id`

The legacy `/api/portfolios`, `/api/portfolio-items`, and `/api/mobile/portfolio/photos` routes remain mounted for existing clients. New clients should use the domain routes above.

Do not change these contracts without an explicit API task.

## AI service integration

- The existing `/api/ai/cvs/:cvId/feedback`, `/score`, and `/translate-to-english` routes keep their public paths and response wrapper.
- Their optional request body may include `industrySlug`, `verticalSlug`, `companyModel`, `language`, `tier`, `jdExtract`, `llmModel`, `extractionMode`, and `strictIndustryMatch`; legacy `targetRole` and `cvText` remain accepted.
- The Node backend calls the independent FastAPI service configured by `AI_SERVICE_URL`; clients never call FastAPI directly.
- See `docs/ai-service-integration.md` for the internal request mapping and error behavior.

### AI result representation

- Action and detail AI responses include data.aiResult.result as the parsed structured result when resultText contains JSON.
- data.aiResult.resultText remains available for backward compatibility.
- Legacy non-JSON resultText is returned as a string in data.aiResult.result; list responses continue to omit detailed result fields.