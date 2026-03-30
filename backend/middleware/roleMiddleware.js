const { sendError } = require("../utils/http");

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function authorizeRoles(...allowedRoles) {
  const normalized = new Set(allowedRoles.map((role) => normalizeRole(role)));

  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, 403, "Access denied. No user information found.");
    }

    const currentRole = normalizeRole(req.user.role_name);

    if (!currentRole) {
      return sendError(res, 403, "Access denied. User role is unavailable.");
    }

    if (currentRole !== "superadmin" && !normalized.has(currentRole)) {
      return sendError(res, 403, "Access denied. You do not have permission.");
    }

    next();
  };
}

module.exports = authorizeRoles;
