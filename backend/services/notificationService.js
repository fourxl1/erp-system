const { query } = require("../config/db");
const { getSocketServer } = require("../sockets");

let hasLoggedMissingNotificationsTable = false;

function isMissingNotificationsTable(error) {
  return error && error.code === "42P01";
}

async function createNotification({ userId, title, message, type }) {
  if (!userId) {
    return null;
  }

  try {
    const result = await query(
      `
        INSERT INTO notifications (user_id, title, message, type)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `,
      [userId, title, message, type]
    );

    return result.rows[0];
  } catch (error) {
    if (isMissingNotificationsTable(error)) {
      if (!hasLoggedMissingNotificationsTable) {
        hasLoggedMissingNotificationsTable = true;
        console.warn(
          "Notifications table is missing. Skipping notification persistence until the database migration is applied."
        );
      }

      return null;
    }

    throw error;
  }
}

async function emitToUsers(userIds, eventName, payload) {
  const io = getSocketServer();

  if (!io) {
    return;
  }

  [...new Set((userIds || []).map((value) => Number(value)).filter(Boolean))].forEach((userId) => {
    io.to(`user:${userId}`).emit(eventName, payload);
  });
}

async function notifyUsers(userIds, eventName, payload, notificationFactory) {
  const uniqueUserIds = [...new Set((userIds || []).map((value) => Number(value)).filter(Boolean))];

  for (const userId of uniqueUserIds) {
    if (notificationFactory) {
      const notification = notificationFactory(userId);

      if (notification) {
        try {
          await createNotification({
            userId,
            title: notification.title,
            message: notification.message,
            type: notification.type
          });
        } catch (error) {
          console.error("Failed to persist notification:", error.message);
        }
      }
    }
  }

  await emitToUsers(uniqueUserIds, eventName, payload);
}

async function getActiveUsersByRoles(roleNames, locationId = null) {
  const values = [roleNames];
  const conditions = ["LOWER(r.name) = ANY($1::text[])", "COALESCE(u.is_active, TRUE) = TRUE"];

  if (locationId) {
    values.push(locationId);
    conditions.push(`u.location_id = $${values.length}`);
  }

  const result = await query(
    `
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE ${conditions.join(" AND ")}
    `,
    values.map((value, index) => (index === 0 ? roleNames.map((role) => String(role).toLowerCase()) : value))
  );

  return result.rows.map((row) => Number(row.id));
}

async function notifyNewMessage(message) {
  await notifyUsers(
    [message.receiver_id],
    "new_message",
    {
      id: message.id,
      sender_id: message.sender_id,
      sender_name: message.sender_name,
      receiver_id: message.receiver_id,
      receiver_name: message.receiver_name,
      subject: message.subject,
      message: message.message,
      created_at: message.created_at
    },
    () => ({
      title: message.subject || "New message",
      message: `New message from ${message.sender_name}`,
      type: "new_message"
    })
  );
}

async function notifyStockRequestCreated(request) {
  const approverIds = await getActiveUsersByRoles(["Admin"], request.source_location_id);
  const superAdminIds = await getActiveUsersByRoles(["SuperAdmin"]);

  await notifyUsers(
    [...approverIds, ...superAdminIds],
    "stock_request_created",
    request,
    () => ({
      title: "Stock request created",
      message: `${request.requester_name || "A user"} created ${request.request_number}`,
      type: "stock_request_created"
    })
  );
}

async function notifyStockRequestStatus(request, eventName) {
  const title = eventName === "stock_request_approved" ? "Stock request approved" : "Stock request rejected";
  const type = eventName;

  await notifyUsers(
    [request.requester_id],
    eventName,
    request,
    () => ({
      title,
      message: `${request.request_number} is now ${request.status}`,
      type
    })
  );
}

async function ensureLowStockAlert(itemId, locationId) {
  const state = await query(
    `
      SELECT
        i.id AS item_id,
        i.name AS item_name,
        i.reorder_level,
        COALESCE(b.quantity, 0) AS current_quantity,
        l.name AS location_name
      FROM items i
      JOIN inventory_balance b ON b.item_id = i.id AND b.location_id = $2
      JOIN locations l ON l.id = b.location_id
      WHERE i.id = $1
    `,
    [itemId, locationId]
  );

  const current = state.rows[0];

  if (!current) {
    return null;
  }

  if (Number(current.current_quantity) > Number(current.reorder_level || 0)) {
    return null;
  }

  const title = `Low stock: ${current.item_name}`;
  const message = `${current.item_name} is low at ${current.location_name}. Current quantity: ${current.current_quantity}.`;

  await query(
    `
      INSERT INTO alerts (user_id, location_id, alert_type, title, message)
      SELECT NULL, $1, 'LOW_STOCK', $2, $3
      WHERE NOT EXISTS (
        SELECT 1
        FROM alerts
        WHERE location_id = $1
          AND alert_type = 'LOW_STOCK'
          AND title = $2
          AND is_read = FALSE
      )
    `,
    [locationId, title, message]
  );

  const adminIds = await getActiveUsersByRoles(["Admin"], locationId);
  const superAdminIds = await getActiveUsersByRoles(["SuperAdmin"]);

  await notifyUsers(
    [...adminIds, ...superAdminIds],
    "low_stock_alert",
    {
      item_id: current.item_id,
      item_name: current.item_name,
      location_id: Number(locationId),
      location_name: current.location_name,
      current_quantity: Number(current.current_quantity),
      reorder_level: Number(current.reorder_level || 0)
    },
    () => ({
      title,
      message,
      type: "low_stock_alert"
    })
  );

  return current;
}

module.exports = {
  notifyNewMessage,
  notifyStockRequestCreated,
  notifyStockRequestStatus,
  ensureLowStockAlert
};
