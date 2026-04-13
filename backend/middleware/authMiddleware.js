const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const { sendError } = require("../utils/http");
const { toInt, isStaff } = require("../utils/locationContext");

function ensureJwtConfigured() {
  if (!process.env.JWT_SECRET) {
    const error = new Error("Authentication is not configured on the server");
    error.statusCode = 500;
    throw error;
  }
}

function buildUserContext(row, fallback = {}) {
  const roleName = row.role_name || fallback.role_name || "";
  const decodedActiveLocation = toInt(fallback.active_location_id);
  const persistedLocation = toInt(row.location_id);

  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    role_id: row.role_id,
    location_id: persistedLocation,
    active_location_id: decodedActiveLocation || persistedLocation || null,
    role_name: roleName,
    role_code: roleName.toUpperCase()
  };
}

function resolveHeaderLocationId(req) {
  const headerValue = req.headers["x-active-location-id"];

  if (Array.isArray(headerValue)) {
    return toInt(headerValue[0]);
  }

  return toInt(headerValue);
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
    return sendError(res, error.statusCode || 500, error.message);
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, 401, "Not authorized, token missing");
  }

  const token = authHeader.split(" ")[1];
  let decoded;

  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return sendError(res, 401, "Not authorized, invalid token");
  }

  try {
    const user = await loadActiveUserById(decoded.id, decoded);

    if (!user) {
      return sendError(res, 401, "Not authorized, user not found");
    }

    req.user = user; // 

    const headerLocationId = resolveHeaderLocationId(req);
    const tokenLocationId = toInt(decoded.active_location_id);

    if (isStaff(user)) {
      user.active_location_id = user.location_id || null;
    } else {
      user.active_location_id =
        headerLocationId || tokenLocationId || toInt(user.location_id) || null;
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
