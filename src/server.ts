import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import connectDB from "./config/db";
import {
  assertMongoTransactionCapabilityForEnabledFeatures,
  validateProductionRuntimeConfig
} from "./config/runtime";
import { startAiUsageReconciliation } from "./modules/usage/usage.service";
import { isAiEnabled } from "./config/runtime";
import { startBillingReconciliation } from "./modules/billing/billing.service";
import { getBillingConfig, getBillingReconciliationConfig } from "./modules/billing/billing.config";

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST?.trim() || "0.0.0.0";

const startServer = async () => {
  try {
    validateProductionRuntimeConfig();
    await connectDB();
    await assertMongoTransactionCapabilityForEnabledFeatures();
    if (isAiEnabled()) startAiUsageReconciliation();
    if (getBillingConfig().enabled && getBillingReconciliationConfig().enabled) startBillingReconciliation();

    app.listen(PORT, HOST, () => {
      console.log(`CVBuddy backend server is running at http://${HOST}:${PORT}`);
    });
  } catch (error) {
    console.error("CVBuddy backend failed to start.");
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
