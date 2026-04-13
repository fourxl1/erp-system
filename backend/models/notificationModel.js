const { query } = require("../config/db");

function getExecutor(client) {
  return client || { query };
}

async function createNotification(entry, options = {}) {
  const executor = getExecutor(options.client);
  const result = await executor.query(
    `
      INSERT INTO notifications (
        type,
        event_type,
        reference_id,
        title,
        message,
        is_read,
        user_id,
        location_id
      )
      VALUES (
        $1::TEXT,
        $2::TEXT,
        $3::BIGINT,
        $4::TEXT,
        $5::TEXT,
        COALESCE($6::BOOLEAN, FALSE),
        $7::BIGINT,
        $8::BIGINT
      )
      RETURNING *
    `,
    [
      entry.type,
      entry.event_type,
      entry.reference_id || null,
      entry.title,
      entry.message,
      entry.is_read ?? false,
      entry.user_id || null,
      entry.location_id || null
    ]
  );

  return result.rows[0];
}

async function listNotifications(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`(n.user_id = $${values.length}::BIGINT OR n.user_id IS NULL)`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`(n.location_id = $${values.length}::BIGINT OR n.location_id IS NULL)`);
  }

  if (filters.type) {
    values.push(String(filters.type).toUpperCase());
    conditions.push(`n.type = $${values.length}::TEXT`);
  }

  if (typeof filters.isRead === "boolean") {
    values.push(filters.isRead);
    conditions.push(`n.is_read = $${values.length}::BOOLEAN`);
  }

  const limit = Number(filters.limit || 50);
  const offset = Number(filters.offset || 0);
  values.push(Math.min(Math.max(limit, 1), 200));
  values.push(Math.max(offset, 0));

  const result = await query(
    `
      SELECT
        n.id,
        n.type,
        n.event_type,
        n.reference_id,
        n.title,
        n.message,
        n.is_read,
        n.user_id,
        n.location_id,
        n.created_at
      FROM notifications n
      WHERE ${conditions.join(" AND ")}
      ORDER BY n.created_at DESC
      LIMIT $${values.length - 1}::INT
      OFFSET $${values.length}::INT
    `,
    values
  );

  return result.rows;
}

async function setNotificationReadState(id, isRead, filters = {}) {
  const conditions = ["id = $1::BIGINT"];
  const values = [id, Boolean(isRead)];

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`(user_id = $${values.length}::BIGINT OR user_id IS NULL)`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`(location_id = $${values.length}::BIGINT OR location_id IS NULL)`);
  }

  const result = await query(
    `
      UPDATE notifications
      SET is_read = $2::BOOLEAN
      WHERE ${conditions.join(" AND ")}
      RETURNING *
    `,
    values
  );

  return result.rows[0] || null;
}

async function markNotificationRead(id, filters = {}) {
  return setNotificationReadState(id, true, filters);
}

async function markAllNotificationsRead(filters = {}) {
  const conditions = ["1 = 1"];
  const values = [];

  if (filters.userId) {
    values.push(filters.userId);
    conditions.push(`(user_id = $${values.length}::BIGINT OR user_id IS NULL)`);
  }

  if (filters.locationId) {
    values.push(filters.locationId);
    conditions.push(`(location_id = $${values.length}::BIGINT OR location_id IS NULL)`);
  }

  if (filters.type) {
    values.push(String(filters.type).toUpperCase());
    conditions.push(`type = $${values.length}::TEXT`);
  }

  const result = await query(
    `
      UPDATE notifications
      SET is_read = TRUE
      WHERE ${conditions.join(" AND ")}
        AND is_read = FALSE
      RETURNING id
    `,
    values
  );

  return result.rowCount;
}

module.exports = {
  createNotification,
  listNotifications,
  setNotificationReadState,
  markNotificationRead,
  markAllNotificationsRead
};
