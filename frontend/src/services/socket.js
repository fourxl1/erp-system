import { io } from "socket.io-client";

let socket;
const SOCKET_URL = "http://161.35.213.198:5000";

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: {
        token: localStorage.getItem("token") || ""
      }
    });
  }

  socket.auth = {
    token: localStorage.getItem("token") || ""
  };

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
