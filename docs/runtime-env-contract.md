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
| `AI_SERVICE_ENABLED` | If `true`, `AI_SERVICE_URL` must be valid HTTP(S); if `false`, AI does not affect readiness |

`GET /api/health` is liveness only. `GET /api/health/ready` is the deployment gate and returns `503` if Mongo is disconnected, Cloudinary configuration is incomplete, or enabled AI lacks a valid URL.
