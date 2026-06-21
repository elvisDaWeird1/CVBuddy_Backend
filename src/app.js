const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const authRoutes = require("./modules/auth/auth.routes");
const applicantProfileRoutes = require("./modules/applicantProfiles/applicantProfile.routes");
const {
  errorHandler,
  notFoundHandler
} = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applicant-profile", applicantProfileRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
