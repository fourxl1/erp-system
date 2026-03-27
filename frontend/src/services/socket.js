import { io } from "socket.io-client";

let socket;

function resolveSocketUrl() {
  const configured = import.meta.env.VITE_SOCKET_URL?.trim();

  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

  if (apiBaseUrl) {
    return apiBaseUrl.replace(/\/api\/?$/, "").replace(/\/+$/, "");
  }

  return `http://${window.location.hostname}:5000`;
}

export function getSocket() {
  if (!socket) {
    socket = io(resolveSocketUrl(), {
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
