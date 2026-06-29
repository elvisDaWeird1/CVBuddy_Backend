# API Spec

`docs/api-contract.md` is the source of truth for endpoint-level API behavior, request/response contracts, status codes, and response shapes.

## Path Style

Use full API paths with the `/api` prefix, such as `/api/auth/login` and `/api/applicant-profile/me`.

Do not mix full paths and paths relative to `/api` in the same file. If a task needs endpoint-level details, update `docs/api-contract.md`.

## Rules

Keep success and error response wrappers consistent with the existing API helpers. Do not change route paths, response messages, response wrappers, or status codes unless the user explicitly asks for an API contract change.
