const weakJwtSecrets = new Set([
  "change_me",
  "changeme",
  "secret",
  "jwt_secret",
  "your_jwt_secret"
]);

const isProduction = () => process.env.NODE_ENV === "production";

const parseOrigins = (value?: string) => (value || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const getAllowedOrigins = () => {
  const configuredOrigins = [
    ...parseOrigins(process.env.CORS_ORIGIN),
    ...parseOrigins(process.env.CLIENT_URL)
  ];

  if (isProduction()) {
    return [...new Set(configuredOrigins)];
  }

  const port = process.env.PORT || "5000";
  return [...new Set([
    ...configuredOrigins,
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
  ])];
};

const getTrustProxy = () => {
  const value = process.env.TRUST_PROXY;
  if (!value) return false;
  if (value === "true") return 1;
  if (value === "false") return false;

  const hops = Number.parseInt(value, 10);
  return Number.isInteger(hops) && hops >= 0 ? hops : false;
};

const isSwaggerEnabled = () =>
  process.env.SWAGGER_ENABLED === "true" || (!isProduction() && process.env.SWAGGER_ENABLED !== "false");

const validateSecurityConfig = () => {
  if (!isProduction()) return;

  const jwtSecret = process.env.JWT_SECRET?.trim();
  if (!jwtSecret || jwtSecret.length < 32 || weakJwtSecrets.has(jwtSecret.toLowerCase())) {
    throw new Error("JWT_SECRET must be a non-default value of at least 32 characters in production.");
  }

  if (!process.env.JWT_EXPIRES_IN?.trim()) {
    throw new Error("JWT_EXPIRES_IN is required in production.");
  }

  if (!getAllowedOrigins().length) {
    throw new Error("CORS_ORIGIN or CLIENT_URL must define at least one exact origin in production.");
  }

  if (!process.env.TRUST_PROXY) {
    throw new Error("TRUST_PROXY must be configured explicitly in production.");
  }
};

export {
  getAllowedOrigins,
  getTrustProxy,
  isProduction,
  isSwaggerEnabled,
  validateSecurityConfig
};
