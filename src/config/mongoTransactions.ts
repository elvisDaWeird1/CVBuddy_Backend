import mongoose from "mongoose";

type MongoTransactionTopology = "replica_set" | "mongos" | "standalone" | "unavailable";

type MongoTransactionCapability = {
  required: boolean;
  supported: boolean;
  topology: MongoTransactionTopology;
};

const classifyMongoTransactionTopology = (hello: unknown): MongoTransactionCapability => {
  const value = typeof hello === "object" && hello !== null
    ? hello as Record<string, unknown>
    : {};

  if (value.msg === "isdbgrid") {
    return { required: false, supported: true, topology: "mongos" };
  }
  if (typeof value.setName === "string" && value.setName.trim()) {
    return { required: false, supported: true, topology: "replica_set" };
  }
  return { required: false, supported: false, topology: "standalone" };
};

const getMongoTransactionCapability = async (): Promise<MongoTransactionCapability> => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) {
    return { required: false, supported: false, topology: "unavailable" };
  }

  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    return classifyMongoTransactionTopology(hello);
  } catch {
    return { required: false, supported: false, topology: "unavailable" };
  }
};

export {
  classifyMongoTransactionTopology,
  getMongoTransactionCapability,
  type MongoTransactionCapability,
  type MongoTransactionTopology
};
