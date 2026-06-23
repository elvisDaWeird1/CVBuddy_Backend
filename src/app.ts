import express from "express";
import cors from "cors";
import path from "path";

import healthRoutes from "./routes/health.routes";
import authRoutes from "./modules/auth/auth.routes";
import applicantProfileRoutes from "./modules/applicantProfiles/applicantProfile.routes";
import cvRoutes from "./modules/cvs/cv.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

const allowedOrigins = [
  process.env.CORS_ORIGIN,
  process.env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000"
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads"))
);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applicant-profile", applicantProfileRoutes);
app.use("/api/cvs", cvRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
