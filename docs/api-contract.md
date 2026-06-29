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

Do not change these contracts without an explicit API task.
