const express = require("express");
const cors = require("cors");

const healthRoutes = require("./routes/health.routes");
const {
  errorHandler,
  notFoundHandler
} = require("./middlewares/error.middleware");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api/health", healthRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
