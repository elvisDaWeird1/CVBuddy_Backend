# Legacy Portfolio write isolation

## Goal

Prevent legacy Portfolio writes from changing the shared collection in production while preserving compatibility reads and source code.

## Scope

In: production route guard, compatibility documentation/Swagger, read-only data preflight, and regression tests.

Out: deleting legacy routes or data, converting documents, changing canonical Portfolio APIs, AI work, and mobile feature expansion.

## Decisions

- Canonical `/api/portfolio/**` and canonical collection writes remain available.
- Legacy `/me`, PortfolioItem, and mobile photo writes return `410` by default in production.
- `ENABLE_LEGACY_PORTFOLIO_WRITES=true` is an explicit, time-bound rollback switch.
- Preflight only reports shapes, duplicate owners, and orphan PortfolioItems; it never writes data.

## Validation

- Command: `npm test && npm run build`
- Result: 62/62 backend tests passed; TypeScript build passed.

## Follow-up

- Run `npm run preflight:legacy-portfolio` against staging after a database snapshot; no conversion command is included in this task.
