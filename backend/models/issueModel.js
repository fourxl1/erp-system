const { query } = require("../config/db");

async function createIssue({ user_id, title, description, related_report, created_at }) {
  const result = await query(
    `
      INSERT INTO issues (user_id, title, description, related_report, created_at)
      VALUES ($1, $2, $3, $4, COALESCE($5, NOW()))
      RETURNING *
    `,
    [user_id, title, description, related_report || null, created_at || null]
  );

  return result.rows[0];
}

module.exports = {
  createIssue
};
