
function Lobby({ playerName, roomCode, onStartGame, onLeave }) {

  // Temporary players for frontend development
  const players = [
    { name: playerName, host: true, color: "#2563eb" },
    { name: "Player 2", host: false, color: "#e879a0" },
    { name: "Player 3", host: false, color: "#16a34a" }
  ];

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert("Room code copied!");
  };

  return (
    <div className="lobby-page">

      <div className="lobby-card">

        <h1>Game Lobby</h1>

        <p className="lobby-subtitle">
          Waiting for players to join...
        </p>

        <div className="room-code-box">
          <span>ROOM CODE</span>

          <div className="room-code">
            {roomCode}
          </div>

          <button className="copy-btn" onClick={copyRoomCode}>
            Copy Code
          </button>
        </div>

        <div className="player-section">

          <h3>Players ({players.length}/4)</h3>

          {players.map((player, index) => (
            <div className="player-item" key={index}>

              <div
                className="player-avatar"
                style={{ background: player.color }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>

              <div className="player-info">
                <strong>{player.name}</strong>
                {player.host && <span>Room Host</span>}
              </div>

              <span className="online-status">
                ● Online
              </span>

            </div>
          ))}

        </div>

        <div className="lobby-actions">

          <button className="primary-btn" onClick={onStartGame}>
            Start Game
          </button>

          <button className="leave-btn" onClick={onLeave}>
            Leave Room
          </button>

        </div>

        <p className="lobby-note">
          Minimum 2 players required. Maximum 4 players.
        </p>

      </div>

    </div>
  );
}

export default Lobby;
