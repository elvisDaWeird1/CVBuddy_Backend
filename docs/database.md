# Database Notes

This document is the human-readable database reference for current CVBuddy models, collections, fields, enums, indexes, and relationships. Mongoose model/schema files in `src/modules/**/*.model.ts` are the implementation source.

If this file and the model/schema code disagree, do not blindly trust either file. Inspect the code and update the correct side according to the current task, or report the mismatch clearly.

## Collections And Fields

- `Account` -> `accounts`: email, passwordHash, role, status, createdAt, updatedAt.
- `ApplicantProfile` -> `applicant_profiles`: accountId, fullName, phone, university, major, location, headline, summary, careerGoal, avatarUrl, createdAt, updatedAt.
- `CompanyProfile` -> `company_profiles`: accountId, companyName, industry, websiteUrl, logoUrl, description, address, contactEmail, contactPhone, createdAt, updatedAt.
- `CVDocument` -> `cv_documents`: applicantProfileId, title, fileUrl, fileType, fileSize, language, extractedText, status, uploadedAt, createdAt, updatedAt.
- `AIResult` -> `ai_results`: accountId, cvDocumentId, relatedJobId, aiType, status, inputText, resultText, score, errorMessage, createdAt, completedAt.
- `Portfolio` -> `portfolios`: applicantProfileId, title, introduction, visibility, coverImageUrl, createdAt, updatedAt.
- `PortfolioItem` -> `portfolio_items`: portfolioId, title, description, imageUrl, eventName, eventRole, eventDate, location, visibility, createdFromMobile, createdAt, updatedAt.

## Important Relationships

- `ApplicantProfile.accountId` references `Account` and is unique.
- `CompanyProfile.accountId` references `Account` and is unique.
- `CVDocument.applicantProfileId` references `ApplicantProfile`.
- `AIResult.accountId` references `Account`; `cvDocumentId` references `CVDocument` when present.
- `Portfolio.applicantProfileId` references `ApplicantProfile` and is unique.
- `PortfolioItem.portfolioId` references `Portfolio`.

## Enum Sources

Use `src/constants/enums.ts` for role, status, CV language, AI type/status, and visibility values.

Do not change schema fields, collection names, indexes, enum values, or relationships unless explicitly requested.
