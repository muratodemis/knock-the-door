import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3012", 10);

const basePath = process.env.BASE_PATH || "";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface KnockRequest {
  id: string;
  employeeName: string;
  message: string;
  timestamp: number;
}

let bossStatus: "available" | "busy" | "away" = "available";
const pendingKnocks: Map<string, KnockRequest> = new Map();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  const io = new SocketIOServer(httpServer, {
    cors: { origin: "*" },
    path: `${basePath}/socket.io/`,
  });

  io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Send current boss status to new connections
    socket.emit("boss-status", bossStatus);

    // Boss joins their room
    socket.on("boss-join", () => {
      socket.join("boss-room");
      console.log("Boss joined the room");
      // Send any pending knocks
      pendingKnocks.forEach((knock) => {
        socket.emit("knock-received", knock);
      });
    });

    // Employee joins their room
    socket.on("employee-join", (employeeId: string) => {
      socket.join(`employee-${employeeId}`);
      socket.emit("boss-status", bossStatus);
      console.log(`Employee ${employeeId} joined`);
    });

    // Boss changes status
    socket.on("boss-status-change", (status: "available" | "busy" | "away") => {
      bossStatus = status;
      io.emit("boss-status", bossStatus);
      console.log(`Boss status changed to: ${status}`);
    });

    // Employee knocks on the door
    socket.on("knock", (data: KnockRequest) => {
      console.log(`Knock from ${data.employeeName}: ${data.message}`);
      pendingKnocks.set(data.id, data);
      io.to("boss-room").emit("knock-received", data);
      socket.emit("knock-sent", { id: data.id, status: "waiting" });
    });

    // Boss opens the door (accepts knock)
    socket.on("open-door", (data: { knockId: string; meetLink: string }) => {
      const knock = pendingKnocks.get(data.knockId);
      if (knock) {
        pendingKnocks.delete(data.knockId);
        // Send meet link to the specific employee
        io.to(`employee-${data.knockId}`).emit("door-opened", {
          meetLink: data.meetLink,
        });
        // Notify boss as well
        socket.emit("door-opened-confirm", {
          knockId: data.knockId,
          meetLink: data.meetLink,
          employeeName: knock.employeeName,
        });
        console.log(`Door opened for ${knock.employeeName}, meet link: ${data.meetLink}`);
      }
    });

    // Boss declines the knock
    socket.on("decline-knock", (knockId: string) => {
      const knock = pendingKnocks.get(knockId);
      if (knock) {
        pendingKnocks.delete(knockId);
        io.to(`employee-${knockId}`).emit("knock-declined", {
          message: "Yönetici şu an görüşme yapamıyor. Lütfen daha sonra tekrar deneyin.",
        });
        console.log(`Knock declined for ${knock.employeeName}`);
      }
    });

    // Chat: Boss sends message to employee
    socket.on("boss-chat", (data: { knockId: string; text: string }) => {
      io.to(`employee-${data.knockId}`).emit("chat-message", {
        from: "boss",
        text: data.text,
        timestamp: Date.now(),
      });
      // Echo back to boss too so it appears in their chat
      socket.emit("chat-message", {
        knockId: data.knockId,
        from: "boss",
        text: data.text,
        timestamp: Date.now(),
      });
      console.log(`Boss -> Employee ${data.knockId}: ${data.text}`);
    });

    // Chat: Employee sends message to boss
    socket.on("employee-chat", (data: { knockId: string; text: string }) => {
      io.to("boss-room").emit("chat-message", {
        knockId: data.knockId,
        from: "employee",
        text: data.text,
        timestamp: Date.now(),
      });
      // Echo back to employee too
      socket.emit("chat-message", {
        from: "employee",
        text: data.text,
        timestamp: Date.now(),
      });
      console.log(`Employee ${data.knockId} -> Boss: ${data.text}`);
    });

    socket.on("disconnect", () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Knock The Door running at http://${hostname}:${port}`);
    console.log(`> Boss panel:     http://${hostname}:${port}/boss`);
    console.log(`> Employee door:  http://${hostname}:${port}/employee`);
  });
});
