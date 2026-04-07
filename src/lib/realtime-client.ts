import { io, type Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getRealtimeSocket() {
  if (typeof window === "undefined") {
    return null;
  }

  if (socket) {
    return socket;
  }

  socket = io({
    path: "/socket.io",
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    timeout: 10000,
    withCredentials: true,
  });

  return socket;
}
