const assert = require("node:assert/strict");
const mongoose = require("mongoose");
const test = require("node:test");
const { MongoMemoryServer } = require("mongodb-memory-server");

const Account = require("../src/modules/accounts/account.model").default;
const { ACCOUNT_ROLES, ACCOUNT_STATUSES, AUTH_METHODS } = require("../src/constants/enums");
const {
  MIGRATION_ID,
  classifyAccountDocument,
  classifyGoogleSubjectIndex,
  findDuplicateGoogleSubjects,
  runGoogleAuthMigration
} = require("../src/modules/auth/googleAuthMigration");
const { parseCliOptions } = require("../scripts/migrate-account-auth-methods");

const createFakeMigrationDb = ({
  documents = [],
  indexes = [{ name: "_id_", key: { _id: 1 } }],
  ledgerEntry = null
} = {}) => {
  const storedDocs = documents.map((doc) => ({ ...doc }));
  const storedIndexes = indexes.map((idx) => ({ ...idx }));
  const writes = [];
  let currentLedger = ledgerEntry;

  return {
    name: "test",
    writes,
    storedDocs,
    storedIndexes,
    getLedger: () => currentLedger,
    collection: (name) => {
      if (name === "accounts") {
        return {
          find: () => ({
            toArray: async () => storedDocs.map((doc) => ({ ...doc }))
          }),
          indexes: async () => storedIndexes.map((idx) => ({ ...idx })),
          createIndex: async (key, options) => {
            writes.push({ type: "createIndex", collection: "accounts", key, options });
            const indexName = options?.name || "googleSubject_1";
            if (!storedIndexes.some((idx) => idx.name === indexName)) {
              storedIndexes.push({ name: indexName, key, ...options });
            }
          },
          updateOne: async (filter, update) => {
            writes.push({ type: "updateOne", collection: "accounts", filter, update });
            const target = storedDocs.find(
              (doc) => String(doc._id) === String(filter._id)
            );
            if (!target) {
              return { matchedCount: 0, modifiedCount: 0 };
            }
            Object.assign(target, update.$set || {});
            return { matchedCount: 1, modifiedCount: 1 };
          },
          findOne: async () => null
        };
      }

      if (name === "migration_ledger") {
        return {
          find: () => ({ toArray: async () => (currentLedger ? [currentLedger] : []) }),
          indexes: async () => [{ name: "_id_", key: { _id: 1 } }],
          createIndex: async (key, options) => {
            writes.push({ type: "createIndex", collection: "migration_ledger", key, options });
          },
          findOne: async (filter) =>
            currentLedger && currentLedger.migrationId === filter.migrationId
              ? currentLedger
              : null,
          updateOne: async (filter, update) => {
            writes.push({ type: "updateOne", collection: "migration_ledger", filter, update });
            if (!currentLedger) {
              currentLedger = { ...(update.$setOnInsert || {}), ...filter };
            }
            return { matchedCount: 1, modifiedCount: 1 };
          }
        };
      }

      throw new Error(`Unexpected collection: ${name}`);
    }
  };
};

