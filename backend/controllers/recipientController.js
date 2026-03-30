const { query } = require("../config/db");
const { asyncHandler, createHttpError, sendSuccess } = require("../utils/http");

const getRecipients = asyncHandler(async (req, res) => {
  const result = await query("SELECT * FROM recipients ORDER BY id DESC");
  return sendSuccess(res, result.rows);
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

  return sendSuccess(res, result.rows[0], {
    statusCode: 201,
    message: "Recipient created successfully"
  });
});

module.exports = {
  getRecipients,
  createRecipient
};
