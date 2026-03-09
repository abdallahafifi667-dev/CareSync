const { Server } = require("socket.io");

let io;
const adminSockets = new Set();

const setupSocket = (server) => {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ];

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`New socket connection: ${socket.id}`);

    socket.on("register_admin", () => {
      adminSockets.add(socket.id);
      console.log(`Admin registered: ${socket.id}`);
    });

    socket.on("disconnect", (reason) => {
      adminSockets.delete(socket.id);
      console.log(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
    });
  });
};

const getIo = () => {
  if (!io) {
    throw new Error(
      "Socket.io has not been initialized. Call setupSocket() first.",
    );
  }
  return io;
};

module.exports = {
  setupSocket,
  getIo,
  adminSockets,
};
