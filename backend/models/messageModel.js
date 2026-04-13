const { query } = require("../config/db");

async function createMessage({ sender_id, receiver_id, subject, message }) {
  const result = await query(
    `
      WITH created AS (
        INSERT INTO messages (sender_id, receiver_id, subject, message)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      )
      SELECT
        c.id,
        c.subject,
        c.message,
        c.is_read,
        c.created_at,
        sender.id AS sender_id,
        sender.full_name AS sender_name,
        sender.location_id AS sender_location_id,
        receiver.id AS receiver_id,
        receiver.full_name AS receiver_name,
        receiver.location_id AS receiver_location_id
      FROM created c
      JOIN users sender ON sender.id = c.sender_id
      JOIN users receiver ON receiver.id = c.receiver_id
    `,
    [sender_id, receiver_id, subject || null, message]
  );

  return result.rows[0];
}

async function getMessagesForUser(userId) {
  const result = await query(
    `
      SELECT
        m.id,
        m.subject,
        m.message,
        m.is_read,
        m.created_at,
        sender.id AS sender_id,
        sender.full_name AS sender_name,
        receiver.id AS receiver_id,
        receiver.full_name AS receiver_name,
        CASE
          WHEN m.sender_id = $1 THEN 'sent'
          ELSE 'received'
        END AS message_box
      FROM messages m
      JOIN users sender ON sender.id = m.sender_id
      JOIN users receiver ON receiver.id = m.receiver_id
      WHERE m.receiver_id = $1 OR m.sender_id = $1
      ORDER BY m.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

async function markAsRead(id, userId) {
  const result = await query(
    `
      WITH updated AS (
        UPDATE messages
        SET is_read = TRUE
        WHERE id = $1 AND receiver_id = $2
        RETURNING *
      )
      SELECT
        u.id,
        u.subject,
        u.message,
        u.is_read,
        u.created_at,
        sender.id AS sender_id,
        sender.full_name AS sender_name,
        receiver.id AS receiver_id,
        receiver.full_name AS receiver_name
      FROM updated u
      JOIN users sender ON sender.id = u.sender_id
      JOIN users receiver ON receiver.id = u.receiver_id
    `,
    [id, userId]
  );

  return result.rows[0] || null;
}

module.exports = {
  createMessage,
  getMessagesForUser,
  markAsRead
};
