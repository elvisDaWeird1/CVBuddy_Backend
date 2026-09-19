# DEP-013 — Backend HTTP integration baseline

## Outcome

Added an isolated HTTP suite using ephemeral MongoDB and the real Express app. The
suite exercises the MVP's auth, role, validation, ownership, public privacy, metrics,
and readiness boundaries without Cloudinary or AI network calls.

## Validation

- `npm test`
- `npm run build`
- The test fixture must create and stop its own MongoDB process.
