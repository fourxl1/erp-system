const { query } = require("../config/db");
const { asyncHandler, createHttpError } = require("../utils/http");

const getRecipients = asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM recipients ORDER BY id DESC");

  return res.json({
    success: true,
    data: result.rows
  });
});

const createRecipient = asyncHandler(async (req, res) => {
  const { name, department } = req.body;

  if (!name) {
    throw createHttpError(400, "Name is required");
  }

  const result = await query(
    `
      INSERT INTO recipients (name, department)
      VALUES ($1, $2)
      RETURNING *
    `,
    [name, department]
  );

  return res.status(201).json({
    success: true,
    data: result.rows[0]
  });
});

module.exports = {
  getRecipients,
  createRecipient
};
