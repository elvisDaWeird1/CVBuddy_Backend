# Closed-beta security baseline

## Production configuration

- Set exact HTTPS origins in `CORS_ORIGIN` and/or `CLIENT_URL`. Production does not add localhost origins.
- Set `TRUST_PROXY=1` when the backend is behind one trusted reverse proxy. Do not enable it for an Internet-facing direct backend.
- Set a unique `JWT_SECRET` of at least 32 characters and a non-empty `JWT_EXPIRES_IN`; startup rejects missing or default-like production values.
- Keep `SWAGGER_ENABLED=false` in production unless the docs endpoint is protected by deployment access controls.

## Request controls

- Helmet sets security headers and a same-origin CSP for backend-served content.
- JSON and URL-encoded request bodies are limited to 1 MB; file limits stay controlled by their existing multer policies.
- General traffic is limited to 600 requests per 15 minutes per IP. Auth routes allow 10 attempts per 15 minutes, upload-capable routes 30 per hour, and AI generation paths 20 per hour.
- Limits use the process-local store. Before horizontally scaling, replace it with a shared store at the reverse-proxy/application deployment layer.

## Deployment verification

1. Request a production health endpoint through the reverse proxy and verify Helmet headers, no `X-Powered-By`, and the intended CSP.
2. Verify an allowed browser origin succeeds and a localhost/unknown origin is rejected.
3. Confirm `/api/docs` and `/api/docs.json` return 404 when Swagger is disabled.
4. Exercise auth and upload limits until the API returns `429 RATE_LIMITED`; do not use real user accounts or production files.
