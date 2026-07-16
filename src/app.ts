import express from "express";
import cors from "cors";
import path from "path";
import swaggerUi from "swagger-ui-express";

import { swaggerSpec, swaggerUiOptions } from "./config/swagger";
import healthRoutes from "./routes/health.routes";
import authRoutes from "./modules/auth/auth.routes";
import applicantProfileRoutes from "./modules/applicantProfiles/applicantProfile.routes";
import cvRoutes from "./modules/cvs/cv.routes";
import aiRoutes from "./modules/ai/ai.routes";
import legacyPortfolioRoutes, { portfolioItemRouter } from "./modules/portfolios/portfolio.routes";
import portfolioDomainRoutes from "./modules/portfolios/portfolioDomain.routes";
import mobileRoutes from "./modules/mobile/mobile.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";

const app = express();

const parseCorsOrigins = (value?: string) => {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
};

const port = process.env.PORT || "5000";

const defaultAllowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:8081",
  "http://127.0.0.1:8081",
  "http://localhost:8082",
  "http://127.0.0.1:8082",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  `http://localhost:${port}`,
  `http://127.0.0.1:${port}`
];

const allowedOrigins = [
  ...parseCorsOrigins(process.env.CORS_ORIGIN),
  ...parseCorsOrigins(process.env.CLIENT_URL),
  ...defaultAllowedOrigins
];

const uniqueAllowedOrigins = [...new Set(allowedOrigins)];

const corsOptions = {
  origin(origin, callback) {
    if (!origin || uniqueAllowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    const error = new Error(`Not allowed by CORS: ${origin}`) as Error & {
      statusCode?: number;
    };
    error.statusCode = 403;

    return callback(error);
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

app.get("/api/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  return res.status(200).json(swaggerSpec);
});
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applicant-profile", applicantProfileRoutes);
app.use("/api/cvs", cvRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/portfolio", portfolioDomainRoutes);
app.use("/api/portfolios", legacyPortfolioRoutes);
app.use("/api/portfolio-items", portfolioItemRouter);
app.use("/api/mobile", mobileRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
