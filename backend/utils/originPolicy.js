function isProduction() {
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

function parseAllowedOrigins() {
  return String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins() {
  const allowedOrigins = parseAllowedOrigins();

  if (isProduction() && allowedOrigins.length === 0) {
    throw new Error("CORS_ORIGINS must be configured in production");
  }

  return allowedOrigins;
}

function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) {
    return true;
  }

  if (allowedOrigins.length === 0) {
    return !isProduction();
  }

  return allowedOrigins.includes(origin);
}

module.exports = {
  getAllowedOrigins,
  isAllowedOrigin
};
