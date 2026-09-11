# Portfolio children singleton

## Goal

Make every new canonical Portfolio Experience, Moment, Asset, and Evidence belong to the applicant's singleton Portfolio.

## Scope

In: canonical service ownership checks, child schemas, idempotent child backfill preflight/apply script, documentation, and regression tests.

Out: legacy route removal, data deletion, mobile feature work, and AI modules.

## Decisions

- Canonical services derive `portfolioId` from `ensureDefaultPortfolio(applicantId)` and never trust a client-supplied value.
- Child documents with an absent or `null` portfolio link are backfilled only when the applicant has exactly one Portfolio.
- The migration defaults to dry-run; conflicts and orphans are reported and never rewritten automatically.

## Validation

- Command: `npm test && npm run build`
- Result: 58/58 backend tests passed; TypeScript build passed.

## Follow-up

- Run `npm run migrate:single-portfolio` against staging, review its report, then explicitly use `npm run migrate:single-portfolio:apply` only if there are no unresolved conflicts.
