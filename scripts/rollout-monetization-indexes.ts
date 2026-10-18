import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

import { classifyMongoTransactionTopology } from "../src/config/mongoTransactions";
import { runMonetizationIndexRollout } from "../src/modules/billing/monetizationIndexRolloutRunner";

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
  if (!uri) throw new Error("MongoDB configuration is required.");

  const options = parseCliOptions(argv);
  await mongoose.connect(uri, { autoIndex: false, serverSelectionTimeoutMS: 15_000 });
  const db = mongoose.connection.db;
  const capability = classifyMongoTransactionTopology(await db.admin().command({ hello: 1 }));
  const summary = await runMonetizationIndexRollout({
    db: { name: mongoose.connection.name, collection: (name) => db.collection(name) as any },
    topology: capability,
    options
  });
  console.log("Monetization index rollout preflight", summary);
  return summary;
};

if (require.main === module) {
  runCli()
    .catch((error) => {
      console.error("Monetization index rollout failed", {
        name: error instanceof Error ? error.name : "Error",
        code: (error as { code?: string })?.code || "MIGRATION_PRECHECK_FAILED"
      });
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}

export { parseCliOptions, runCli };
