# DEP-009 — Production runtime contract

## Outcome

Defined a production-only runtime configuration contract, split health semantics into
liveness and readiness, and made the production Compose stack provide every required
runtime setting through deployment-managed environment variables.

## Decisions

- `GET /api/health` is liveness-only and does not inspect dependencies.
- `GET /api/health/ready` returns `503` until MongoDB, Cloudinary configuration, and
  the AI service URL (only when AI is enabled) are ready.
- Production startup validates secrets, public URLs, CORS, bcrypt, and upload-limit
  values without ever logging secret values.
- The Compose file accepts runtime secrets only through its environment; `.env.example`
  contains non-secret placeholders only.

## Verification

- `npm test`
- `npm run build`
- `docker compose --env-file .env.example -f docker-compose.prod.yml config`
- Missing `JWT_SECRET` is rejected by Compose with its required-variable message.
