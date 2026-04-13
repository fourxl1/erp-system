const { Server } = require("socket.io");
const { registerNotificationSocket } = require("./notificationSocket");
const { getAllowedOrigins, isAllowedOrigin } = require("../utils/originPolicy");

let ioInstance = null;

function initializeSocketServer(server) {
  const allowedOrigins = getAllowedOrigins();
  const io = new Server(server, {
    cors: {
      origin(origin, callback) {
        if (isAllowedOrigin(origin, allowedOrigins)) {
          return callback(null, true);
        }

        return callback(new Error("Origin not allowed by CORS"));
      },
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
      credentials: true
    }
  });

  registerNotificationSocket(io);
  ioInstance = io;
  return io;
}

module.exports = {
  initializeSocketServer,
  getSocketServer() {
    return ioInstance;
  }
};
