const { query } = require("../config/db");
const notificationModel = require("../models/notificationModel");
const { getSocketServer } = require("../sockets");
const {
  buildError,
  isAdmin,
  isStaff,
  isSuperAdmin,
  resolveReadLocation,
  resolveUserActiveLocation
} = require("../utils/locationContext");

const NOTIFICATION_TYPES = new Set(["REQUEST", "MESSAGE", "TRANSFER"]);
const EVENT_TYPES = new Set(["CREATED", "UPDATED", "CONFIRMED", "REJECTED"]);

function uniqueIds(values = []) {
  return [...new Set((values || []).map((entry) => Number(entry)).filter(Boolean))];
}

function normalizeType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return NOTIFICATION_TYPES.has(normalized) ? normalized : null;
}

function normalizeEventType(value) {
  const normalized = String(value || "").trim().toUpperCase();
  return EVENT_TYPES.has(normalized) ? normalized : null;
}

function emitRealtime(payload, recipients = {}) {
  const io = getSocketServer();

  if (!io) {
    return;
  }

  const { userIds = [], locationIds = [] } = recipients;

  uniqueIds(userIds).forEach((userId) => {
    io.to(`user:${userId}`).emit("notification", payload);
  });

  uniqueIds(locationIds).forEach((locationId) => {
    io.to(`location:${locationId}`).emit("notification", payload);
  });
}

function toRealtimePayload(notification) {
  return {
    id: notification.id,
    type: notification.type,
    event_type: notification.event_type,
    reference_id: notification.reference_id || null,
    title: notification.title,
    message: notification.message,
    is_read: Boolean(notification.is_read),
    user_id: notification.user_id || null,
    location_id: notification.location_id || null,
    created_at: notification.created_at
  };
}

async function getUserIdsByRole(roleNames = [], locationId = null) {
  if (!Array.isArray(roleNames) || roleNames.length === 0) {
    return [];
  }

  const normalizedRoles = roleNames.map((role) => String(role).toLowerCase());
  const values = [normalizedRoles];
  const conditions = ["LOWER(r.name) = ANY($1::text[])", "COALESCE(u.is_active, TRUE) = TRUE"];

  if (locationId) {
    values.push(locationId);
    conditions.push(`u.location_id = $${values.length}::BIGINT`);
  }

  const result = await query(
    `
      SELECT u.id
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE ${conditions.join(" AND ")}
    `,
    values
  );

  return result.rows.map((row) => Number(row.id));
}

async function createAndDispatch(entry, targets = {}) {
  const type = normalizeType(entry.type);
  const eventType = normalizeEventType(entry.event_type);

  if (!type || !eventType) {
    throw buildError("Invalid notification type or event_type", 400);
  }

  const locationId = Number(entry.location_id) || null;
  const userIds = uniqueIds(targets.userIds || []);
  const locationTargets = uniqueIds(targets.locationIds || (locationId ? [locationId] : []));
  const persisted = [];

  if (userIds.length > 0) {
    for (const userId of userIds) {
      const created = await notificationModel.createNotification({
        ...entry,
        type,
        event_type: eventType,
        user_id: userId,
        location_id: locationId
      });
      persisted.push(created);
      emitRealtime(toRealtimePayload(created), { userIds: [userId] });
    }
    return persisted;
  }

  if (locationTargets.length > 0) {
    for (const targetLocationId of locationTargets) {
      const created = await notificationModel.createNotification({
        ...entry,
        type,
        event_type: eventType,
        user_id: null,
        location_id: targetLocationId
      });
      persisted.push(created);
      emitRealtime(toRealtimePayload(created), { locationIds: [targetLocationId] });
    }
    return persisted;
  }

  if (locationId) {
    const created = await notificationModel.createNotification({
      ...entry,
      type,
      event_type: eventType,
      user_id: null,
      location_id: locationId
    });
    persisted.push(created);
    emitRealtime(toRealtimePayload(created), { locationIds: [locationId] });
    return persisted;
  }

  persisted.push(
    await notificationModel.createNotification({
      ...entry,
      type,
      event_type: eventType,
      user_id: null,
      location_id: null
    })
  );

  return persisted;
}

async function listNotifications(user, filters = {}) {
  const type = filters.type ? normalizeType(filters.type) : null;
  const isRead =
    filters.is_read === undefined || filters.is_read === null || filters.is_read === ""
      ? undefined
      : String(filters.is_read).toLowerCase() === "true";
  const locationId = resolveReadLocation(user, filters.location_id);

  return notificationModel.listNotifications({
    userId: user.id,
    locationId,
    type,
    isRead,
    limit: filters.limit,
    offset: filters.offset
  });
}

async function markNotificationAsRead(id, user, isRead = true) {
  const locationId = resolveReadLocation(user, null);
  const notification = await notificationModel.setNotificationReadState(id, isRead, {
    userId: user.id,
    locationId
  });

  if (!notification) {
    throw buildError("Notification not found", 404);
  }

  return notification;
}

