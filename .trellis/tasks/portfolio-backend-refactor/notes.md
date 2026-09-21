# Notes

- Existing repository had the legacy `Portfolio`/`PortfolioItem` module and no active Cloudinary/Zod implementation despite stale local handoff notes.
- New `Portfolio` uses the existing `portfolios` collection with `applicantId` from the Account JWT. Legacy routes use `portfolioLegacy.model.ts` so old routes remain mounted.
- New uploads use memory storage, MIME/extension checks, supported signature checks, Cloudinary resource types, and cleanup on failure.
- No startup migration is run; the handoff documents the compatibility boundary and required deliberate migration for old records.
- Post-implementation audit found and fixed client-controlled `verified` evidence status, unbounded Moment queries, multipart empty-value handling, public asset usage leakage, cleanup logging, and Swagger response/request mismatches.
