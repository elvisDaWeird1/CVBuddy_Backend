# Task

## Goal

Implement secure avatar/CV uploads, AI translate-and-score/review, and multiple applicant portfolios.

## Scope

In: backend models, validation, services, routes, Swagger/API/database docs, compatibility logic, migration, and focused tests.

Out: frontend changes, a background AI queue, DOC/DOCX preview conversion, and changes to the independent FastAPI repository.

## Notes

- Preserve legacy upload, AI action, /api/portfolio, portfolio-item, and mobile routes where possible.
- Multiple Portfolio requires dropping the historical unique applicantId index before rollout.

## Validation

- npm test: pass, 33 tests.
- npm run build: pass.
- OpenAPI generation: pass, 11 new/changed paths checked.
- git diff --check: pass with Windows LF/CRLF warnings only.
