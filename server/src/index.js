
const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

// 1. Create Express application
const app = express();

// Allow our local React frontend
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173"
];

app.use(cors({
  origin: allowedOrigins
}));

app.use(express.json());

// 2. Create an HTTP server
const httpServer = http.createServer(app);

// 3. Attach Socket.IO to the HTTP server
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"]
  }
});

// 4. Basic health-check route
app.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "ScribbleLAN server is running!"
  });
});

// 5. Handle new Socket.IO connections
io.on("connection", (socket) => {

  console.log("\nNew client connected!");
  console.log("Socket ID:", socket.id);

  // Send a welcome message to the client
  socket.emit("SERVER_WELCOME", {
    message: "Successfully connected to ScribbleLAN server!",
    serverTime: new Date().toISOString()
  });

  // 6. Handle test messages from the client
  socket.on("CLIENT_PING", (payload, callback) => {

    console.log("Ping received from:", socket.id);

    // Acknowledge the client's message
    if (typeof callback === "function") {
      callback({
        success: true,
        receivedAt: Date.now(),
        originalTimestamp: payload?.sentAt ?? null
      });
    }
  });

  // 7. Handle client disconnection
  socket.on("disconnect", (reason) => {
    console.log("Client disconnected:", socket.id);
    console.log("Reason:", reason);
  });

});

// 8. Start the server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------");
  console.log("       SCRIBBLELAN SERVER");
  console.log("----------------------------------");
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log("----------------------------------");
});
