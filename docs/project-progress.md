# CVBuddy Backend Project Progress

This document summarizes what is implemented in the current backend codebase. It is based on source inspection, not only on README or planning docs.

## Project setup

Status: Done

What is implemented:
- TypeScript + CommonJS backend with Express app setup.
- MongoDB connection through Mongoose.
- dotenv loading in `src/server.ts`.
- CORS allowlist from defaults plus `CORS_ORIGIN` and `CLIENT_URL`.
- JSON and URL-encoded body parsing.
- Static upload serving from `/uploads` remains mounted for legacy local files.
- Health endpoint.
- Swagger UI and OpenAPI JSON endpoints.

Main files:
- `package.json`
- `tsconfig.json`
- `src/server.ts`
- `src/app.ts`
- `src/config/db.ts`
- `src/config/swagger.ts`
- `src/routes/health.routes.ts`
- `.env.example`

API routes:
- `GET /api/health`
- `GET /api/docs`
- `GET /api/docs.json`

Notes / limitations:
- Server startup requires `MONGODB_URI`.
- There is no automated test script, lint script, or seed script in `package.json`.

What still needs to be done:
- Add automated tests and linting only if requested.

## Auth/account

Status: Done

What is implemented:
- Applicant registration creates `Account` and `ApplicantProfile` records.
- Company registration creates `Account` and `CompanyProfile` records.
- Login verifies bcrypt password hash, account status, and returns a JWT.
- Current account endpoint returns serialized account and profile summary.
- Logout endpoint returns success without server-side token invalidation.
- Account model hides `passwordHash` in JSON/object transforms.

