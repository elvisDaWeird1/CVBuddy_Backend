# Staging CV read rate-limit correction

## Finding

DEP-015 local acceptance showed that `/api/cvs/:id/preview` and download were
receiving the upload rate limit after legitimate upload attempts.

## Change

The upload limiter now applies only to `POST /api/cvs`. Read, preview, download,
and delete routes continue to have the general request limit but are not charged
against the upload quota.

## Validation

- Backend tests and TypeScript build.
- Rebuild the local production-like stack and repeat CV lifecycle smoke through
  the Caddy `/api` route.
