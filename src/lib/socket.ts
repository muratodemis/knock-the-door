"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "";
const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function getSocket(): Socket {
  if (!socket) {
    if (SOCKET_URL) {
      socket = io(SOCKET_URL, {
        autoConnect: true,
        path: `${BASE_PATH}/socket.io/`,
      });
    } else {
      socket = io({
        autoConnect: true,
        path: `${BASE_PATH}/socket.io/`,
      });
    }
  }
  return socket;
}
