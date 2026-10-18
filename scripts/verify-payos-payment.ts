import "dotenv/config";
import mongoose from "mongoose";

import { createPayOSAdapter } from "../src/modules/billing/payos.adapter";
import { verifyPaidOrderProviderState } from "../src/modules/billing/paymentProviderVerification";

const argument = (name: string) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined;
};

const expectedDatabase = argument("--database");
const orderId = argument("--order-id");

const fail = (code: string) => {
  console.error(JSON.stringify({ ok: false, code }));
  process.exitCode = 1;
};

const run = async () => {
  if (!expectedDatabase || !orderId) return fail("BILLING_PROVIDER_VERIFICATION_ARGUMENTS_REQUIRED");
  if (!mongoose.isValidObjectId(orderId)) return fail("BILLING_PROVIDER_VERIFICATION_INVALID_ORDER_ID");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) return fail("BILLING_PROVIDER_VERIFICATION_DATABASE_UNAVAILABLE");

  const connection = await mongoose.createConnection(uri, { dbName: expectedDatabase }).asPromise();
  try {
    if (connection.db.databaseName !== expectedDatabase) return fail("BILLING_PROVIDER_VERIFICATION_DATABASE_MISMATCH");
    const order = await connection.db.collection("billing_orders").findOne(
      { _id: new mongoose.Types.ObjectId(orderId) },
      { projection: { orderCode: 1, paymentLinkId: 1, amountVnd: 1, status: 1 } }
    );
    if (!order) return fail("BILLING_PROVIDER_VERIFICATION_ORDER_NOT_FOUND");
    const verification = await verifyPaidOrderProviderState({ order: order as any, adapter: createPayOSAdapter() });
    console.log(JSON.stringify({ ok: verification.consistent, mutationPerformed: false, ...verification }));
    if (!verification.consistent) process.exitCode = 1;
  } finally {
    await connection.close();
  }
};

run().catch(() => fail("BILLING_PROVIDER_VERIFICATION_FAILED"));
