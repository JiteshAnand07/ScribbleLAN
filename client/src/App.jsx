
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
  const [finalResults, setFinalResults] = useState(null);
  const [rematchInvite, setRematchInvite] = useState(null);
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

            // Restore the previous game results from localStorage.
            let savedResults = null;

            try {
              savedResults = JSON.parse(
                localStorage.getItem("scribblelan_final_results") || "null"
              );
            } catch (error) {
              console.error("Unable to restore final results:", error);
            }

            const savedView = localStorage.getItem(
              "scribblelan_current_view"
            );

            // Restore the correct screen based on server game status.
            if (restoredRoom.status === "finished") {

              setFinalResults(savedResults);

              if (savedView === "results") {
                setPage("results");
              } else {
                // Restore the Game page with its finished-game popup.
                setPage("game");
              }

            } else if (restoredRoom.status === "playing") {

              setFinalResults(null);
              setPage("game");

            } else {

              setFinalResults(null);
              setPage("lobby");

            }

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

      // Accept only a valid public room object.
      if (
        updatedRoom &&
        updatedRoom.roomCode &&
        Array.isArray(updatedRoom.players)
      ) {
        setRoom(updatedRoom);
        setRoomCode(updatedRoom.roomCode);
      }
    };

    const handleGameStarted = () => {
      localStorage.setItem("scribblelan_current_view", "game");
      localStorage.removeItem("scribblelan_final_results");

      setFinalResults(null);
      setPage("game");
    };

    const handleRematchRequest = (request) => {
      console.log("Rematch invitation received:", request);
      setRematchInvite(request);
    };

    const handleReturnToLobby = (updatedRoom) => {
      console.log("Returning to existing room:", updatedRoom.roomCode);

      setRematchInvite(null);
      setFinalResults(null);
      setRoom(updatedRoom);
      setRoomCode(updatedRoom.roomCode);

      localStorage.removeItem("scribblelan_final_results");
      localStorage.setItem("scribblelan_current_view", "lobby");

      setPage("lobby");
    };

    const handlePlayerDisconnected = (data) => {
      console.log("Player disconnected:", data.playerId);
    };

    const handleGameFinished = (results) => {
      console.log("Final game results received:", results);

      setFinalResults(results);

      // Save results so they survive browser refresh.
      localStorage.setItem(
        "scribblelan_final_results",
        JSON.stringify(results)
      );

      // The user is currently seeing the Game Finished popup.
      localStorage.setItem(
        "scribblelan_current_view",
        "game"
      );
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleConnectError);

    socket.on("ROOM_UPDATE", handleRoomUpdate);
    socket.on("GAME_STARTED", handleGameStarted);
    socket.on("REMATCH_REQUEST", handleRematchRequest);
    socket.on("RETURN_TO_LOBBY", handleReturnToLobby);

    socket.on(
      "PLAYER_DISCONNECTED",
      handlePlayerDisconnected
    );
    socket.on("GAME_FINISHED", handleGameFinished);

    socket.connect();

    return () => {

      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleConnectError);

      socket.off("ROOM_UPDATE", handleRoomUpdate);
      socket.off("GAME_STARTED", handleGameStarted);
      socket.off("REMATCH_REQUEST", handleRematchRequest);
      socket.off("RETURN_TO_LOBBY", handleReturnToLobby);

      socket.off(
        "PLAYER_DISCONNECTED",
        handlePlayerDisconnected
      );
      socket.off("GAME_FINISHED", handleGameFinished);
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
          console.error("Socket.IO request failed:", response);
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

        localStorage.setItem("scribblelan_session", JSON.stringify(session));
        localStorage.setItem("scribblelan_current_view", "lobby");
        localStorage.removeItem("scribblelan_final_results");

        setPlayerName(name);
        setRoom(response.room);
        setRoomCode(response.room.roomCode);
        setFinalResults(null);

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
          console.error("Socket.IO request failed:", response);
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

        localStorage.setItem("scribblelan_session", JSON.stringify(session));
        localStorage.setItem("scribblelan_current_view", "lobby");
        localStorage.removeItem("scribblelan_final_results");

        setPlayerName(name);
        setRoom(response.room);
        setRoomCode(response.room.roomCode);
        setFinalResults(null);

        setPage("lobby");

      }
    );

  };

  // Start game
  const startGame = () => {
    if (!socket.connected) {
      alert("Not connected to server. Please wait.");
      return;
    }

    socket.timeout(10000).emit("START_GAME", (error, response) => {
      if (error) {
        console.error("START_GAME timeout:", error);
        alert("Start Game request timed out.");
        return;
      }

      if (!response?.success) {
        alert(response?.message || "Could not start game.");
        return;
      }

      console.log("Game started successfully.");
    });
  };

  // Leave room
  const leaveRoom = () => {
    if (!socket.connected) {
      alert("Server is disconnected. Please reconnect and try again.");
      return;
    }

    socket.timeout(5000).emit(
      "LEAVE_ROOM",
      {},
      (error, response) => {

        if (error) {
          console.error("Leave room timeout:", error);
          alert("Could not leave the previous room. Please try again.");
          return;
        }

        if (!response?.success) {
          alert(response?.message || "Could not leave the room.");
          return;
        }

        console.log("Successfully left previous room.");

        localStorage.removeItem("scribblelan_session");
        localStorage.removeItem("scribblelan_current_view");
        localStorage.removeItem("scribblelan_final_results");

        setFinalResults(null);
        setRoom(null);
        setRoomCode("");
        setPage("home");
      }
    );
  };

  // const endGame = (results) => {
  //   if (results) {
  //     setFinalResults(results);
  //   }

  //   setPage("results");
  // };

  // Navigate to results after the game finishes.
  const viewFinalResults = (results) => {
    if (results) {
      setFinalResults(results);

      localStorage.setItem(
        "scribblelan_final_results",
        JSON.stringify(results)
      );
    }

    localStorage.setItem("scribblelan_current_view", "results");

    setPage("results");
  };

  const goHome = () => {
    // setFinalResults(null);
    // setRoom(null);
    // setRoomCode("");

    // localStorage.removeItem("scribblelan_session");

    // setPage("home");
    leaveRoom();
  };

  // Start a rematch in the existing room.
  // Request a rematch from the existing room.
  const playAgain = () => {
    if (!socket.connected) {
      alert("Server is disconnected.");
      return;
    }

    socket.timeout(5000).emit("PLAY_AGAIN", (error, response) => {
      if (error) {
        alert("Rematch request timed out.");
        return;
      }

      if (!response?.success) {
        alert(response?.message || "Could not request rematch.");
        return;
      }

      localStorage.removeItem("scribblelan_final_results");
      localStorage.setItem("scribblelan_current_view", "lobby");

      setRoom(response.room);
      setRoomCode(response.room.roomCode);
      setFinalResults(null);
      setPage("lobby");
    });
  };

  // Accept another player's rematch invitation.
  const acceptRematch = () => {
    socket.timeout(5000).emit("ACCEPT_REMATCH", (error, response) => {
      if (error) {
        alert("Server did not respond. Please try again.");
        return;
      }

      if (!response?.success) {
        alert(response?.message || "Could not accept rematch.");
        return;
      }

      setRematchInvite(null);
      setFinalResults(null);
      setRoom(response.room);
      setRoomCode(response.room.roomCode);
      setPage("lobby");
    });
  };

  // Decline the invitation and leave the existing room.
  const declineRematch = () => {
    socket.timeout(5000).emit("DECLINE_REMATCH", (error, response) => {
      if (error) {
        alert("Could not leave the room. Please try again.");
        return;
      }

      if (!response?.success) {
        alert(response?.message || "Could not decline rematch.");
        return;
      }

      setRematchInvite(null);
      setFinalResults(null);
      setRoom(null);
      setRoomCode("");

      localStorage.removeItem("scribblelan_session");

      setPage("home");
    });
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
          onLeaveGame={leaveRoom}
          onViewResults={viewFinalResults}
          initialGameResult={finalResults}
        />
      )}

      {page === "results" && (
        <Results
          results={finalResults}
          onPlayAgain={playAgain}
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

      {rematchInvite && (
        <div className="rematch-overlay">
          <div className="rematch-card">
            <div className="rematch-icon">🎮</div>

            <h2>Rematch Invitation!</h2>

            <p>
              <strong>{rematchInvite.requesterName}</strong>
              {" "}wants to play another game with you.
            </p>

            <p className="rematch-room">
              Room Code: {rematchInvite.roomCode}
            </p>

            <button
              className="primary-btn"
              onClick={acceptRematch}
            >
              Accept Rematch
            </button>

            <button
              className="leave-btn"
              onClick={declineRematch}
            >
              Decline
            </button>
          </div>
        </div>
      )}

    </>
  );

}

export default App;
