import { AUTH_METHODS, AUTH_METHOD_VALUES } from "../../constants/enums";

const MIGRATION_ID = "2026-10-26-account-google-auth-v1";

const GOOGLE_SUBJECT_INDEX_SPEC = Object.freeze({
  collection: "accounts",
  name: "googleSubject_1",
  key: { googleSubject: 1 },
  options: { unique: true, sparse: true }
});

export type AccountMigrationDocument = {
  _id: { toString(): string } | string;
  email?: unknown;
  passwordHash?: unknown;
  authMethods?: unknown;
  googleSubject?: unknown;
};

export type AccountMigrationConflict = {
  accountId: string;
  email?: string;
  reason:
    | "unclassifiable_account"
    | "blank_password_hash"
    | "invalid_google_subject"
    | "invalid_auth_methods"
    | "password_method_without_hash"
    | "google_method_without_subject";
};

export type AccountMigrationBackfillPlan = {
  accountId: string;
  rawId: unknown;
  email?: string;
  currentAuthMethods: string[];
  targetAuthMethods: string[];
  trimmedGoogleSubject?: string;
  needsSubjectTrim: boolean;
};

export type DuplicateGoogleSubjectFinding = {
  googleSubject: string;
  count: number;
  accountIds: string[];
};

export type GoogleSubjectIndexReport = {
  status: "matching" | "missing" | "incompatible";
  missing: Array<typeof GOOGLE_SUBJECT_INDEX_SPEC>;
  incompatible: Array<{
    expected: typeof GOOGLE_SUBJECT_INDEX_SPEC;
    existing: unknown;
  }>;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const classifyAccountDocument = (
  doc: AccountMigrationDocument
): {
  status: "compliant" | "needs_backfill" | "conflict";
  conflict?: AccountMigrationConflict;
  backfill?: AccountMigrationBackfillPlan;
  normalizedGoogleSubject?: string;
} => {
  const accountId =
    typeof doc._id === "string" ? doc._id : doc._id?.toString?.() || "unknown";
  const email = typeof doc.email === "string" ? doc.email : undefined;

  const hasPasswordHashField =
    doc.passwordHash !== undefined && doc.passwordHash !== null;
  const hasValidPasswordHash = isNonEmptyString(doc.passwordHash);
  if (hasPasswordHashField && !hasValidPasswordHash) {
    return {
      status: "conflict",
      conflict: {
        accountId,
        email,
        reason: "blank_password_hash"
      }
    };
  }

  const hasGoogleSubjectProperty = Object.prototype.hasOwnProperty.call(
    doc,
    "googleSubject"
  ) && doc.googleSubject !== undefined;
  const hasValidGoogleSubject = isNonEmptyString(doc.googleSubject);
  if (hasGoogleSubjectProperty && !hasValidGoogleSubject) {
    return {
      status: "conflict",
      conflict: {
        accountId,
        email,
        reason: "invalid_google_subject"
      }
    };
  }

  const rawMethods = doc.authMethods;
  if (rawMethods !== undefined && rawMethods !== null) {
    if (
      !Array.isArray(rawMethods) ||
      rawMethods.some(
        (method) =>
          typeof method !== "string" ||
          !(AUTH_METHOD_VALUES as readonly string[]).includes(method)
      )
    ) {
      return {
        status: "conflict",
        conflict: {
          accountId,
          email,
          reason: "invalid_auth_methods"
        }
      };
    }

    if (
      rawMethods.includes(AUTH_METHODS.PASSWORD) &&
      !hasValidPasswordHash
    ) {
      return {
        status: "conflict",
        conflict: {
          accountId,
          email,
          reason: "password_method_without_hash"
        }
      };
    }

    if (
      rawMethods.includes(AUTH_METHODS.GOOGLE) &&
      !hasValidGoogleSubject
    ) {
      return {
        status: "conflict",
        conflict: {
          accountId,
          email,
          reason: "google_method_without_subject"
        }
      };
    }
  }

  if (!hasValidPasswordHash && !hasValidGoogleSubject) {
    return {
      status: "conflict",
      conflict: {
        accountId,
        email,
        reason: "unclassifiable_account"
      }
    };
  }

  const targetMethods: string[] = [];
  if (hasValidPasswordHash) {
    targetMethods.push(AUTH_METHODS.PASSWORD);
  }
  if (hasValidGoogleSubject) {
    targetMethods.push(AUTH_METHODS.GOOGLE);
  }

  const currentMethods = Array.isArray(rawMethods) ? (rawMethods as string[]) : [];
  const trimmedGoogleSubject = hasValidGoogleSubject
    ? (doc.googleSubject as string).trim()
    : undefined;
  const needsSubjectTrim =
    hasValidGoogleSubject && doc.googleSubject !== trimmedGoogleSubject;

  const hasExactMethods =
    currentMethods.length === targetMethods.length &&
    targetMethods.every((method) => currentMethods.includes(method)) &&
    new Set(currentMethods).size === currentMethods.length;

  if (hasExactMethods && !needsSubjectTrim) {
    return {
      status: "compliant",
      normalizedGoogleSubject: trimmedGoogleSubject
    };
  }

  return {
    status: "needs_backfill",
    normalizedGoogleSubject: trimmedGoogleSubject,
    backfill: {
      accountId,
      rawId: doc._id,
      email,
      currentAuthMethods: currentMethods,
      targetAuthMethods: targetMethods,
      trimmedGoogleSubject,
      needsSubjectTrim
    }
  };
};

const classifyGoogleSubjectIndex = (
  existingIndexes: Array<Record<string, any>>
): GoogleSubjectIndexReport => {
  const expected = GOOGLE_SUBJECT_INDEX_SPEC;
  const existingByName = existingIndexes.find(
    (index) => index.name === expected.name
  );
  const existingByKey = existingIndexes.find(
    (index) => JSON.stringify(index.key) === JSON.stringify(expected.key)
  );
  const existing = existingByName || existingByKey;

  if (!existing) {
    return {
      status: "missing",
      missing: [expected],
      incompatible: []
    };
  }

  const matches =
    existing.name === expected.name &&
    JSON.stringify(existing.key) === JSON.stringify(expected.key) &&
    Boolean(existing.unique) === Boolean(expected.options.unique) &&
    Boolean(existing.sparse) === Boolean(expected.options.sparse);

  if (!matches) {
    return {
      status: "incompatible",
      missing: [],
      incompatible: [{ expected, existing }]
    };
  }

  return {
    status: "matching",
    missing: [],
    incompatible: []
  };
};

const findDuplicateGoogleSubjects = (
  documents: AccountMigrationDocument[]
): DuplicateGoogleSubjectFinding[] => {
  const bySubject = new Map<string, string[]>();

  for (const doc of documents) {
    if (!isNonEmptyString(doc.googleSubject)) {
      continue;
    }
    const normalized = doc.googleSubject.trim();
    const accountId =
      typeof doc._id === "string" ? doc._id : doc._id?.toString?.() || "unknown";
    const group = bySubject.get(normalized) || [];
    group.push(accountId);
    bySubject.set(normalized, group);
  }

  const duplicates: DuplicateGoogleSubjectFinding[] = [];
  for (const [googleSubject, accountIds] of bySubject.entries()) {
    if (accountIds.length > 1) {
      duplicates.push({
        googleSubject,
        count: accountIds.length,
        accountIds
      });
    }
  }

  return duplicates.sort((a, b) => b.count - a.count);
};

export type MigrationCollectionAdapter = {
  find: (
    filter?: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => { toArray: () => Promise<AccountMigrationDocument[]> } | Promise<AccountMigrationDocument[]>;
  indexes: () => Promise<Array<Record<string, any>>>;
  createIndex: (
    key: Record<string, unknown>,
    options: Record<string, unknown>
  ) => Promise<unknown>;
  updateOne: (
    filter: Record<string, unknown>,
    update: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<{ modifiedCount?: number; matchedCount?: number }>;
  findOne: (filter: Record<string, unknown>) => Promise<unknown>;
};

export type MigrationDatabaseAdapter = {
  name?: string;
  collection: (name: string) => MigrationCollectionAdapter;
};

export type GoogleAuthMigrationOptions = {
  apply: boolean;
  verify?: boolean;
  backupReference?: string;
  expectedDatabase?: string;
};

const listCollectionDocuments = async (
  collection: MigrationCollectionAdapter
): Promise<AccountMigrationDocument[]> => {
  const cursorOrPromise = collection.find(
    {},
    {
      projection: {
        _id: 1,
        email: 1,
        passwordHash: 1,
        authMethods: 1,
        googleSubject: 1
      }
    }
  );
  if (Array.isArray(cursorOrPromise)) {
    return cursorOrPromise;
  }
  if (
    cursorOrPromise &&
    typeof (cursorOrPromise as { toArray?: unknown }).toArray === "function"
  ) {
    return (cursorOrPromise as { toArray: () => Promise<AccountMigrationDocument[]> }).toArray();
  }
  return cursorOrPromise as Promise<AccountMigrationDocument[]>;
};

const listCollectionIndexes = async (
  collection: MigrationCollectionAdapter
): Promise<Array<Record<string, any>>> => {
  try {
    return await collection.indexes();
  } catch (error: any) {
    if (error?.codeName === "NamespaceNotFound" || error?.code === 26) {
      return [];
    }
    throw error;
  }
};

const assertExpectedDatabaseIfProvided = (
  expectedDatabase: string | undefined,
  actualDatabase: string | undefined
) => {
  if (!expectedDatabase?.trim()) {
    return;
  }
  if (expectedDatabase.trim() !== (actualDatabase || "").trim()) {
    throw new Error(
      `Connected database "${actualDatabase || ""}" does not match expected database "${expectedDatabase.trim()}".`
    );
  }
};

const runGoogleAuthMigration = async ({
  db,
  options
}: {
  db: MigrationDatabaseAdapter;
  options: GoogleAuthMigrationOptions;
}) => {
  assertExpectedDatabaseIfProvided(options.expectedDatabase, db.name);

  const accountsCollection = db.collection("accounts");
  const ledgerCollection = db.collection("migration_ledger");

  const [documents, existingIndexes, existingLedgerDoc] = await Promise.all([
    listCollectionDocuments(accountsCollection),
    listCollectionIndexes(accountsCollection),
    ledgerCollection.findOne({ migrationId: MIGRATION_ID })
  ]);

  let alreadyCompliant = 0;
  const backfills: AccountMigrationBackfillPlan[] = [];
  const conflicts: AccountMigrationConflict[] = [];

  for (const doc of documents) {
    const classification = classifyAccountDocument(doc);
    if (classification.status === "compliant") {
      alreadyCompliant += 1;
    } else if (classification.status === "needs_backfill" && classification.backfill) {
      backfills.push(classification.backfill);
    } else if (classification.status === "conflict" && classification.conflict) {
      conflicts.push(classification.conflict);
    }
  }

  const duplicateGoogleSubjects = findDuplicateGoogleSubjects(documents);
  const indexReport = classifyGoogleSubjectIndex(existingIndexes);
  const existingLedgerEntry = Boolean(existingLedgerDoc);

  const summary = {
    mode: options.apply ? "apply" : options.verify ? "verify" : "dry-run",
    dryRun: !options.apply,
    migrationId: MIGRATION_ID,
    database: db.name || "default",
    existingLedgerEntry,
    totalAccounts: documents.length,
    alreadyCompliant,
    needsBackfill: backfills.length,
    conflictCount: conflicts.length,
    conflicts,
    duplicateGoogleSubjectCount: duplicateGoogleSubjects.length,
    duplicateGoogleSubjects,
    googleSubjectIndex: {
      status: indexReport.status,
      missing: indexReport.missing.map((item) => item.name),
      incompatible: indexReport.incompatible.map((item) => item.expected.name)
    },
    modifiedAccounts: 0,
    createdGoogleSubjectIndex: false
  };

  if (!options.apply) {
    if (options.verify) {
      if (
        !existingLedgerEntry ||
        backfills.length > 0 ||
        conflicts.length > 0 ||
        duplicateGoogleSubjects.length > 0 ||
        indexReport.status !== "matching"
      ) {
        throw new Error(
          "Google Auth migration verification failed: database has unmigrated accounts, conflicts, duplicate Google subjects, missing/incompatible index, or missing ledger entry."
        );
      }
    }
    return summary;
  }

  const backupReference = options.backupReference?.trim();
  if (!backupReference) {
    throw new Error(
      "MIGRATION_BACKUP_REFERENCE is required before applying the Google Auth account migration."
    );
  }

  if (conflicts.length > 0) {
    throw new Error(
      `Refusing to apply Google Auth migration while ${conflicts.length} conflicting/unclassifiable account(s) exist.`
    );
  }

  if (duplicateGoogleSubjects.length > 0) {
    throw new Error(
      `Refusing to apply Google Auth migration while ${duplicateGoogleSubjects.length} duplicate googleSubject group(s) exist.`
    );
  }

  if (indexReport.status === "incompatible") {
    throw new Error(
      "Refusing to apply Google Auth migration while an incompatible googleSubject index exists."
    );
  }

  let modifiedAccounts = 0;
  for (const plan of backfills) {
    const setFields: Record<string, unknown> = {
      authMethods: plan.targetAuthMethods
    };
    if (plan.needsSubjectTrim && plan.trimmedGoogleSubject) {
      setFields.googleSubject = plan.trimmedGoogleSubject;
    }

    const updateResult = await accountsCollection.updateOne(
      { _id: plan.rawId },
      { $set: setFields }
    );
    modifiedAccounts += updateResult?.modifiedCount ?? 0;
  }

  let createdGoogleSubjectIndex = false;
  if (indexReport.status === "missing") {
    await accountsCollection.createIndex(GOOGLE_SUBJECT_INDEX_SPEC.key, {
      ...GOOGLE_SUBJECT_INDEX_SPEC.options,
      name: GOOGLE_SUBJECT_INDEX_SPEC.name
    });
    createdGoogleSubjectIndex = true;
  }

  const postApplyIndexes = await listCollectionIndexes(accountsCollection);
  const postApplyIndexReport = classifyGoogleSubjectIndex(postApplyIndexes);
  if (postApplyIndexReport.status !== "matching") {
    throw new Error(
      "Google subject index verification failed after apply; migration ledger was not updated."
    );
  }

  await ledgerCollection.createIndex({ migrationId: 1 }, { unique: true });
  await ledgerCollection.updateOne(
    { migrationId: MIGRATION_ID },
    {
      $setOnInsert: {
        migrationId: MIGRATION_ID,
        backupReference,
        appliedAt: new Date()
      }
    },
    { upsert: true }
  );

  return {
    ...summary,
    existingLedgerEntry: true,
    alreadyCompliant: alreadyCompliant + backfills.length,
    needsBackfill: 0,
    modifiedAccounts,
    createdGoogleSubjectIndex,
    googleSubjectIndex: {
      status: "matching" as const,
      missing: [],
      incompatible: []
    }
  };
};

export {
  MIGRATION_ID,
  GOOGLE_SUBJECT_INDEX_SPEC,
  classifyAccountDocument,
  classifyGoogleSubjectIndex,
  findDuplicateGoogleSubjects,
  runGoogleAuthMigration
};
