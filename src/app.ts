import express from "express";
import cors from "cors";
import helmet from "helmet";
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
import portfolioCollectionPublicRoutes from "./modules/portfolios/portfolioCollectionPublic.routes";
import mobileRoutes from "./modules/mobile/mobile.routes";
import uploadRoutes from "./modules/uploads/upload.routes";
import adminRoutes from "./modules/admin/admin.routes";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import { generalRateLimit, uploadRateLimit } from "./middlewares/rateLimit.middleware";
import { accessLogger, requestContext } from "./middlewares/requestContext.middleware";
import {
  getAllowedOrigins,
  getTrustProxy,
  isSwaggerEnabled,
  validateSecurityConfig
} from "./config/security";

validateSecurityConfig();
const app = express();
const allowedOrigins = getAllowedOrigins();

app.set("trust proxy", getTrustProxy());
app.disable("x-powered-by");
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      upgradeInsecureRequests: []
    }
  }
}));

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
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
  allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  exposedHeaders: ["X-Request-ID"]
};

app.use(requestContext);
app.use(accessLogger);
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(generalRateLimit);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(
  "/uploads",
  express.static(path.join(process.cwd(), process.env.UPLOAD_DIR || "uploads"))
);

if (isSwaggerEnabled()) {
  app.get("/api/docs.json", (req, res) => {
    res.setHeader("Content-Type", "application/json");
    return res.status(200).json(swaggerSpec);
  });
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
}

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/applicant-profile", uploadRateLimit, applicantProfileRoutes);
app.use("/api/cvs", cvRoutes);
app.use("/api/uploads", uploadRateLimit, uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/portfolio", uploadRateLimit, portfolioDomainRoutes);
app.use("/api/public/portfolios", portfolioCollectionPublicRoutes);
app.use("/api/portfolios", uploadRateLimit, legacyPortfolioRoutes);
app.use("/api/portfolio-items", uploadRateLimit, portfolioItemRouter);
app.use("/api/mobile", uploadRateLimit, mobileRoutes);
app.use("/api/admin", adminRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
