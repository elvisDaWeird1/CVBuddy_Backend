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
- `EntitlementGrant` -> `entitlement_grants`: accountId, sourceOrderId, planCode, startsAt, endsAt, creditsGranted, creditsConsumed, status, createdAt, updatedAt. A FREE grant is created lazily for an account's UTC calendar month using a deterministic source key; paid `PRO_30D` grants come from unique billing orders.
- `AiUsage` -> `ai_usage`: accountId, entitlementGrantId, aiResultId, featureKey, credits, state (`RESERVED`, `CONSUMED`, `REFUNDED`), idempotencyKey, provider/model/token/cost metadata, createdAt, updatedAt.
- `BillingOrder` -> `billing_orders`: accountId, provider, orderCode, paymentLinkId, planCode, server-owned amountVnd, status, idempotencyKey, checkoutUrl, providerReference, expiresAt, paidAt, createdAt, updatedAt. Only a verified provider webhook can move an order to `PAID` and issue a paid entitlement.
- `LegacyPortfolio` -> `portfolios` (compatibility): applicantProfileId, title, introduction, visibility, coverImageUrl, createdAt, updatedAt.
- `PortfolioItem` -> `portfolio_items`: portfolioId, title, description, imageUrl, eventName, eventRole, eventDate, location, visibility, createdFromMobile, createdAt, updatedAt.
- `Portfolio` -> `portfolios`: applicantId, optional applicantProfileId compatibility link, title, description, coverImageUrl, coverImagePublicId, visibility, slug, publishedAt, plus legacy domain headline/about/desiredRole/isPublic/skills/socialLinks/featuredExperienceIds, createdAt, updatedAt.
- `PortfolioExperience` -> `portfolio_experiences`: applicantId, portfolioId, type, title, organization, role, startDate, endDate, isCurrent, location, description, responsibilities, achievements, skills, coverAssetId, status, visibility, createdAt, updatedAt.
- `PortfolioMoment` -> `portfolio_moments`: applicantId, portfolioId, experienceId, caption, capturedAt, location, mediaAssetIds, skills, status, visibility, createdAt, updatedAt.
- `PortfolioAsset` -> `portfolio_assets`: applicantId, portfolioId, assetType, usage, cloudinaryPublicId, cloudinaryResourceType, secureUrl, originalFilename, mimeType, format, bytes, createdAt.
- `PortfolioEvidence` -> `portfolio_evidence`: applicantId, portfolioId, experienceId, type, title, description, url, assetId, verificationStatus, createdAt, updatedAt.

## Important Relationships

- `ApplicantProfile.accountId` references `Account` and is unique.
- `CompanyProfile.accountId` references `Account` and is unique.
- `CVDocument.applicantProfileId` references `ApplicantProfile`.
- `AIResult.accountId` references `Account`; `cvDocumentId` references `CVDocument` when present.
- `EntitlementGrant.accountId` references `Account`; `sourceOrderId` is globally unique so one paid order cannot grant access twice. Early renewal starts after the latest non-revoked paid grant instead of overlapping it.
- `AiUsage.accountId` references `Account`, `entitlementGrantId` references the balance charged, and optional `aiResultId` links the final or failed AI result. Reservation and balance update run in one MongoDB transaction.
- `BillingOrder.accountId` references `Account`; `orderCode`, `paymentLinkId` (when present), and `{ accountId, idempotencyKey }` are unique. Payment webhook processing and paid-grant issuance run in one MongoDB transaction, requiring a replica set in production.
- `Portfolio.applicantProfileId` references `ApplicantProfile` and is unique.
- `PortfolioItem.portfolioId` references `Portfolio`.
- Canonical Portfolio ownership uses `applicantId` referencing `Account._id`; one applicant owns exactly one Portfolio and ownership is always derived from JWT context.
- `PortfolioExperience.portfolioId`, `PortfolioMoment.portfolioId`, `PortfolioAsset.portfolioId` and `PortfolioEvidence.portfolioId` reference exactly one canonical Portfolio.
- `PortfolioMoment.experienceId` is nullable and owns the Moment → Experience relationship; Experiences do not store `momentIds`.
- Portfolio assets reference Cloudinary resources and are cleaned up when their owning Moment/Evidence/Cover is removed and no other reference remains.

## Enum Sources

Use `src/constants/enums.ts` for role, status, CV language, AI type/status, and visibility values.

Do not change schema fields, collection names, indexes, enum values, or relationships unless explicitly requested.

## Bootstrap and migration gate

The application connects with `autoIndex: false`; index creation is an explicit deployment action, never a startup side effect. Use [the database bootstrap runbook](database-bootstrap-runbook.md) for fresh database, existing-data preflight, backup, apply, and restore steps.

The canonical `Portfolio.applicantId` unique index is sparse so compatibility `LegacyPortfolio` records without that field can remain in the shared collection. It still prevents more than one canonical Portfolio for an applicant.

## New Portfolio indexes

- `portfolios`: unique `applicantId`, unique `slug`. Run `npm run migrate:single-portfolio` for a non-writing preflight of duplicate owners, orphan children and conflicting links. After reviewing the report, run `npm run migrate:single-portfolio:apply` to backfill only missing child links and create the applicant index when needed; reruns are idempotent.
- `portfolio_experiences`: `{ applicantId, status }`, `{ applicantId, type }`, `{ applicantId, createdAt }`.
- `portfolio_moments`: `{ applicantId, createdAt }`, `{ experienceId, capturedAt }`.
- `portfolio_experiences`: `{ portfolioId, createdAt }`.
- `portfolio_moments`: `{ portfolioId, capturedAt }`.
- `portfolio_assets`: `{ portfolioId, createdAt }`.
- `portfolio_evidence`: `{ portfolioId, createdAt }`.
- `portfolio_assets`: `{ applicantId, createdAt }`.
- `portfolio_evidence`: `{ experienceId, createdAt }`.

The existing MVP `Portfolio`/`PortfolioItem` contract is retained through compatibility routes, but every Applicant owns at most one Portfolio. No migration runs at application startup. The single-Portfolio migration refuses to modify duplicate owners so existing media can be resolved without silent data loss.

## Monetization indexes (source only; not yet applied)

- `entitlement_grants`: unique `{ sourceOrderId: 1 }`.
- `entitlement_grants`: `{ accountId: 1, endsAt: -1, status: 1 }` for effective-entitlement lookup.
- `entitlement_grants`: `{ accountId: 1, planCode: 1, startsAt: 1, endsAt: 1 }` for account history and overlap review.
- `ai_usage`: unique `{ accountId: 1, idempotencyKey: 1 }`.
- `ai_usage`: `{ accountId: 1, createdAt: -1, state: 1 }`, `{ entitlementGrantId: 1, state: 1 }`, and sparse `{ aiResultId: 1 }`.
- `billing_orders`: unique `{ orderCode: 1 }`, sparse unique `{ paymentLinkId: 1 }`, unique `{ accountId: 1, idempotencyKey: 1 }`, `{ accountId: 1, status: 1, createdAt: -1 }`, and `{ status: 1, expiresAt: 1 }`.

These indexes are schema definitions only until the deployment owner runs an approved database preflight and apply step. No index or data migration is performed automatically by this change.
