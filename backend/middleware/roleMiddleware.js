function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function authorizeRoles(...allowedRoles) {
  const normalized = new Set(allowedRoles.map((role) => normalizeRole(role)));

  return (req, res, next) => {
    if (!req.user) {
      return res.status(403).json({
        success: false,
        message: "Access denied. No user information found."
      });
    }

    const currentRole = normalizeRole(req.user.role_name);

    if (!currentRole) {
      return res.status(403).json({
        success: false,
        message: "Access denied. User role is unavailable."
      });
    }

    if (currentRole !== "superadmin" && !normalized.has(currentRole)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You do not have permission."
      });
    }

    next();
  };
}

module.exports = authorizeRoles;
