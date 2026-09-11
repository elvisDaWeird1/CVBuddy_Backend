type LogLevel = "info" | "error";

const writeOperationalLog = (level: LogLevel, event: string, fields: Record<string, unknown> = {}) => {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields
  });

  if (level === "error") {
    console.error(payload);
    return;
  }

  console.log(payload);
};

const statusCategory = (statusCode: number) => {
  if (statusCode >= 500) return "server_error";
  if (statusCode >= 400) return "client_error";
  if (statusCode >= 300) return "redirect";
  return "success";
};

const getSafeRequestPath = (originalUrl: unknown, fallback = "/") => {
  if (typeof originalUrl !== "string") return fallback;
  return originalUrl.split("?", 1)[0] || fallback;
};

export { getSafeRequestPath, statusCategory, writeOperationalLog };
