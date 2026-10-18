# Backend runtime environment contract

Production startup validates these values before opening the listener. Secrets are injected only at runtime and must never be committed.

| Variable | Production requirement |
| --- | --- |
| `MONGO_URI` or `MONGODB_URI` | Valid `mongodb://` or `mongodb+srv://` URI |
| `JWT_SECRET` / `JWT_EXPIRES_IN` | Unique secret of at least 32 characters and non-empty expiry |
| `BCRYPT_SALT_ROUNDS` | Integer 10–16 |
| `CORS_ORIGIN` or `CLIENT_URL` | At least one exact browser origin |
| `TRUST_PROXY` | Explicit proxy-hop policy |
| `PUBLIC_PORTFOLIO_BASE_URL` | Valid HTTP(S) public Portfolio base URL |
| Cloudinary variables | Cloud name, API key, API secret |
| Upload limits | Each file limit 1–5 MB; Moment count 1–5 |
| `AI_SERVICE_ENABLED` | Defaults to disabled. If `true`, `AI_SERVICE_URL` must be a valid HTTP(S) service-root URL with no `/v1`, query, or fragment; if `false`, AI execution endpoints return `503 AI_FEATURE_DISABLED` and AI does not fail readiness |
| `AI_INTERNAL_API_KEY` | Required when AI is enabled; unique shared service secret of at least 32 characters, stored only in backend and AI platform secret stores |
| `AI_SERVICE_TIMEOUT_MS` | Integer `1000`–`120000`; defaults to `60000` outside production validation |
| `AI_SERVICE_ALLOW_MOCK_OUTPUT` | Local/test-only explicit opt-in; production startup rejects `true` |
| `AI_USAGE_RESERVATION_TTL_MS` | Required when AI is enabled in production; `60000`–`3600000`. The lease must exceed the maximum synchronous AI workflow duration. |
| `AI_USAGE_RECONCILE_INTERVAL_MS` | Required when AI is enabled in production; `60000`–`3600000`. Controls the non-public stale-usage reconciliation loop. |
| `BILLING_ENABLED` | Defaults to `false`. Do not enable until the commercial plan and launch checklist are approved. |
| `PAYOS_CLIENT_ID` / `PAYOS_API_KEY` / `PAYOS_CHECKSUM_KEY` | Required only when billing is enabled; platform-secret-store values only, never committed or browser-exposed. |
| `BILLING_RETURN_URL` / `BILLING_CANCEL_URL` | Required valid HTTP(S) browser return routes when billing is enabled. They are display routes, not payment authority. |
| `PAYOS_WEBHOOK_URL` | Required HTTPS backend webhook URL when billing is enabled. Configure/verify it at the provider only during approved deployment. |

`GET /api/health` is liveness only. `GET /api/health/ready` is the deployment gate and returns `503` if Mongo is disconnected, Cloudinary configuration is incomplete, enabled AI lacks a valid service-root URL/internal key, or an enabled transaction-dependent feature runs on MongoDB standalone topology. The read-only `hello` command accepts a replica set or `mongos`; it never writes a transaction probe. Production startup applies the same transaction capability gate before listening.
