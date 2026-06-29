# Database Spec

`docs/database.md` is the human-readable database reference. Mongoose model/schema files are the implementation source for current database behavior.

## Summary

Database access uses Mongoose models under `src/modules`. Current implemented model areas include accounts, applicant profiles, company profiles, CV documents, AI results, portfolios, and portfolio items.

## Rules

Do not change collection names, field names, indexes, enum values, transform behavior, or relationships unless explicitly requested. If `docs/database.md` and model/schema code disagree, inspect the code and update the correct side according to the current task.
