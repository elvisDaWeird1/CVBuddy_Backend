# Closed-beta security baseline

## Goal

Reduce the backend production attack surface without changing the authentication architecture.

## Scope

In: exact production CORS, Helmet/CSP, proxy policy, bounded request bodies, rate limits, JWT startup validation, Swagger exposure policy, documentation, and tests.

Out: JWT payload redesign, AI behavior/provider changes, dependency-wide audit upgrades, Job/Company features, and mobile expansion.

## Decisions

- Production accepts only explicitly configured CORS origins and requires `TRUST_PROXY`.
- Swagger is disabled by default in production.
- Auth, upload-capable, and AI generation paths have narrower IP-based limits and return `429 RATE_LIMITED`.
- The in-memory limiter is suitable for one backend process only; a deployment with multiple replicas needs a shared/proxy rate-limit store.

## Validation

- Command: `npm test && npm run build`
- Result: 66/66 backend tests passed; TypeScript build passed.

## Follow-up

- Verify headers, CORS and Swagger policy through the production reverse proxy after DEP-010.
