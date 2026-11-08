
import { useState } from "react";

import Home from "./components/Home";
import Lobby from "./components/Lobby";
import Game from "./components/Game";
import Results from "./components/Results";

import "./App.css";

function App() {

  const [page, setPage] = useState("home");
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  // Create a new room
  const createRoom = (name) => {
    const code = Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase();

    setPlayerName(name);
    setRoomCode(code);
    setPage("lobby");
  };

  // Join an existing room (temporary local simulation)
  const joinRoom = (name, code) => {
    setPlayerName(name);
    setRoomCode(code);
    setPage("lobby");
  };

  // Start game
  const startGame = () => {
    setPage("game");
  };

  // End game
  const endGame = () => {
    setPage("results");
  };

  // Return home
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
          onStartGame={startGame}
          onLeave={goHome}
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
          onPlayAgain={startGame}
          onHome={goHome}
        />
      )}

    </>
  );
}

export default App;
