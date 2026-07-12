# Database Notes

This document is the human-readable database reference for current CVBuddy models, collections, fields, enums, indexes, and relationships. Mongoose model/schema files in `src/modules/**/*.model.ts` are the implementation source.

If this file and the model/schema code disagree, do not blindly trust either file. Inspect the code and update the correct side according to the current task, or report the mismatch clearly.

## Collections And Fields

- `Account` -> `accounts`: email, passwordHash, role, status, createdAt, updatedAt.
- `ApplicantProfile` -> `applicant_profiles`: accountId, fullName, phone, university, major, location, headline, summary, careerGoal, avatarUrl, createdAt, updatedAt.
- `CompanyProfile` -> `company_profiles`: accountId, companyName, industry, websiteUrl, logoUrl, description, address, contactEmail, contactPhone, createdAt, updatedAt.
- `CVDocument` -> `cv_documents`: applicantProfileId, title, fileUrl, fileType, fileSize, language, extractedText, status, uploadedAt, createdAt, updatedAt.
- `AIResult` -> `ai_results`: accountId, cvDocumentId, relatedJobId, aiType, status, inputText, resultText, score, errorMessage, createdAt, completedAt.
- `LegacyPortfolio` -> `portfolios` (compatibility): applicantProfileId, title, introduction, visibility, coverImageUrl, createdAt, updatedAt.
- `PortfolioItem` -> `portfolio_items`: portfolioId, title, description, imageUrl, eventName, eventRole, eventDate, location, visibility, createdFromMobile, createdAt, updatedAt.
- `Portfolio` -> `portfolios`: applicantId, headline, about, desiredRole, slug, isPublic, skills, socialLinks, featuredExperienceIds, createdAt, updatedAt.
- `PortfolioExperience` -> `portfolio_experiences`: applicantId, type, title, organization, role, startDate, endDate, isCurrent, location, description, responsibilities, achievements, skills, coverAssetId, status, visibility, createdAt, updatedAt.
- `PortfolioMoment` -> `portfolio_moments`: applicantId, experienceId, caption, capturedAt, location, mediaAssetIds, skills, status, visibility, createdAt, updatedAt.
- `PortfolioAsset` -> `portfolio_assets`: applicantId, assetType, usage, cloudinaryPublicId, cloudinaryResourceType, secureUrl, originalFilename, mimeType, format, bytes, createdAt.
- `PortfolioEvidence` -> `portfolio_evidence`: applicantId, experienceId, type, title, description, url, assetId, verificationStatus, createdAt, updatedAt.

## Important Relationships

- `ApplicantProfile.accountId` references `Account` and is unique.
- `CompanyProfile.accountId` references `Account` and is unique.
- `CVDocument.applicantProfileId` references `ApplicantProfile`.
- `AIResult.accountId` references `Account`; `cvDocumentId` references `CVDocument` when present.
- `Portfolio.applicantProfileId` references `ApplicantProfile` and is unique.
- `PortfolioItem.portfolioId` references `Portfolio`.
- New portfolio domain ownership uses `applicantId` referencing `Account._id`; it is always derived from JWT context.
- `PortfolioMoment.experienceId` is nullable and owns the Moment → Experience relationship; Experiences do not store `momentIds`.
- Portfolio assets reference Cloudinary resources and are cleaned up when their owning Moment/Evidence/Cover is removed and no other reference remains.

## Enum Sources

Use `src/constants/enums.ts` for role, status, CV language, AI type/status, and visibility values.

Do not change schema fields, collection names, indexes, enum values, or relationships unless explicitly requested.

## New Portfolio indexes

- `portfolios`: unique `applicantId`, unique `slug`.
- `portfolio_experiences`: `{ applicantId, status }`, `{ applicantId, type }`, `{ applicantId, createdAt }`.
- `portfolio_moments`: `{ applicantId, createdAt }`, `{ experienceId, capturedAt }`.
- `portfolio_assets`: `{ applicantId, createdAt }`.
- `portfolio_evidence`: `{ experienceId, createdAt }`.

The existing MVP `Portfolio`/`PortfolioItem` contract is retained through a compatibility model for legacy routes. No automatic migration runs during application startup; existing legacy documents are not silently deleted or rewritten.
