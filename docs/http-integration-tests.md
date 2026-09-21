# DEP-013 — HTTP integration baseline

`tests/http-integration.test.js` starts an ephemeral MongoDB with
`mongodb-memory-server`, mounts the real Express app on a random loopback port, and
uses real Mongoose models plus JWT/auth middleware. It never reads production Mongo,
Cloudinary, or AI provider settings.

Coverage includes registration/login/logout/revocation, stable error envelopes,
Admin role isolation and aggregate counts, applicant-only CV validation, canonical
Portfolio publish/unpublish privacy, cross-applicant ownership, and readiness when
Cloudinary configuration is unavailable.

The first run may download the MongoDB test binary into the local package cache. CI
should cache that directory or pre-provision the binary; it must not substitute a
production database URI.
