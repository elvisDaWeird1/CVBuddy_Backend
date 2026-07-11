# Task

## Goal

Revoke the bearer token used for logout so it cannot access protected endpoints afterward.

## Scope

In: token hash blacklist, TTL cleanup, auth middleware checks, auth/API/database documentation.

Out: changing JWT payload or revoking other active sessions.

## Files touched

- `src/modules/auth/tokenRevocation.model.ts`
- `src/modules/auth/tokenRevocation.service.ts`
- `src/middlewares/auth.middleware.ts`
- `src/modules/auth/auth.controller.ts`
- `src/modules/auth/auth.service.ts`
- `src/types/express.d.ts`
- Auth and database documentation.

## Notes

- Store only SHA-256 token hashes; MongoDB TTL removes records at token expiration.

## Validation

- Command: `npm run build`
- Result: Passed.
- Smoke test: login → `/me` → logout → `/me` with the old token returned `401`.

## Follow-up

- None.
