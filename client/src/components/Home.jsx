
import { useState } from "react";

function Home({ onCreateRoom, onJoinRoom }) {
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleCreate = () => {
    if (!playerName.trim()) {
      alert("Please enter your nickname!");
      return;
    }

    onCreateRoom(playerName.trim());
  };

  const handleJoin = () => {
    if (!playerName.trim()) {
      alert("Please enter your nickname!");
      return;
    }

    if (!roomCode.trim()) {
      alert("Please enter a room code!");
      return;
    }

    onJoinRoom(playerName.trim(), roomCode.trim().toUpperCase());
  };

  return (
    <div className="home-page">
      <div className="home-card">

        <div className="brand-icon">🎨</div>

        <h1 className="brand-title">ScribbleLAN</h1>

        <p className="brand-subtitle">
          Draw it. Guess it. Win together.
        </p>

        <div className="home-form">

          <label>Your Nickname</label>

          <input
            type="text"
            placeholder="Enter your nickname"
            maxLength={15}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
          />

          <button className="primary-btn" onClick={handleCreate}>
            Create New Room
          </button>

          <div className="or-divider">
            <span>OR JOIN AN EXISTING ROOM</span>
          </div>

          <label>Room Code</label>

          <input
            type="text"
            placeholder="Enter room code"
            maxLength={6}
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
          />

          <button className="secondary-btn" onClick={handleJoin}>
            Join Room
          </button>

        </div>

        <div className="home-footer">
          <span>🌐 Local Area Network Multiplayer</span>
          <span>Computer Networks Lab Project</span>
        </div>

      </div>
    </div>
  );
}

export default Home;
