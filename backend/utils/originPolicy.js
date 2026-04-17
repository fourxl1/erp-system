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
    console.error("CORS_ORIGINS is not set in production. Server will start but all cross-origin requests will be blocked.");
    // Return empty list so isAllowedOrigin will block non-empty origins in production.
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
