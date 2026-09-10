import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import { assertCloudinaryConfigured } from "./config/cloudinary.config";
import connectDB from "./config/db";

const PORT = Number(process.env.PORT || 5000);
const HOST = process.env.HOST?.trim() || "0.0.0.0";

const startServer = async () => {
  try {
    assertCloudinaryConfigured();
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
