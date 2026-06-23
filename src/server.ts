import dotenv from "dotenv";

dotenv.config();

import app from "./app";
import connectDB from "./config/db";

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, () => {
      console.log(`CVBuddy backend server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("CVBuddy backend failed to start.");
    console.error(error.message);
    process.exit(1);
  }
};

startServer();
