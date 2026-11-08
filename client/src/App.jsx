
import { useEffect, useState } from "react";
import { socket } from "./socket";
import "./App.css";

function App() {
  const [status, setStatus] = useState("Connecting...");
  const [socketId, setSocketId] = useState("Not connected");
  const [serverMessage, setServerMessage] = useState(
    "Waiting for server response..."
  );
  const [rtt, setRtt] = useState(null);
  const [pingMessage, setPingMessage] = useState("");

  useEffect(() => {

    // Runs when the client connects
    const handleConnect = () => {
      setStatus("Connected");
      setSocketId(socket.id || "Unknown");
    };

    // Runs when the client disconnects
    const handleDisconnect = (reason) => {
      setStatus("Disconnected");
      setSocketId("Not connected");
      setPingMessage(`Disconnected: ${reason}`);
    };

    // Runs if the connection fails
    const handleConnectError = (error) => {
      setStatus("Connection Error");
      setPingMessage(error.message);
    };

    // Receives welcome message from backend
    const handleWelcome = (data) => {
      setServerMessage(data.message);
    };

    // Register event listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);
    socket.on("SERVER_WELCOME", handleWelcome);

    // Establish the connection
    socket.connect();

    // Remove listeners when component unmounts
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);
      socket.off("SERVER_WELCOME", handleWelcome);
      socket.disconnect();
    };

  }, []);

  // Test communication with server
  const testServer = () => {

    if (!socket.connected) {
      setPingMessage("Server is not connected!");
      return;
    }

    const startTime = performance.now();

    socket.timeout(3000).emit(
      "CLIENT_PING",
      { sentAt: Date.now() },
      (error, response) => {

        if (error) {
          setPingMessage("Server did not respond within 3 seconds.");
          return;
        }

        const elapsed = Math.round(
          performance.now() - startTime
        );

        setRtt(elapsed);
        setPingMessage(
          `Server responded successfully. RTT: ${elapsed} ms`
        );
      }
    );
  };

  return (
    <div className="app">

      <header className="header">
        <h1>ScribbleLAN</h1>
        <p>
          Real-Time Multiplayer Drawing and Guessing Game
        </p>
      </header>

      <main className="container">

        <section className="card">

          <h2>Server Connection Status</h2>

          <div className="status-row">
            <span
              className={`status-dot ${
                socket.connected ? "online" : "offline"
              }`}
            ></span>

            <strong>{status}</strong>
          </div>

          <div className="details">
            <p>
              <strong>Backend:</strong> {import.meta.env.VITE_SERVER_URL}
            </p>

            <p>
              <strong>Socket ID:</strong> {socketId}
            </p>

            <p>
              <strong>Server message:</strong> {serverMessage}
            </p>

            <p>
              <strong>Round-trip time:</strong>{" "}
              {rtt !== null ? `${rtt} ms` : "Not measured"}
            </p>
          </div>

          <button
            onClick={testServer}
            disabled={!socket.connected}
          >
            Test Server Connection
          </button>

          {pingMessage && (
            <p className="ping-message">{pingMessage}</p>
          )}

        </section>

        <section className="info-card">
          <h3>Welcome to ScribbleLAN!</h3>

          <p>
            Your multiplayer drawing game will allow
            multiple computers to communicate through
            a common local network.
          </p>

          <p>
            Phase 1: Frontend and backend connection
            successfully initialized.
          </p>
        </section>

      </main>

      <footer>
        ScribbleLAN | Computer Networks Lab Project
      </footer>

    </div>
  );
}

export default App;
