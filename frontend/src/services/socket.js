import { io } from "socket.io-client";
import { API_ORIGIN } from "./api";

let socket;

function getActiveLocationId() {
  const raw = localStorage.getItem("inventory-active-location-id");
  return raw && /^\d+$/.test(String(raw)) ? String(raw) : "";
}

function buildSocketAuth() {
  return {
    token: localStorage.getItem("token") || "",
    active_location_id: getActiveLocationId()
  };
}

export function getSocket() {
  if (!socket) {
    socket = io(API_ORIGIN || undefined, {
      autoConnect: false,
      auth: buildSocketAuth()
    });
  }

  socket.auth = buildSocketAuth();

  if (!socket.connected) {
    socket.connect();
  }

  return socket;
}

export function refreshSocketAuth() {
  if (!socket) {
    return;
  }

  socket.auth = buildSocketAuth();
  if (socket.connected) {
    socket.disconnect();
    socket.connect();
  }
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
  }
}
