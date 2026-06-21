const dotenv = require("dotenv");

dotenv.config();

const app = require("./app");
const connectDB = require("./config/db");

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
