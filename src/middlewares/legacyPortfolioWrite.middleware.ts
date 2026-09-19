import ApiError from "../utils/apiError";

const legacyPortfolioWritesEnabled = () =>
  process.env.NODE_ENV !== "production" || process.env.ENABLE_LEGACY_PORTFOLIO_WRITES === "true";

const blockLegacyPortfolioWrite = (req, res, next) => {
  if (legacyPortfolioWritesEnabled()) {
    return next();
  }

  return next(new ApiError(
    410,
    "Legacy Portfolio writes are disabled in production. Use /api/portfolio instead.",
    [],
    "LEGACY_PORTFOLIO_WRITES_DISABLED"
  ));
};

export {
  blockLegacyPortfolioWrite,
  legacyPortfolioWritesEnabled
};