test("Account schema requires passwordHash for PASSWORD accounts and allows Google-only accounts without passwordHash", async () => {
  // 1. Default authMethods (PASSWORD) without passwordHash fails validation
  const missingPasswordDoc = new Account({
    email: "missing-pw@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    status: ACCOUNT_STATUSES.ACTIVE
  });
  await assert.rejects(
    () => missingPasswordDoc.validate(),
    (error) => error.name === "ValidationError" && Boolean(error.errors?.passwordHash)
  );

  // 2. Explicit PASSWORD + GOOGLE without passwordHash fails validation
  const hybridMissingPw = new Account({
    email: "hybrid-no-pw@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.PASSWORD, AUTH_METHODS.GOOGLE],
    googleSubject: "google-sub-hybrid-1"
  });
  await assert.rejects(
    () => hybridMissingPw.validate(),
    (error) => error.name === "ValidationError" && Boolean(error.errors?.passwordHash)
  );

  // 3. Blank whitespace passwordHash fails validation
  const blankPwDoc = new Account({
    email: "blank-pw@example.com",
    passwordHash: "   ",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  await assert.rejects(
    () => blankPwDoc.validate(),
    (error) => error.name === "ValidationError" && Boolean(error.errors?.passwordHash)
  );

  // 4. Google-only account without passwordHash passes validation
  const googleOnlyDoc = new Account({
    email: "google-only-valid@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.GOOGLE],
    googleSubject: "google-sub-valid-001"
  });
  await assert.doesNotReject(() => googleOnlyDoc.validate());

  // 5. Google-only account without googleSubject fails validation
  const googleMissingSubject = new Account({
    email: "google-no-sub@example.com",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: [AUTH_METHODS.GOOGLE]
  });
  await assert.rejects(
    () => googleMissingSubject.validate(),
    (error) => error.name === "ValidationError" && Boolean(error.errors?.googleSubject)
  );

  // 6. Empty authMethods fails validation
  const emptyMethodsDoc = new Account({
    email: "empty-methods@example.com",
    passwordHash: "hashed",
    role: ACCOUNT_ROLES.APPLICANT,
    authMethods: []
  });
  await assert.rejects(
    () => emptyMethodsDoc.validate(),
    (error) => error.name === "ValidationError" && Boolean(error.errors?.authMethods)
  );
});

test("classifyAccountDocument categorizes legacy password, google, linked, and conflicting accounts", () => {
  // Legacy account with passwordHash and no authMethods -> needs_backfill [PASSWORD]
  const legacyPassword = classifyAccountDocument({
    _id: "acc-1",
    email: "legacy@example.com",
    passwordHash: "$2b$10$hash"
  });
  assert.equal(legacyPassword.status, "needs_backfill");
  assert.deepEqual(legacyPassword.backfill.targetAuthMethods, [AUTH_METHODS.PASSWORD]);

  // Account with both passwordHash and googleSubject but only PASSWORD in authMethods -> needs_backfill [PASSWORD, GOOGLE]
  const missingGoogleMethod = classifyAccountDocument({
    _id: "acc-2",
    email: "linked@example.com",
    passwordHash: "$2b$10$hash",
    googleSubject: " sub-123 ",
    authMethods: [AUTH_METHODS.PASSWORD]
  });
  assert.equal(missingGoogleMethod.status, "needs_backfill");
  assert.deepEqual(missingGoogleMethod.backfill.targetAuthMethods, [
    AUTH_METHODS.PASSWORD,
    AUTH_METHODS.GOOGLE
  ]);
  assert.equal(missingGoogleMethod.backfill.trimmedGoogleSubject, "sub-123");
  assert.equal(missingGoogleMethod.backfill.needsSubjectTrim, true);

  // Compliant Google-only account
  const compliantGoogle = classifyAccountDocument({
    _id: "acc-3",
    email: "google@example.com",
    googleSubject: "sub-456",
    authMethods: [AUTH_METHODS.GOOGLE]
  });
  assert.equal(compliantGoogle.status, "compliant");

  // Conflict: neither passwordHash nor googleSubject
  const unclassifiable = classifyAccountDocument({
    _id: "acc-4",
    email: "broken@example.com"
  });
  assert.equal(unclassifiable.status, "conflict");
  assert.equal(unclassifiable.conflict.reason, "unclassifiable_account");

  // Conflict: explicit null/empty googleSubject
  const nullSubject = classifyAccountDocument({
    _id: "acc-5",
    email: "nullsub@example.com",
    passwordHash: "$2b$10$hash",
    googleSubject: null
  });
  assert.equal(nullSubject.status, "conflict");
  assert.equal(nullSubject.conflict.reason, "invalid_google_subject");

  // Conflict: claims PASSWORD in authMethods but has no passwordHash
  const claimsPasswordWithoutHash = classifyAccountDocument({
    _id: "acc-6",
    email: "bad-claim@example.com",
    googleSubject: "sub-789",
    authMethods: [AUTH_METHODS.PASSWORD, AUTH_METHODS.GOOGLE]
  });
  assert.equal(claimsPasswordWithoutHash.status, "conflict");
  assert.equal(claimsPasswordWithoutHash.conflict.reason, "password_method_without_hash");
});

test("dry-run mode inspects accounts and indexes without performing any writes", async () => {
  const db = createFakeMigrationDb({
    documents: [
      { _id: "1", email: "a@example.com", passwordHash: "hash-1" },
      {
        _id: "2",
        email: "b@example.com",
        passwordHash: "hash-2",
        googleSubject: "sub-2",
        authMethods: [AUTH_METHODS.PASSWORD]
      },
      {
        _id: "3",
        email: "c@example.com",
        googleSubject: "sub-3",
        authMethods: [AUTH_METHODS.GOOGLE]
      }
    ]
  });

  const summary = await runGoogleAuthMigration({
    db,
    options: { apply: false }
  });

  assert.equal(summary.mode, "dry-run");
  assert.equal(summary.dryRun, true);
  assert.equal(summary.totalAccounts, 3);
  assert.equal(summary.alreadyCompliant, 1);
  assert.equal(summary.needsBackfill, 2);
  assert.equal(summary.conflictCount, 0);
  assert.equal(summary.googleSubjectIndex.status, "missing");
  assert.deepEqual(db.writes, []);

  // Regression: MIGRATION_APPLY=true in environment must NOT enable apply when --apply CLI flag is absent
  const previousMigrationApply = process.env.MIGRATION_APPLY;
  const previousBackupRef = process.env.MIGRATION_BACKUP_REFERENCE;
  process.env.MIGRATION_APPLY = "true";
  process.env.MIGRATION_BACKUP_REFERENCE = "backup-env-should-not-trigger-apply";

  try {
    const cliOptionsWithoutFlag = parseCliOptions([]);
    assert.equal(cliOptionsWithoutFlag.apply, false);

    const envSummary = await runGoogleAuthMigration({
      db,
      options: cliOptionsWithoutFlag
    });
    assert.equal(envSummary.mode, "dry-run");
    assert.equal(envSummary.dryRun, true);
    assert.deepEqual(db.writes, []);
  } finally {
    if (previousMigrationApply === undefined) {
      delete process.env.MIGRATION_APPLY;
    } else {
      process.env.MIGRATION_APPLY = previousMigrationApply;
    }
    if (previousBackupRef === undefined) {
      delete process.env.MIGRATION_BACKUP_REFERENCE;
    } else {
      process.env.MIGRATION_BACKUP_REFERENCE = previousBackupRef;
    }
  }
});

test("apply mode requires MIGRATION_BACKUP_REFERENCE and stops before writing on conflicts, duplicate googleSubject, or incompatible index", async () => {
  const validDb = createFakeMigrationDb({
    documents: [{ _id: "1", email: "a@example.com", passwordHash: "hash-1" }]
  });

  await assert.rejects(
    () =>
      runGoogleAuthMigration({
        db: validDb,
        options: { apply: true, backupReference: "   " }
      }),
    /MIGRATION_BACKUP_REFERENCE/
  );
  assert.deepEqual(validDb.writes, []);

  // Conflict stops apply before writes
  const conflictDb = createFakeMigrationDb({
    documents: [
      { _id: "1", email: "ok@example.com", passwordHash: "hash-1" },
      { _id: "2", email: "orphan@example.com" }
    ]
  });
  await assert.rejects(
    () =>
      runGoogleAuthMigration({
        db: conflictDb,
        options: { apply: true, backupReference: "backup-20261026" }
      }),
    /conflicting\/unclassifiable/
  );
  assert.deepEqual(conflictDb.writes, []);

  // Duplicate googleSubject stops apply before writes
  const duplicateSubDb = createFakeMigrationDb({
    documents: [
      { _id: "1", email: "one@example.com", googleSubject: "dup-sub" },
      { _id: "2", email: "two@example.com", googleSubject: "dup-sub" }
    ]
  });
  await assert.rejects(
    () =>
      runGoogleAuthMigration({
        db: duplicateSubDb,
        options: { apply: true, backupReference: "backup-20261026" }
      }),
    /duplicate googleSubject/
  );
  assert.deepEqual(duplicateSubDb.writes, []);

  // Incompatible googleSubject index stops apply before writes
  const incompatibleIndexDb = createFakeMigrationDb({
    documents: [{ _id: "1", email: "ok@example.com", passwordHash: "hash-1" }],
    indexes: [
      { name: "_id_", key: { _id: 1 } },
      { name: "googleSubject_1", key: { googleSubject: 1 }, unique: true, sparse: false }
    ]
  });
  await assert.rejects(
    () =>
      runGoogleAuthMigration({
        db: incompatibleIndexDb,
        options: { apply: true, backupReference: "backup-20261026" }
      }),
    /incompatible googleSubject index/
  );
  assert.deepEqual(incompatibleIndexDb.writes, []);
});

test("apply mode backfills accounts, creates sparse unique googleSubject index, writes ledger, and is idempotent on rerun", async () => {
  let mongo;
  try {
    mongo = await MongoMemoryServer.create();
    const connection = await mongoose.createConnection(mongo.getUri(), {
      autoIndex: false
    }).asPromise();

    try {
      const rawAccounts = connection.db.collection("accounts");
      await rawAccounts.insertMany([
        {
          email: "legacy-pw@example.com",
          passwordHash: "$2b$04$legacyhash1",
          role: ACCOUNT_ROLES.APPLICANT,
          status: ACCOUNT_STATUSES.ACTIVE
        },
        {
          email: "legacy-linked@example.com",
          passwordHash: "$2b$04$legacyhash2",
          googleSubject: " google-sub-linked-01 ",
          authMethods: [AUTH_METHODS.PASSWORD],
          role: ACCOUNT_ROLES.APPLICANT,
          status: ACCOUNT_STATUSES.ACTIVE
        },
        {
          email: "google-native@example.com",
          googleSubject: "google-sub-native-02",
          authMethods: [AUTH_METHODS.GOOGLE],
          role: ACCOUNT_ROLES.APPLICANT,
          status: ACCOUNT_STATUSES.ACTIVE
        }
      ]);

      const dbAdapter = {
        name: connection.name,
        collection: (name) => connection.db.collection(name)
      };

      // 1. Dry-run before apply does not write
      const dryRunResult = await runGoogleAuthMigration({
        db: dbAdapter,
        options: { apply: false }
      });
      assert.equal(dryRunResult.dryRun, true);
      assert.equal(dryRunResult.needsBackfill, 2);
      assert.equal(dryRunResult.alreadyCompliant, 1);
      assert.equal(dryRunResult.googleSubjectIndex.status, "missing");
      assert.equal(dryRunResult.existingLedgerEntry, false);

      // 2. Verify fails before apply
      await assert.rejects(
        () =>
          runGoogleAuthMigration({
            db: dbAdapter,
            options: { apply: false, verify: true }
          }),
        /verification failed/
      );

      // 3. Apply succeeds with backupReference
      const applyResult = await runGoogleAuthMigration({
        db: dbAdapter,
        options: {
          apply: true,
          backupReference: "atlas-snapshot-2026-10-26"
        }
      });
      assert.equal(applyResult.dryRun, false);
      assert.equal(applyResult.modifiedAccounts, 2);
      assert.equal(applyResult.createdGoogleSubjectIndex, true);
      assert.equal(applyResult.existingLedgerEntry, true);
      assert.equal(applyResult.needsBackfill, 0);

      // Verify persisted documents
      const legacyPwDoc = await rawAccounts.findOne({ email: "legacy-pw@example.com" });
      assert.deepEqual(legacyPwDoc.authMethods, [AUTH_METHODS.PASSWORD]);

      const legacyLinkedDoc = await rawAccounts.findOne({ email: "legacy-linked@example.com" });
      assert.deepEqual(legacyLinkedDoc.authMethods, [
        AUTH_METHODS.PASSWORD,
        AUTH_METHODS.GOOGLE
      ]);
      assert.equal(legacyLinkedDoc.googleSubject, "google-sub-linked-01");

      const ledgerEntry = await connection.db
        .collection("migration_ledger")
        .findOne({ migrationId: MIGRATION_ID });
      assert.ok(ledgerEntry);
      assert.equal(ledgerEntry.backupReference, "atlas-snapshot-2026-10-26");

      // 4. Rerun apply is idempotent
      const rerunResult = await runGoogleAuthMigration({
        db: dbAdapter,
        options: {
          apply: true,
          backupReference: "atlas-snapshot-2026-10-26"
        }
      });
      assert.equal(rerunResult.modifiedAccounts, 0);
      assert.equal(rerunResult.createdGoogleSubjectIndex, false);
      assert.equal(rerunResult.needsBackfill, 0);
      assert.equal(rerunResult.alreadyCompliant, 3);

      // 5. Verify mode passes after apply
      const verifyResult = await runGoogleAuthMigration({
        db: dbAdapter,
        options: { apply: false, verify: true }
      });
      assert.equal(verifyResult.mode, "verify");
      assert.equal(verifyResult.googleSubjectIndex.status, "matching");
    } finally {
      await connection.close();
    }
  } finally {
    if (mongo) {
      await mongo.stop();
    }
  }
});

test("CLI parser defaults to dry-run and parses --apply, --verify, and --database", () => {
  assert.deepEqual(parseCliOptions([]), {
    apply: false,
    verify: false,
    expectedDatabase: undefined,
    backupReference: process.env.MIGRATION_BACKUP_REFERENCE?.trim()
  });

  assert.deepEqual(parseCliOptions(["--apply", "--database", "cvbuddy"]), {
    apply: true,
    verify: false,
    expectedDatabase: "cvbuddy",
    backupReference: process.env.MIGRATION_BACKUP_REFERENCE?.trim()
  });
});
