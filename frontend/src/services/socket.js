import { io } from "socket.io-client";

let socket;

export function getSocket() {
  if (!socket) {
    socket = io({
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
