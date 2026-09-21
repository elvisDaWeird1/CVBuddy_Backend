# Legacy Portfolio compatibility and preflight

## Route inventory

| Route family | Storage path | Production behavior |
| --- | --- | --- |
| `/api/portfolio/**` | Canonical `Portfolio`, Experience, Moment, Asset, Evidence | Read/write canonical API |
| `/api/portfolios` and `/:portfolioId/**` | Canonical collection compatibility API | Read/write canonical API |
| `/api/portfolios/me` | `LegacyPortfolio` | Read available; `PATCH` disabled by default |
| `/api/portfolio-items/**` | `PortfolioItem` attached to `LegacyPortfolio` | Reads available; writes disabled by default |
| `/api/mobile/portfolio/photos` | Upload + `PortfolioItem` | Disabled by default |

`Portfolio` and `LegacyPortfolio` intentionally still share the `portfolios` collection while compatibility reads are retained. This task does not delete, rewrite, or migrate legacy documents.

## Production guard and rollback

When `NODE_ENV=production`, legacy writes return `410 LEGACY_PORTFOLIO_WRITES_DISABLED`. Set `ENABLE_LEGACY_PORTFOLIO_WRITES=true` only for a reviewed, time-bound compatibility rollback, then restart the backend and remove the flag after validation. Canonical `/api/portfolio/**` and canonical collection routes are unaffected.

## Staging preflight

1. Take a database backup/snapshot using the deployment platform before any future data conversion.
2. Run `npm run preflight:legacy-portfolio` and save the JSON report with the backup identifier.
3. Resolve reported legacy-only, duplicate-owner, and orphan PortfolioItem counts before planning a conversion. `canonicalWithProfileLink` is reported separately because the canonical model may retain that compatibility link.
4. Verify canonical public/private ownership flows. This repository currently has no conversion command, so rollback is restoring the backup and/or re-enabling the guarded compatibility writes.
