# Task

## Goal

Provision Admin accounts safely and expose aggregate, read-only user metrics to authenticated Admins.

## Scope

In: idempotent create/explicit promotion CLI, ADMIN-protected metrics aggregation, Swagger/docs, authorization and count tests.

Out: public admin registration, user lists/PII, moderation, suspend/delete, frontend dashboard, AI, Job, and Company feature expansion.

## Files touched

- `src/modules/admin/*`
- `scripts/provision-admin.ts`
- `src/app.ts`, Swagger, API/operations docs, and backend tests.

## Notes

- `totalUsers` is Applicant + Company and excludes Admin accounts.
- Password input is hidden or supplied through stdin; `--password` is rejected.
- Existing `Account.role` index supports the aggregation match without loading documents into application memory.

## Validation

- `npm run build`: passed.
- `npm test`: passed, 44/44 tests including 5 ADM-001 tests.
- `npm run provision:admin -- --help`: passed without database access or secret input.
- `git diff --check`: passed.

## Follow-up

- ADM-002 consumes this endpoint in the frontend Admin dashboard.
