# DEP-011 — Operational observability

## Outcome

Added sanitized request correlation, structured backend access/error logs, stable
error codes, and a documented alert/incident contract. No request body, query value,
authorization header, password, token, or provider secret is logged by the new code.

## Validation

- Unit/HTTP tests cover supplied/generated request IDs, stable unexpected-error
  responses, no query reflection, and metadata-only access logs.
- TypeScript build and full backend suite must pass.
- Caddy configuration requires Docker daemon validation on staging/local Docker.
