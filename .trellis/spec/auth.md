# Auth Spec

Authentication uses JWT bearer tokens. `docs/api-contract.md` is the source of truth for exact auth endpoint paths and response contracts.

## Current Behavior

- Registration creates an account plus the matching applicant or company profile.
- Login returns a JWT and serialized account.
- Protected routes use `Authorization: Bearer <token>`.
- `authMiddleware` verifies the token, loads the account, checks active status, and sets `req.user` and `req.account`.
- `roleMiddleware` gates role-specific endpoints.

## Rules

Do not change JWT payload, token expiry behavior, password hashing behavior, account status checks, or role names unless explicitly requested.
