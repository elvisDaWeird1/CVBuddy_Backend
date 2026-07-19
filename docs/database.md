# Database Notes

This document is the human-readable database reference for current CVBuddy models, collections, fields, enums, indexes, and relationships. Mongoose model/schema files in `src/modules/**/*.model.ts` are the implementation source.

If this file and the model/schema code disagree, do not blindly trust either file. Inspect the code and update the correct side according to the current task, or report the mismatch clearly.

## Collections And Fields

- `Account` -> `accounts`: email, passwordHash, role, status, createdAt, updatedAt.
- `TokenRevocation` -> `token_revocations`: tokenHash, expiresAt, createdAt. MongoDB automatically removes expired records through a TTL index on `expiresAt`.
- `ApplicantProfile` -> `applicant_profiles`: accountId, fullName, phone, university, major, location, headline, summary, careerGoal, avatarUrl, avatarPublicId, createdAt, updatedAt.
- `CompanyProfile` -> `company_profiles`: accountId, companyName, industry, websiteUrl, logoUrl, description, address, contactEmail, contactPhone, createdAt, updatedAt.
- `CVDocument` -> `cv_documents`: applicantProfileId, title, fileUrl, filePublicId, fileResourceType, fileType, fileSize, originalName, mimeType, size, language, extractedText, status, uploadedAt, createdAt, updatedAt.
- `AIResult` -> `ai_results`: accountId, cvDocumentId, relatedJobId, aiType, status, inputText, resultText, score, errorMessage, errorCode, industrySlug, targetRole, workflowId, createdAt, completedAt.
- `LegacyPortfolio` -> `portfolios` (compatibility): applicantProfileId, title, introduction, visibility, coverImageUrl, createdAt, updatedAt.
- `PortfolioItem` -> `portfolio_items`: portfolioId, title, description, imageUrl, eventName, eventRole, eventDate, location, visibility, createdFromMobile, createdAt, updatedAt.
- `Portfolio` -> `portfolios`: applicantId, optional applicantProfileId compatibility link, title, description, coverImageUrl, coverImagePublicId, visibility, slug, publishedAt, plus legacy domain headline/about/desiredRole/isPublic/skills/socialLinks/featuredExperienceIds, createdAt, updatedAt.
- `PortfolioExperience` -> `portfolio_experiences`: applicantId, portfolioId, type, title, organization, role, startDate, endDate, isCurrent, location, description, responsibilities, achievements, skills, coverAssetId, status, visibility, createdAt, updatedAt.
- `PortfolioMoment` -> `portfolio_moments`: applicantId, portfolioId, experienceId, caption, capturedAt, location, mediaAssetIds, skills, status, visibility, createdAt, updatedAt.
- `PortfolioAsset` -> `portfolio_assets`: applicantId, portfolioId, assetType, usage, cloudinaryPublicId, cloudinaryResourceType, secureUrl, originalFilename, mimeType, format, bytes, createdAt.
- `PortfolioEvidence` -> `portfolio_evidence`: applicantId, experienceId, type, title, description, url, assetId, verificationStatus, createdAt, updatedAt.

## Important Relationships

- `ApplicantProfile.accountId` references `Account` and is unique.
- `CompanyProfile.accountId` references `Account` and is unique.
- `CVDocument.applicantProfileId` references `ApplicantProfile`.
- `AIResult.accountId` references `Account`; `cvDocumentId` references `CVDocument` when present.
- `Portfolio.applicantProfileId` references `ApplicantProfile` and is unique.
- `PortfolioItem.portfolioId` references `Portfolio`.
- Portfolio ownership uses `applicantId` referencing `Account._id`; one applicant may own many Portfolio records and ownership is always derived from JWT context.
- `PortfolioExperience.portfolioId` and `PortfolioMoment.portfolioId` reference exactly one Portfolio.
- `PortfolioMoment.experienceId` is nullable and owns the Moment → Experience relationship; Experiences do not store `momentIds`.
- Portfolio assets reference Cloudinary resources and are cleaned up when their owning Moment/Evidence/Cover is removed and no other reference remains.

## Enum Sources

Use `src/constants/enums.ts` for role, status, CV language, AI type/status, and visibility values.

Do not change schema fields, collection names, indexes, enum values, or relationships unless explicitly requested.

## New Portfolio indexes

- `portfolios`: unique `applicantId`, unique `slug`. Run `npm run migrate:single-portfolio` to verify that no duplicate owners exist and create the applicant index when needed.
- `portfolio_experiences`: `{ applicantId, status }`, `{ applicantId, type }`, `{ applicantId, createdAt }`.
- `portfolio_moments`: `{ applicantId, createdAt }`, `{ experienceId, capturedAt }`.
- `portfolio_experiences`: `{ portfolioId, createdAt }`.
- `portfolio_moments`: `{ portfolioId, capturedAt }`.
- `portfolio_assets`: `{ portfolioId, createdAt }`.
- `portfolio_assets`: `{ applicantId, createdAt }`.
- `portfolio_evidence`: `{ experienceId, createdAt }`.

The existing MVP `Portfolio`/`PortfolioItem` contract is retained through compatibility routes, but every Applicant owns at most one Portfolio. No migration runs at application startup. The single-Portfolio migration refuses to modify duplicate owners so existing media can be resolved without silent data loss.
