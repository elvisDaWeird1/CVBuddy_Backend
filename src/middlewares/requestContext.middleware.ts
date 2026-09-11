import { randomUUID } from "crypto";

import { statusCategory, writeOperationalLog } from "../utils/operationalLogger";

const REQUEST_ID_HEADER = "X-Request-ID";
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;

const getSafeRequestId = (value: unknown) => {
  const candidate = typeof value === "string" ? value.trim() : "";
  return requestIdPattern.test(candidate) ? candidate : randomUUID();
};

const requestContext = (req, res, next) => {
  const requestId = getSafeRequestId(req.get(REQUEST_ID_HEADER));
  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
};

const accessLogger = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.once("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const statusCode = res.statusCode;

    writeOperationalLog(statusCode >= 500 ? "error" : "info", "http_request", {
      requestId: res.locals.requestId,
      method: req.method,
      path: req.path,
      statusCode,
      category: statusCategory(statusCode),
      durationMs: Number(durationMs.toFixed(2))
    });
  });

  next();
};

export { accessLogger, getSafeRequestId, requestContext, REQUEST_ID_HEADER };
