"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "";

    if (socketUrl) {
      // Production: connect directly to the Railway server
      socket = io(socketUrl, {
        autoConnect: true,
        path: `${basePath}/socket.io/`,
      });
    } else {
      // Development: connect to same origin
      socket = io({
        autoConnect: true,
        path: `${basePath}/socket.io/`,
      });
    }
  }
  return socket;
}
