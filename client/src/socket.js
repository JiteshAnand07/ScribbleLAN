
import { io } from "socket.io-client";

// Backend server address
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  "http://localhost:5000";

// Create Socket.IO client
export const socket = io(SERVER_URL, {
  autoConnect: false
});
