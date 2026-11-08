import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import { runGoogleAuthMigration } from "../src/modules/auth/googleAuthMigration";

const parseCliOptions = (argv: string[]) => {
  const databaseFlag = argv.indexOf("--database");
  const expectedDatabase = databaseFlag >= 0 ? argv[databaseFlag + 1] : undefined;
  if (databaseFlag >= 0 && (!expectedDatabase || expectedDatabase.startsWith("--"))) {
    throw new Error("--database requires a database name.");
  }

  return {
    apply: argv.includes("--apply"),
    verify: argv.includes("--verify"),
    expectedDatabase,
    backupReference: process.env.MIGRATION_BACKUP_REFERENCE?.trim()
  };
};

const runCli = async (argv = process.argv.slice(2)) => {
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGO_URI or MONGODB_URI is required.");
  }

  const options = parseCliOptions(argv);
  await mongoose.connect(uri, {
    autoIndex: false,
    serverSelectionTimeoutMS: 15_000
  });

  const db = mongoose.connection.db;
  const summary = await runGoogleAuthMigration({
    db: {
      name: mongoose.connection.name,
      collection: (name: string) => db.collection(name) as any
    },
    options
  });

  console.log(
    options.apply
      ? "Google Auth account migration applied"
      : options.verify
        ? "Google Auth account migration verified"
        : "Google Auth account migration preflight",
    summary
  );

  return summary;
};

if (require.main === module) {
  runCli()
    .catch((error) => {
      console.error("Google Auth account migration failed", {
        message: error instanceof Error ? error.message : String(error)
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

export { parseCliOptions, runCli };