Main files:
- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.validation.ts`
- `src/modules/accounts/account.model.ts`
- `src/modules/applicantProfiles/applicantProfile.model.ts`
- `src/modules/companyProfiles/companyProfile.model.ts`
- `src/utils/jwt.ts`

API routes:
- `POST /api/auth/register/applicant`
- `POST /api/auth/register/company`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Notes / limitations:
- Admin account creation is not implemented.
- Logout does not blacklist or revoke JWTs.
- Password reset, email verification, OAuth, and refresh tokens are not implemented.

What still needs to be done:
- Add admin account flow or token revocation only if required by a future task.

## Password change

Status: Done

What is implemented:
- Authenticated users can change password by providing current password and a new password.
- Current password is checked with bcrypt.
- New password is hashed using `BCRYPT_SALT_ROUNDS`.
- Inactive accounts are rejected.

Main files:
- `src/modules/auth/auth.routes.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/auth.validation.ts`

API routes:
- `PATCH /api/auth/change-password`

Notes / limitations:
- No password history, password reset, or forced logout of existing tokens.

What still needs to be done:
- Nothing obvious for the current MVP route contract.

## Applicant profile

Status: Done

What is implemented:
- Applicant-only protected endpoints for getting and updating the current applicant profile.
- Update validation blocks forbidden fields and unknown fields.
- Profile service serializes profile fields and uses account ownership.

Main files:
- `src/modules/applicantProfiles/applicantProfile.routes.ts`
- `src/modules/applicantProfiles/applicantProfile.controller.ts`
- `src/modules/applicantProfiles/applicantProfile.service.ts`
- `src/modules/applicantProfiles/applicantProfile.validation.ts`
- `src/modules/applicantProfiles/applicantProfile.model.ts`

API routes:
- `GET /api/applicant-profile/me`
- `PATCH /api/applicant-profile/me`

Notes / limitations:
- Avatar is stored as `avatarUrl` plus Cloudinary `avatarPublicId`; `POST /api/uploads/avatar` uploads and updates the applicant profile.
- Applicant profile exists only when created during applicant registration.

What still needs to be done:
- Add broader profile fields only if explicitly requested.

## Company profile

Status: Partially done

What is implemented:
- Company profile Mongoose model exists.
- Company registration creates a `CompanyProfile` with `accountId` and `companyName`.
- `GET /api/auth/me` can return a company profile summary for company accounts.

Main files:
- `src/modules/companyProfiles/companyProfile.model.ts`
- `src/modules/auth/auth.service.ts`

API routes:
- `POST /api/auth/register/company`
- `GET /api/auth/me`

Notes / limitations:
- No dedicated company profile routes, controller, service, or validation files are present.
- Planned `GET /api/company-profile/me` and `PATCH /api/company-profile/me` are not implemented.

What still needs to be done:
- Implement company profile API only when requested.

## CV management

Status: Partially done

What is implemented:
- Applicant-only CV upload using `multipart/form-data` field `file`.
- Allowed CV files: PDF and DOCX by extension and MIME type.
- Cloudinary storage under `cvbuddy/cvs` using multer memory storage.
- CV metadata stored in `cv_documents`.
- List current applicant CVs.
- Get current applicant CV detail.
- Soft delete by setting status to `DELETED`.
- Uploaded Cloudinary resources are removed when CV creation fails after upload.

Main files:
- `src/modules/cvs/cv.routes.ts`
- `src/modules/cvs/cv.controller.ts`
- `src/modules/cvs/cv.service.ts`
- `src/modules/cvs/cv.validation.ts`
- `src/modules/cvs/cvDocument.model.ts`
- `src/modules/cvs/cvTextExtractor.service.ts`
- `src/middlewares/upload.middleware.ts`

API routes:
- `POST /api/cvs`
- `GET /api/cvs`
- `GET /api/cvs/:id`
- `DELETE /api/cvs/:id`

Notes / limitations:
- `extractTextFromCv` is a stub and always returns an empty string.
- There is no real PDF/DOCX text extraction yet.
- There is no endpoint to update CV metadata or permanently delete files.

What still needs to be done:
- Implement real CV text extraction before relying on uploaded files for AI input.

## AI CV feedback, score, and translation

Status: Partially done

What is implemented:
- Applicant-only endpoints for CV feedback, CV scoring, and translation to English.
- AI result history and detail endpoints.
- Ownership checks ensure the CV belongs to the requesting applicant.
- `AIResult` records input text, status, result text, score, and completion time.
- Mock AI output exists for feedback, scoring, and translation.
- If uploaded CV text is empty, callers can provide `cvText` in the request body.

Main files:
- `src/modules/ai/ai.routes.ts`
- `src/modules/ai/ai.controller.ts`
- `src/modules/ai/ai.service.ts`
- `src/modules/ai/aiPrompt.service.ts`
- `src/modules/ai/ai.validation.ts`
- `src/modules/ai/aiResult.model.ts`

API routes:
- `POST /api/ai/cvs/:cvId/feedback`
- `POST /api/ai/cvs/:cvId/score`
- `POST /api/ai/cvs/:cvId/translate-to-english`
- `GET /api/ai/results`
- `GET /api/ai/results/:id`

Notes / limitations:
- Real Gemini or other provider integration is not implemented. `AI_PROVIDER`, `AI_API_KEY`, and `AI_MODEL` exist in `.env.example`, but code always returns mock output.
- `JOB_RECOMMENDATION` exists as an enum/model value, but no job recommendation endpoint is implemented.
- AI completion/failure notifications are planned in docs but not implemented in code.

What still needs to be done:
- Add real provider integration only when requested.
- Add AI job recommendation only if the related job/application scope is implemented.

## Portfolio and portfolio items

Status: Done

What is implemented:
- Applicant-only portfolio create, get, and update endpoints.
- Public portfolio view by portfolio id when portfolio visibility is `PUBLIC`.
- Applicant-only portfolio item create, list, detail, update, and delete endpoints.
- Portfolio item visibility controls public portfolio item inclusion.
- A portfolio is auto-created when creating a portfolio item through helper logic if needed.

Main files:
- `src/modules/portfolios/portfolio.routes.ts`
- `src/modules/portfolios/portfolio.controller.ts`
- `src/modules/portfolios/portfolio.service.ts`
- `src/modules/portfolios/portfolio.validation.ts`
- `src/modules/portfolios/portfolio.model.ts`
- `src/modules/portfolios/portfolioItem.model.ts`

API routes:
- `POST /api/portfolios`
- `GET /api/portfolios/me`
- `PATCH /api/portfolios/me`
- `GET /api/portfolios/public/:portfolioId`
- `POST /api/portfolio-items`
- `GET /api/portfolio-items/me`
- `GET /api/portfolio-items/:id`
- `PATCH /api/portfolio-items/:id`
- `DELETE /api/portfolio-items/:id`

Notes / limitations:
- Planned dedicated visibility route `PATCH /api/portfolios/me/visibility` is not implemented; visibility can be updated through `PATCH /api/portfolios/me`.
- Portfolio item delete is a hard delete.

What still needs to be done:
- Nothing obvious for current implemented contract unless a separate visibility endpoint is required.

## Portfolio photo / mobile upload

Status: Done

What is implemented:
- Applicant-only mobile photo upload endpoint.
- Accepts image file field `image` for JPG, JPEG, PNG, or WEBP.
- Stores files in Cloudinary under `cvbuddy/portfolio`.
- Creates a portfolio item with `createdFromMobile: true` and the stored image URL.
- Auto-creates a private portfolio when needed.
- Removes the uploaded Cloudinary resource if portfolio item creation fails.

Main files:
- `src/modules/mobile/mobile.routes.ts`
- `src/modules/mobile/mobile.controller.ts`
- `src/modules/mobile/mobile.service.ts`
- `src/modules/mobile/mobile.validation.ts`
- `src/middlewares/upload.middleware.ts`
- `src/modules/portfolios/portfolio.service.ts`

API routes:
- `POST /api/mobile/portfolio/photos`

Notes / limitations:
- Cloudinary object storage is integrated for uploaded portfolio photos.
- No image resizing, moderation, or metadata extraction.

What still needs to be done:
- Add cloud storage or image processing only if required.

## Swagger/OpenAPI

Status: Done

What is implemented:
- Swagger config is generated through `swagger-jsdoc` from inline `swaggerPaths` and `swaggerComponents` objects.
- Swagger UI is mounted at `/api/docs`.
- OpenAPI JSON is served at `/api/docs.json`.
- Swagger docs cover currently implemented health, auth, applicant profile, CV, AI, portfolio, portfolio item, and mobile photo endpoints.
- Bearer auth security scheme is defined and used for protected endpoints.

Main files:
- `src/config/swagger.ts`
- `src/docs/swagger.paths.ts`
- `src/app.ts`

API routes:
- `GET /api/docs`
- `GET /api/docs.json`

Notes / limitations:
- Swagger is maintained manually in `src/docs/swagger.paths.ts`; it is not generated from route decorators.
- Swagger does not document unimplemented planned modules such as jobs, applications, notifications, or feedbacks.

What still needs to be done:
- Keep Swagger aligned whenever API behavior changes.

## Database/models

Status: Partially done

What is implemented:
- Mongoose models and indexes for:
  - `Account` -> `accounts`
  - `ApplicantProfile` -> `applicant_profiles`
  - `CompanyProfile` -> `company_profiles`
  - `CVDocument` -> `cv_documents`
  - `AIResult` -> `ai_results`
  - `Portfolio` -> `portfolios`
  - `PortfolioItem` -> `portfolio_items`
- Shared enum constants for roles, statuses, CV languages, AI types/statuses, and visibility.
- JSON/object transforms remove `_id` and `__v`; account transform removes `passwordHash`.

Main files:
- `src/modules/accounts/account.model.ts`
- `src/modules/applicantProfiles/applicantProfile.model.ts`
- `src/modules/companyProfiles/companyProfile.model.ts`
- `src/modules/cvs/cvDocument.model.ts`
- `src/modules/ai/aiResult.model.ts`
- `src/modules/portfolios/portfolio.model.ts`
- `src/modules/portfolios/portfolioItem.model.ts`
- `src/constants/enums.ts`
- `docs/database.md`

API routes:
- Not directly applicable.

Notes / limitations:
- Planned MVP models for jobs, applications, notifications, and feedbacks are not present in `src/modules`.
- `AIResult.relatedJobId` references `Job`, but no `Job` model exists yet.

What still needs to be done:
- Implement remaining planned models only when their feature work is requested.

## Middleware/security

Status: Done

What is implemented:
- JWT bearer token parsing and verification.
- Active account lookup and status check for protected routes.
- Role-based access middleware.
- CORS restrictions with allowed origins.
- File upload validation for CVs and portfolio images.
- Static serving for legacy local uploaded files.
- Express request typing for `req.user` and `req.account`.

Main files:
- `src/middlewares/auth.middleware.ts`
- `src/middlewares/role.middleware.ts`
- `src/middlewares/upload.middleware.ts`
- `src/types/express.d.ts`
- `src/app.ts`
- `src/utils/jwt.ts`

API routes:
- Applied to protected auth, applicant profile, CV, AI, portfolio, portfolio item, and mobile routes.

Notes / limitations:
- No rate limiting, helmet/security headers, CSRF protection, request logging, or token revocation.
- Legacy local uploaded files are publicly served under `/uploads`; new uploads use Cloudinary secure URLs.

What still needs to be done:
- Add additional production hardening only if required.

## Validation/error handling

Status: Done

What is implemented:
- Route-level validation functions for implemented modules.
- Shared `validate` middleware converts validation arrays into `ApiError(400, "Validation failed")`.
- Validation removes uploaded file when validation fails after multer stores a file.
- Central error handler normalizes duplicate key, Mongoose validation, cast errors, multer errors, and custom `ApiError` instances.
- Shared success/error response helpers keep response wrappers consistent.

Main files:
- `src/middlewares/validate.middleware.ts`
- `src/middlewares/error.middleware.ts`
- `src/utils/apiError.ts`
- `src/utils/apiResponse.ts`
- `src/utils/asyncHandler.ts`
- `src/modules/*/*.validation.ts`

API routes:
- Applied across implemented routes.

Notes / limitations:
- Validation is handwritten rather than using a schema library such as Zod or Joi.
- Some TypeScript types are intentionally loose because `strict` is disabled.

What still needs to be done:
- Add schema validation library only if requested.

## Tests/scripts

Status: Partially done

What is implemented:
- `npm run dev` runs `ts-node-dev --respawn --transpile-only src/server.ts`.
- `npm run build` runs `tsc`.
- `npm start` runs `node dist/server.js`.

Main files:
- `package.json`
- `tsconfig.json`

API routes:
- Not applicable.

Notes / limitations:
- No automated test script is present.
- No lint, format, seed, migration, or typecheck-only script beyond `npm run build`.

What still needs to be done:
- Add tests for auth, profiles, CVs, AI, portfolio, uploads, and error paths when requested.

## Planned / not implemented modules

Status: Planned / not implemented

What is implemented:
- No source modules were found for jobs, applications, notifications, feedbacks, admin APIs, or company profile APIs beyond the company profile model and registration creation.

Main files:
- `BACKEND_MVP_PLAN.md` describes these planned areas.

API routes:
- Planned but not mounted in `src/app.ts`:
  - `/api/company-profile/*`
  - `/api/jobs/*`
  - `/api/applications/*`
  - `/api/company/applications/*`
  - `/api/notifications/*`
  - `/api/feedbacks/*`

Notes / limitations:
- These should not be marked complete until source files, routes, services, models, and docs are implemented.

What still needs to be done:
- Implement each area as a separate scoped task if still part of MVP priority.

## Next recommended backend tasks

- Add a small automated test setup and cover auth/register/login/change-password first.
- Implement real PDF/DOCX text extraction or document that AI endpoints require `cvText` until extraction exists.
- Decide whether real AI provider integration is required now; current AI behavior is mock-only.
- Implement company profile get/update APIs if company accounts need profile management beyond registration.
- Implement planned job, application, notification, and feedback modules in separate phases if they remain MVP scope.
- Keep `docs/api-contract.md`, `docs/database.md`, and `src/docs/swagger.paths.ts` aligned as routes and models change.

## Questions / unclear points

- `PROJECT_CONTEXT.md`, `docs/backend-mvp-plan.md`, `MVP_Database.txt`, `CVBuddy_RDS.docx`, and `Full_Database.txt` were not present in the repo during this inspection.
- It is unclear whether Gemini integration is required immediately; code currently has only mock AI output despite AI environment variables.
- It is unclear whether the planned company profile, jobs, applications, notifications, and feedback modules are still in current MVP priority.
- It is unclear whether logout should stay stateless or eventually revoke tokens.
