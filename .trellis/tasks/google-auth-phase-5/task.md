# Task: Google Authentication (Phase 5 — AUTH-G-001 through AUTH-G-003)

## Goal

Complete and harden backend Google Authentication (AUTH-G-001 to AUTH-G-003), including conditional account schema validation, safe non-writing dry-run/apply migration with backup and ledger gates, single password-plus-challenge linking contract, profile-completion signal, runtime config validation, and API/Swagger/database documentation.

## Scope

In:
- `Account` conditional `passwordHash` and `googleSubject` validation based on `authMethods`
- Non-writing dry-run/apply/verify migration for existing accounts (`PASSWORD`/`GOOGLE` backfill, conflict detection, duplicate `googleSubject` check, index verification, `migration_ledger`)
- Hardening `/api/auth/google` and `/api/auth/google/link` (mandatory signed `linkToken`, current password verification, atomic updates, duplicate-key race handling, profile-completion signal, unified response envelope + `requestId`)
- Runtime config validation for `GOOGLE_CLIENT_ID` when configured
- Docs (`backend/.env.example`, `backend/docs/api-contract.md`, `backend/docs/database.md`, `backend/docs/database-bootstrap-runbook.md`, `backend/src/docs/swagger.paths.ts`)
- Automated tests (`tests/google-auth.test.js`, `tests/google-auth-migration.test.js`, `tests/runtime-contract.test.js`)

Out:
- Unrelated working-tree files
- Optional-auth session linking path
- Real production secrets

## Files touched

- `src/modules/accounts/account.model.ts`
- `src/modules/auth/auth.service.ts`
- `src/modules/auth/googleAuth.service.ts`
- `src/modules/auth/googleAuthMigration.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.validation.ts`
- `src/middlewares/auth.middleware.ts`
- `src/utils/jwt.ts`
- `src/config/runtime.ts`
- `src/docs/swagger.paths.ts`
- `scripts/migrate-account-auth-methods.ts`
- `scripts/start-e2e-mongo.js`
- `package.json`
- `tsconfig.migrations.json`
- `.env.example`
- `docs/api-contract.md`
- `docs/database.md`
- `docs/database-bootstrap-runbook.md`
- `tests/google-auth.test.js`
- `tests/google-auth-migration.test.js`
- `tests/runtime-contract.test.js`

## Notes

- Reuses existing `migration_ledger` and preflight/apply pattern from `rollout-monetization-indexes.ts` and `bootstrap-database.ts`.
- Linking contract is strictly public password + signed short-lived `linkToken`, cryptographically domain-separated from session JWTs (`:google-link-challenge:v1` HMAC secret + `purpose` claim rejection in `verifyAuthToken` and `authMiddleware`).

## Validation

- Command: `npm run test:google-auth`, `npm test`, `npm run build`, `npm run typecheck:monetization-indexes`
- Result: `npm run test:google-auth` passed 18/18 (12 in `tests/google-auth.test.js` + 6 in `tests/google-auth-migration.test.js`); `npm test` passed 189/189; `npm run build` and `npm run typecheck:monetization-indexes` exited 0.

## Follow-up

- Staging Google OAuth verification requires real `GOOGLE_CLIENT_ID` and authorized origins in Google Cloud Console.
