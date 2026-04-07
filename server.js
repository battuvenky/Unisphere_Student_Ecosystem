const { createServer } = require("node:http");
const next = require("next");
const { Server } = require("socket.io");

const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = Number(process.env.PORT || 3400);
const isProduction = process.argv.includes("--prod");
const dev = !isProduction;

if (isProduction) {
  process.env.NODE_ENV = "production";
} else if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = "development";
}

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

function userRoom(userId) {
  return `user:${userId}`;
}

app
  .prepare()
  .then(() => {
    const httpServer = createServer((req, res) => {
      void handle(req, res);
    });

    const io = new Server(httpServer, {
      path: "/socket.io",
      cors: {
        origin: true,
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      socket.emit("realtime:ready", { connectedAt: Date.now() });

      socket.on("user:join", (payload) => {
        const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";

        if (!userId) {
          return;
        }

        socket.join(userRoom(userId));
      });

      socket.on("connections:typing", (payload) => {
        const fromUserId = typeof payload?.fromUserId === "string" ? payload.fromUserId.trim() : "";
        const toUserId = typeof payload?.toUserId === "string" ? payload.toUserId.trim() : "";
        const conversationId =
          typeof payload?.conversationId === "string" ? payload.conversationId.trim() : "";
        const isTyping = Boolean(payload?.isTyping);

        if (!fromUserId || !toUserId) {
          return;
        }

        io.to(userRoom(toUserId)).emit("connections:typing", {
          fromUserId,
          toUserId,
          conversationId,
          isTyping,
          at: Date.now(),
        });
      });
    });

    globalThis.__unisphere_io = io;

    httpServer.listen(port, hostname, () => {
      const mode = dev ? "dev" : "prod";
      console.log(`[unisphere] ${mode} server ready on http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    console.error("Failed to start UniSphere server", error);
    process.exit(1);
  });
