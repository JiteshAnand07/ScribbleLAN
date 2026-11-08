
const express = require("express");
const http = require("http");
const cors = require("cors");

const { Server } = require("socket.io");
const registerSocketHandlers = require("./socketHandlers");

// Create Express application
const app = express();

// Allow frontend clients during LAN development
app.use(cors({
  origin: true
}));

app.use(express.json());

// Create HTTP server
const httpServer = http.createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: true,
    methods: ["GET", "POST"]
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "success",
    message: "ScribbleLAN server is running!"
  });
});

// Register all Socket.IO event handlers
registerSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log("----------------------------------");
  console.log("       SCRIBBLELAN SERVER");
  console.log("----------------------------------");
  console.log(`Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log("----------------------------------");
});
