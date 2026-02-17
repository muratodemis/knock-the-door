"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
    socket = io({
      autoConnect: true,
      path: `${basePath}/socket.io/`,
    });
  }
  return socket;
}
