
import { useEffect, useState } from "react";

import Home from "./components/Home";
import Lobby from "./components/Lobby";
import Game from "./components/Game";
import Results from "./components/Results";

import { socket } from "./socket";

import "./App.css";


function generatePlayerId() {
  // Preferred method for secure browser contexts.
  if (window.crypto && window.crypto.randomUUID) {
    return window.crypto.randomUUID();
  }

  // Fallback for browsers accessing the application over LAN HTTP.
  if (window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);

    return Array.from(bytes)
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  // Last-resort fallback.
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2)
  );
}


function App() {

  const [page, setPage] = useState("home");

  const [playerName, setPlayerName] = useState("");
  const [playerId, setPlayerId] = useState("");

  const [roomCode, setRoomCode] = useState("");
  const [room, setRoom] = useState(null);

  const [connectionStatus, setConnectionStatus] =
    useState("Connecting...");

  // Get or create a stable player ID
  useEffect(() => {

    let id = localStorage.getItem("scribblelan_player_id");

    if (!id) {
      id = generatePlayerId();

      localStorage.setItem(
        "scribblelan_player_id",
        id
      );
    }

    setPlayerId(id);

  }, []);

  
  // Establish Socket.IO connection and restore previous session
  useEffect(() => {

    const handleConnect = () => {

      setConnectionStatus("Connected");

      console.log("Connected to ScribbleLAN server!");
      console.log("Socket ID:", socket.id);

      // Check whether a previous game session exists
      const savedSession = localStorage.getItem(
        "scribblelan_session"
      );

      if (!savedSession) return;

      try {

        const session = JSON.parse(savedSession);

        // Request restoration of the previous room
        socket.timeout(5000).emit(
          "RESUME_ROOM",
          {
            playerId: session.playerId,
            roomCode: session.roomCode
          },
          (error, response) => {

            if (error || !response?.success) {

              console.log(
                "Previous session could not be restored."
              );

              // The old room may no longer exist
              localStorage.removeItem("scribblelan_session");

              setRoom(null);
              setRoomCode("");
              setPage("home");

              return;
            }

            console.log("Previous room restored!");

            const restoredRoom = response.room;

            setPlayerId(session.playerId);
            setPlayerName(response.playerName);
            setRoomCode(restoredRoom.roomCode);
            setRoom(restoredRoom);

            // Restore the appropriate screen
            setPage(
              restoredRoom.status === "playing"
                ? "game"
                : "lobby"
            );

          }
        );

      } catch (error) {

        console.error("Session restoration error:", error);

        localStorage.removeItem("scribblelan_session");

      }

    };

    const handleDisconnect = () => {
      setConnectionStatus("Disconnected");
    };

    const handleConnectError = (error) => {
      setConnectionStatus("Connection Error");
      console.error(error.message);
    };

    const handleRoomUpdate = (updatedRoom) => {

      console.log("Room updated:", updatedRoom);

      setRoom(updatedRoom);

    };

    const handleGameStarted = () => {
      setPage("game");
    };

    const handlePlayerDisconnected = (data) => {
      console.log("Player disconnected:", data.playerId);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on("ROOM_UPDATE", handleRoomUpdate);
    socket.on("GAME_STARTED", handleGameStarted);

    socket.on(
      "PLAYER_DISCONNECTED",
      handlePlayerDisconnected
    );

    socket.connect();

    return () => {

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.off("ROOM_UPDATE", handleRoomUpdate);
      socket.off("GAME_STARTED", handleGameStarted);

      socket.off(
        "PLAYER_DISCONNECTED",
        handlePlayerDisconnected
      );

      socket.disconnect();

    };

  }, []);


  // Create a new room
  const createRoom = (name) => {

    if (!socket.connected) {
      alert("Server is not connected!");
      return;
    }

    if (!playerId) {
      alert("Please wait while your player ID is initialized.");
      return;
    }

    socket.timeout(5000).emit(
      "CREATE_ROOM",
      {
        playerId,
        playerName: name
      },
      (error, response) => {

        if (error) {
          alert("Server did not respond. Please try again.");
          return;
        }

        if (!response.success) {
          alert(response.message);
          return;
        }

        // Save player session for reconnection
        const session = {
          playerId,
          playerName: name,
          roomCode: response.room.roomCode
        };

        localStorage.setItem(
          "scribblelan_session",
          JSON.stringify(session)
        );

        setPlayerName(name);
        setRoom(response.room);
        setRoomCode(response.room.roomCode);

        setPage("lobby");

      }
    );

  };

  // Join an existing room
  const joinRoom = (name, code) => {

    if (!socket.connected) {
      alert("Server is not connected!");
      return;
    }

    if (!playerId) {
      alert("Please wait while your player ID is initialized.");
      return;
    }

    socket.timeout(5000).emit(
      "JOIN_ROOM",
      {
        playerId,
        playerName: name,
        roomCode: code
      },
      (error, response) => {

        if (error) {
          alert("Server did not respond. Please try again.");
          return;
        }

        if (!response.success) {
          alert(response.message);
          return;
        }

        // Save player session for reconnection
        const session = {
          playerId,
          playerName: name,
          roomCode: response.room.roomCode
        };

        localStorage.setItem(
          "scribblelan_session",
          JSON.stringify(session)
        );

        setPlayerName(name);
        setRoom(response.room);
        setRoomCode(response.room.roomCode);

        setPage("lobby");

      }
    );

  };

  // Start game
  const startGame = () => {

    socket.timeout(5000).emit(
      "START_GAME",
      {},
      (error, response) => {

        if (error) {
          alert("Server did not respond.");
          return;
        }

        if (!response.success) {
          alert(response.message);
        }

      }
    );

  };

  // Leave room
  const leaveRoom = () => {

    socket.timeout(5000).emit(
      "LEAVE_ROOM",
      {},
      (error, response) => {

        if (error) {
          alert("Server did not respond.");
          return;
        }

        if (!response.success) {
          alert(response.message);
          return;
        }

        // Remove saved game session
        localStorage.removeItem("scribblelan_session");

        setRoom(null);
        setRoomCode("");
        setPage("home");

      }
    );

  };

  const endGame = () => {
    setPage("results");
  };

  const goHome = () => {
    setPage("home");
  };

  return (
    <>

      {page === "home" && (
        <Home
          onCreateRoom={createRoom}
          onJoinRoom={joinRoom}
        />
      )}

      {page === "lobby" && (
        <Lobby
          playerName={playerName}
          roomCode={roomCode}
          players={room?.players || []}
          hostId={room?.hostId}
          currentPlayerId={playerId}
          gameStatus={room?.status}
          onStartGame={startGame}
          onLeave={leaveRoom}
        />
      )}

      {page === "game" && (
        <Game
          playerName={playerName}
          roomCode={roomCode}
          onEndGame={endGame}
        />
      )}

      {page === "results" && (
        <Results
          onPlayAgain={goHome}
          onHome={goHome}
        />
      )}

      <div className="connection-indicator">
        <span
          className={
            connectionStatus === "Connected"
              ? "connection-dot connected"
              : "connection-dot disconnected"
          }
        />
        {connectionStatus}
      </div>

    </>
  );

}

export default App;
