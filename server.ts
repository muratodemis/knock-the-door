import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { Server as SocketIOServer } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3012", 10);

const basePath = process.env.NODE_ENV === "production" ? "/knock" : "";

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

interface KnockRequest {
  id: string;
  employeeName: string;
  message: string;
  timestamp: number;
  estimatedDuration?: number;
}

type BossStatusType = "available" | "busy" | "away" | "in-meeting";

let bossStatus: BossStatusType = "available";
const queue: KnockRequest[] = [];
let currentMeeting: {
  knockId: string;
  employeeName: string;
  startedAt: number;
  estimatedDuration: number;
} | null = null;

const DEFAULT_MEETING_DURATION = 15;

function calculateWaitTime(queueIndex: number): number {
  let totalWait = 0;

  if (currentMeeting) {
    const elapsedMin = (Date.now() - currentMeeting.startedAt) / 60000;
    const remaining = Math.max(0, currentMeeting.estimatedDuration - elapsedMin);
    totalWait += remaining;
  }

  for (let i = 0; i < queueIndex; i++) {
    totalWait += queue[i].estimatedDuration || DEFAULT_MEETING_DURATION;
  }

  return Math.round(totalWait);
}

function broadcastQueueUpdate(io: SocketIOServer) {
  queue.forEach((knock, index) => {
    io.to(`employee-${knock.id}`).emit("queue-update", {
      position: index + 1,
      totalInQueue: queue.length,
      estimatedWaitMinutes: calculateWaitTime(index),
    });
  });
}

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

    socket.emit("boss-status", bossStatus);
    if (currentMeeting) {
      socket.emit("current-meeting-info", {
        employeeName: currentMeeting.employeeName,
      });
    }

    socket.on("boss-join", () => {
      socket.join("boss-room");
      console.log("Boss joined the room");
      queue.forEach((knock, index) => {
        socket.emit("knock-received", { ...knock, queuePosition: index + 1 });
      });
      if (currentMeeting) {
        socket.emit("current-meeting-info", {
          employeeName: currentMeeting.employeeName,
          knockId: currentMeeting.knockId,
          startedAt: currentMeeting.startedAt,
          estimatedDuration: currentMeeting.estimatedDuration,
        });
      }
    });

    socket.on("employee-join", (employeeId: string) => {
      socket.join(`employee-${employeeId}`);
      socket.emit("boss-status", bossStatus);
      const queueIndex = queue.findIndex((k) => k.id === employeeId);
      if (queueIndex !== -1) {
        socket.emit("queue-update", {
          position: queueIndex + 1,
          totalInQueue: queue.length,
          estimatedWaitMinutes: calculateWaitTime(queueIndex),
        });
      }
      if (currentMeeting) {
        socket.emit("current-meeting-info", {
          employeeName: currentMeeting.employeeName,
        });
      }
      console.log(`Employee ${employeeId} joined`);
    });

    socket.on("boss-status-change", (status: BossStatusType) => {
      if (status === "in-meeting") return;
      bossStatus = status;
      if (status !== "busy" && status !== "away") {
        // If boss goes available, clear meeting tracking
      }
      io.emit("boss-status", bossStatus);
      console.log(`Boss status changed to: ${status}`);
    });

    socket.on("knock", (data: KnockRequest) => {
      console.log(`Knock from ${data.employeeName}: ${data.message}`);
      queue.push(data);
      const position = queue.length;
      io.to("boss-room").emit("knock-received", { ...data, queuePosition: position });
      socket.emit("knock-sent", { id: data.id, status: "waiting" });
      broadcastQueueUpdate(io);
    });

    socket.on("open-door", (data: { knockId: string; meetLink: string }) => {
      const knockIndex = queue.findIndex((k) => k.id === data.knockId);
      if (knockIndex !== -1) {
        const knock = queue[knockIndex];
        queue.splice(knockIndex, 1);

        currentMeeting = {
          knockId: data.knockId,
          employeeName: knock.employeeName,
          startedAt: Date.now(),
          estimatedDuration: knock.estimatedDuration || DEFAULT_MEETING_DURATION,
        };

        bossStatus = "in-meeting";
        io.emit("boss-status", bossStatus);
        io.emit("current-meeting-info", {
          employeeName: currentMeeting.employeeName,
        });

        io.to(`employee-${data.knockId}`).emit("door-opened", {
          meetLink: data.meetLink,
        });

        socket.emit("door-opened-confirm", {
          knockId: data.knockId,
          meetLink: data.meetLink,
          employeeName: knock.employeeName,
        });

        broadcastQueueUpdate(io);
        console.log(`Door opened for ${knock.employeeName}, meet link: ${data.meetLink}`);
      }
    });

    socket.on("decline-knock", (knockId: string) => {
      const knockIndex = queue.findIndex((k) => k.id === knockId);
      if (knockIndex !== -1) {
        const knock = queue[knockIndex];
        queue.splice(knockIndex, 1);
        io.to(`employee-${knockId}`).emit("knock-declined", {
          message: "Yönetici şu an görüşme yapamıyor. Lütfen daha sonra tekrar deneyin.",
        });
        broadcastQueueUpdate(io);
        console.log(`Knock declined for ${knock.employeeName}`);
      }
    });

    socket.on("meeting-ended", () => {
      currentMeeting = null;
      bossStatus = "available";
      io.emit("boss-status", bossStatus);
      io.emit("current-meeting-info", null);
      broadcastQueueUpdate(io);
      console.log("Meeting ended, boss is available again");
    });

    socket.on("boss-chat", (data: { knockId: string; text: string }) => {
      io.to(`employee-${data.knockId}`).emit("chat-message", {
        from: "boss",
        text: data.text,
        timestamp: Date.now(),
      });
      socket.emit("chat-message", {
        knockId: data.knockId,
        from: "boss",
        text: data.text,
        timestamp: Date.now(),
      });
      console.log(`Boss -> Employee ${data.knockId}: ${data.text}`);
    });

    socket.on("employee-chat", (data: { knockId: string; text: string }) => {
      io.to("boss-room").emit("chat-message", {
        knockId: data.knockId,
        from: "employee",
        text: data.text,
        timestamp: Date.now(),
      });
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
