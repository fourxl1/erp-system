const messageModel = require("../models/messageModel");
const { query } = require("../config/db");
const notificationService = require("./notificationService");

function buildError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function sendMessage(payload, user) {
  if (Number(payload.receiver_id) === Number(user.id)) {
    throw buildError("You cannot send a message to yourself");
  }

  const receiver = await query(
    `
      SELECT id
      FROM users
      WHERE id = $1 AND COALESCE(is_active, TRUE) = TRUE
    `,
    [payload.receiver_id]
  );

  if (!receiver.rows[0]) {
    throw buildError("Receiver not found", 404);
  }

  const message = await messageModel.createMessage({
    sender_id: user.id,
    receiver_id: payload.receiver_id,
    subject: payload.subject || null,
    message: payload.message
  });

  await notificationService.notifyNewMessage(message);
  return message;
}

async function getInbox(user) {
  return messageModel.getMessagesForUser(user.id);
}

async function listMessageUsers(user) {
  const values = [user.id];
  const conditions = ["u.id <> $1", "COALESCE(u.is_active, TRUE) = TRUE"];

  if (user.role_code === "STAFF" && user.location_id) {
    values.push(user.location_id);
    conditions.push(`(u.location_id = $${values.length} OR LOWER(r.name) IN ('admin', 'superadmin'))`);
  }

  const result = await query(
    `
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.location_id,
        COALESCE(r.name, '') AS role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY u.full_name
    `,
    values
  );

  return result.rows;
}

async function markMessageAsRead(id, user) {
  const message = await messageModel.markAsRead(id, user.id);

  if (!message) {
    throw buildError("Message not found", 404);
  }

  return message;
}

module.exports = {
  sendMessage,
  getInbox,
  listMessageUsers,
  markMessageAsRead
};
