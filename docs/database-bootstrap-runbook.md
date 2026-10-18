# Database bootstrap, migration, and recovery gate

No schema index or data migration runs when the backend starts. Run these steps from a controlled deployment window with an owner and timestamp.

## Fresh database

1. Configure `MONGO_URI` (or `MONGODB_URI`) and run `npm run bootstrap:database`.
2. Confirm the dry-run has no incompatible indexes, duplicate canonical owners, or orphan PortfolioItems.
3. Record a backup/snapshot identifier in `MIGRATION_BACKUP_REFERENCE`.
4. Run `npm run bootstrap:database:apply`.
5. Run the dry-run again and save the output with the release record.

## Existing database

1. Take and verify a MongoDB backup/snapshot. Assign a rollback owner and record its identifier.
2. Run `npm run preflight:legacy-portfolio` and `npm run migrate:single-portfolio`; both are non-writing.
3. Resolve every duplicate/orphan/conflict finding manually. Do not discard legacy documents.
4. With `MIGRATION_BACKUP_REFERENCE` set to the verified backup identifier, run `npm run migrate:single-portfolio:apply`, then `npm run bootstrap:database:apply`.
5. Re-run both preflights and verify counts/indexes before enabling production traffic.

## Rollback and restore rehearsal

The scripts do not include destructive rollback. If migration verification fails, stop traffic, restore the verified backup/snapshot using the hosting platform's documented MongoDB restore procedure, then run the non-writing preflights to confirm the restored counts. Record the restore duration and owner during staging rehearsal.

`migration_ledger` records the versioned bootstrap application and backup reference. Re-running a completed bootstrap is idempotent: missing indexes are created, existing matching indexes are left unchanged, and incompatible indexes always stop the run for manual review.

## Monetization index rollout

This is a separate, narrowly scoped rollout for `billing_orders`,
`entitlement_grants`, and `ai_usage`. It derives its managed indexes from the
three deployed Mongoose schemas; it does not manage Portfolio or Account indexes.

Keep AI, billing, and reconciliation disabled. From the approved release commit,
run the default dry-run with the exact expected non-production database name:

```text
npm run rollout:monetization-indexes -- --database test
```

The command checks transaction topology, index definitions, and duplicate groups
for every unique index. It never writes unless `--apply` is present. For a
post-apply read-only verification:

```text
npm run verify:monetization-indexes -- --database test
```

Only in an approved maintenance window, after recording a verified backup/PITR
reference, run:

```powershell
$env:MIGRATION_BACKUP_REFERENCE = "<approved-reference>"
npm run rollout:monetization-indexes:apply -- --database test
```

Apply refuses a missing backup reference, database-name mismatch, standalone
topology, duplicate unique-key data, or incompatible index. It never drops or
replaces an existing index. After creating indexes, it re-inventories the
actual definitions and writes the dedicated migration-ledger entry only when
there are zero missing or incompatible indexes. A partially interrupted apply
can be rerun idempotently: matching indexes are retained and only still-missing
indexes are attempted.
