const jwt = require("jsonwebtoken");
const { loadActiveUserById } = require("../middleware/authMiddleware");
const { toInt, isStaff } = require("../utils/locationContext");

function registerNotificationSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || "";
    const handshakeLocationId = toInt(socket.handshake.auth?.active_location_id);

    if (!token || !process.env.JWT_SECRET) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await loadActiveUserById(decoded.id, decoded);

      if (!user) {
        return next(new Error("Authentication required"));
      }

      socket.user = {
        ...user,
        active_location_id: isStaff(user)
          ? toInt(user.location_id)
          : handshakeLocationId || toInt(decoded.active_location_id) || toInt(user.location_id) || null
      };
      return next();
    } catch (error) {
      return next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket) => {
    if (socket.user?.id) {
      socket.join(`user:${socket.user.id}`);
    }

    if (socket.user?.role_name) {
      socket.join(`role:${String(socket.user.role_name).trim().toLowerCase()}`);
    }

    const primaryLocationId =
      toInt(socket.user?.active_location_id) || toInt(socket.user?.location_id) || null;

    if (primaryLocationId) {
      socket.join(`location:${primaryLocationId}`);
    }
  });
}
function emitNotification(io, notification, recipients = {}) {
  const { userIds = [], roleNames = [], locationIds = [] } = recipients;

  // Send to specific users
  userIds.forEach((userId) => {
    io.to(`user:${userId}`).emit("notification", notification);
  });

  // Send to roles
  roleNames.forEach((role) => {
    io.to(`role:${String(role).toLowerCase()}`).emit("notification", notification);
  });

  // Send to locations
  locationIds.forEach((locationId) => {
    io.to(`location:${locationId}`).emit("notification", notification);
  });
}


module.exports = {
  registerNotificationSocket,
  emitNotification,
};
