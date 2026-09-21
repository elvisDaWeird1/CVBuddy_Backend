# Database bootstrap gate

## Goal

Make index/bootstrap changes explicit, versioned, idempotent, and gated by a verified backup reference.

## Scope

In: startup index policy, managed index preflight/apply, migration ledger, Portfolio sparse canonical index, migration backup gate, runbook, and tests.

Out: deleting or converting legacy data, automatic startup migrations, a database restore command, AI implementation changes, and deployment-platform backups.

## Decisions

- `autoIndex` is off for every application connection; scripts own index creation.
- Bootstrap defaults to dry-run and refuses apply for duplicates, orphans, or incompatible indexes.
- `MIGRATION_BACKUP_REFERENCE` is mandatory before any bootstrap or Portfolio backfill apply.
- The unique canonical owner index is sparse to coexist with legacy documents that lack `applicantId`.

## Validation

- Command: `npm test && npm run build`
- Result: 68/68 backend tests passed; TypeScript build passed.

## Follow-up

- Execute and archive the staging preflight, backup/restore rehearsal, then apply only during an approved migration window.