async function markAllAsRead(user, type = null) {
  const locationId = resolveReadLocation(user, null);
  const normalizedType = type ? normalizeType(type) : null;

  if (type && !normalizedType) {
    throw buildError("Invalid notification type", 400);
  }

  return notificationModel.markAllNotificationsRead({
    userId: user.id,
    locationId,
    type: normalizedType
  });
}

async function notifyMessageCreated(message) {
  await createAndDispatch(
    {
      type: "MESSAGE",
      event_type: "CREATED",
      reference_id: message.id,
      title: message.subject || "New message",
      message: `New message from ${message.sender_name}`,
      location_id: message.receiver_location_id || null
    },
    {
      userIds: [message.receiver_id],
      locationIds: [message.receiver_location_id]
    }
  );
}

async function notifyRequestCreated(request) {
  const adminIds = await getUserIdsByRole(["Admin"], request.source_location_id || null);
  const superAdminIds = await getUserIdsByRole(["SuperAdmin"]);

  await createAndDispatch(
    {
      type: "REQUEST",
      event_type: "CREATED",
      reference_id: request.id,
      title: "New request submitted",
      message: `${request.requester_name || "A user"} submitted ${request.request_number}`,
      location_id: request.source_location_id || request.location_id || null
    },
    {
      userIds: [...adminIds, ...superAdminIds],
      locationIds: [request.source_location_id || request.location_id]
    }
  );
}

async function notifyRequestUpdated(request, eventType) {
  const normalizedEvent = normalizeEventType(eventType) || "UPDATED";
  const titleMap = {
    UPDATED: "Request updated",
    CONFIRMED: "Request approved",
    REJECTED: "Request rejected"
  };

  await createAndDispatch(
    {
      type: "REQUEST",
      event_type: normalizedEvent,
      reference_id: request.id,
      title: titleMap[normalizedEvent] || "Request updated",
      message: `${request.request_number} is now ${request.status}`,
      location_id: request.location_id || null
    },
    {
      userIds: [request.requester_id],
      locationIds: [request.location_id]
    }
  );
}

async function notifyTransferCreated(transfer, sourceName = "Source", destinationName = "Destination") {
  const adminIds = await getUserIdsByRole(["Admin"], transfer.destination_location_id);
  const superAdminIds = await getUserIdsByRole(["SuperAdmin"]);

  await createAndDispatch(
    {
      type: "TRANSFER",
      event_type: "CREATED",
      reference_id: transfer.id,
      title: `New transfer from ${sourceName}`,
      message: `Transfer ${transfer.reference || `#${transfer.id}`} is waiting for receipt in ${destinationName}`,
      location_id: transfer.destination_location_id
    },
    {
      userIds: [...adminIds, ...superAdminIds],
      locationIds: [transfer.destination_location_id]
    }
  );
}

async function notifyTransferConfirmed(transfer, sourceName = "Source", destinationName = "Destination") {
  const sourceAdmins = await getUserIdsByRole(["Admin"], transfer.source_location_id);
  const superAdminIds = await getUserIdsByRole(["SuperAdmin"]);

  await createAndDispatch(
    {
      type: "TRANSFER",
      event_type: "CONFIRMED",
      reference_id: transfer.id,
      title: `Transfer received in ${destinationName}`,
      message: `Transfer ${transfer.reference || `#${transfer.id}`} from ${sourceName} has been received`,
      location_id: transfer.source_location_id
    },
    {
      userIds: [...sourceAdmins, ...superAdminIds, transfer.created_by],
      locationIds: [transfer.source_location_id]
    }
  );
}

async function notifyTransferRejected(transfer, sourceName = "Source", destinationName = "Destination") {
  const sourceAdmins = await getUserIdsByRole(["Admin"], transfer.source_location_id);
  const superAdminIds = await getUserIdsByRole(["SuperAdmin"]);

  await createAndDispatch(
    {
      type: "TRANSFER",
      event_type: "REJECTED",
      reference_id: transfer.id,
      title: `Transfer rejected in ${destinationName}`,
      message: `Transfer ${transfer.reference || `#${transfer.id}`} from ${sourceName} was rejected`,
      location_id: transfer.source_location_id
    },
    {
      userIds: [...sourceAdmins, ...superAdminIds, transfer.created_by],
      locationIds: [transfer.source_location_id]
    }
  );
}

function getResolvedLocationForUser(user) {
  if (isStaff(user) || isAdmin(user) || isSuperAdmin(user)) {
    return resolveUserActiveLocation(user);
  }

  return null;
}

module.exports = {
  listNotifications,
  markNotificationAsRead,
  markAllAsRead,
  notifyMessageCreated,
  notifyRequestCreated,
  notifyRequestUpdated,
  notifyTransferCreated,
  notifyTransferConfirmed,
  notifyTransferRejected,
  createAndDispatch,
  getResolvedLocationForUser
};
