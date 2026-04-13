const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../config/db");
const { asyncHandler, createHttpError, sendSuccess } = require("../utils/http");

function buildToken(user) {
  if (!process.env.JWT_SECRET) {
    throw createHttpError(500, "JWT_SECRET is not configured");
  }

  return jwt.sign(
    {
      id: user.id,
      role_id: user.role_id,
      role_name: user.role_name || "",
      location_id: user.location_id || null,
      active_location_id: user.location_id || null
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
}

const loginUser = asyncHandler(async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  if (!email || !password) {
    throw createHttpError(400, "Email and password are required");
  }

  const userResult = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.password,
        u.role_id,
        (to_jsonb(u) ->> 'location_id')::bigint AS location_id,
        COALESCE(r.name, '') AS role_name,
        COALESCE((to_jsonb(u) ->> 'is_active')::boolean, TRUE) AS is_active
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1
    `,
    [email]
  );

  const user = userResult.rows[0];

  if (!user || user.is_active === false) {
    throw createHttpError(401, "Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw createHttpError(401, "Invalid credentials");
  }

  const token = buildToken(user);

  return sendSuccess(
    res,
    {
      token,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
        location_id: user.location_id,
        active_location_id: user.location_id
      }
    },
    {
      message: "Login successful"
    }
  );
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return sendSuccess(res, {
    user: req.user
  });
});

module.exports = {
  loginUser,
  getCurrentUser
};
