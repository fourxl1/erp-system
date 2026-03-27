const jwt = require("jsonwebtoken");
const { query } = require("../config/db");

function ensureJwtConfigured() {
  if (!process.env.JWT_SECRET) {
    const error = new Error("Authentication is not configured on the server");
    error.statusCode = 500;
    throw error;
  }
}

function buildUserContext(row, fallback = {}) {
  const roleName = row.role_name || fallback.role_name || "";

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role_id: row.role_id,
    location_id: row.location_id,
    role_name: roleName,
    role_code: roleName.toUpperCase()
  };
}

async function loadActiveUserById(userId, fallback = {}) {
  const result = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.role_id,
        u.location_id,
        COALESCE(r.name, '') AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND COALESCE(u.is_active, TRUE) = TRUE
    `,
    [userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  return buildUserContext(result.rows[0], fallback);
}

async function protect(req, res, next) {
  try {
    ensureJwtConfigured();
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message
    });
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token missing"
    });
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, invalid token"
    });
  }

  try {
    const user = await loadActiveUserById(decoded.id, decoded);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found"
      });
    }

    req.user = user;
    return next();
  } catch (error) {
    error.statusCode = error.statusCode || 500;
    return next(error);
  }
}

module.exports = {
  protect,
  loadActiveUserById
};
