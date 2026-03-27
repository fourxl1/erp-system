const jwt = require("jsonwebtoken");
const { loadActiveUserById } = require("../middleware/authMiddleware");

function registerNotificationSocket(io) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token || "";

    if (!token || !process.env.JWT_SECRET) {
      return next(new Error("Authentication required"));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await loadActiveUserById(decoded.id, decoded);

      if (!user) {
        return next(new Error("Authentication required"));
      }

      socket.user = user;
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
  });
}

module.exports = registerNotificationSocket;
