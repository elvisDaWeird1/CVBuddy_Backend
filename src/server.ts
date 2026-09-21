import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import connectDB from "./config/db";
import { validateProductionRuntimeConfig } from "./config/runtime";

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST?.trim() || "0.0.0.0";

const startServer = async () => {
  try {
    validateProductionRuntimeConfig();
    await connectDB();

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
