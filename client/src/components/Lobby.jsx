
function Lobby({
  playerName,
  roomCode,
  players = [],
  hostId,
  currentPlayerId,
  gameStatus,
  onStartGame,
  onLeave
}) {

  const isHost = hostId === currentPlayerId;

  const copyRoomCode = async () => {

    try {
      await navigator.clipboard.writeText(roomCode);
      alert("Room code copied!");
    } catch {
      alert("Unable to copy room code.");
    }

  };

  return (
    <div className="lobby-page">

      <div className="lobby-card">

        <h1>Game Lobby</h1>

        <p className="lobby-subtitle">
          {gameStatus === "waiting"
            ? "Waiting for players to join..."
            : "Game has started!"}
        </p>

        <div className="room-code-box">

          <span>ROOM CODE</span>

          <div className="room-code">
            {roomCode}
          </div>

          <button
            className="copy-btn"
            onClick={copyRoomCode}
          >
            Copy Code
          </button>

        </div>

        <div className="player-section">

          <h3>
            Players ({players.length}/4)
          </h3>

          {players.map((player, index) => (

            <div className="player-item" key={player.id}>

              <div
                className="player-avatar"
                style={{
                  background: [
                    "#2563eb",
                    "#e879a0",
                    "#16a34a",
                    "#9333ea"
                  ][index % 4]
                }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>

              <div className="player-info">

                <strong>
                  {player.name}
                  {player.id === currentPlayerId && " (You)"}
                </strong>

                {player.isHost && (
                  <span>Room Host</span>
                )}

              </div>

              <span
                className={
                  player.connected
                    ? "online-status"
                    : "offline-status"
                }
              >
                ● {player.connected ? "Online" : "Offline"}
              </span>

            </div>

          ))}

          {players.length < 4 && (
            <p className="waiting-message">
              Waiting for {4 - players.length} more player(s)...
            </p>
          )}

        </div>

        <div className="lobby-actions">

          {isHost && gameStatus === "waiting" && (
            <button
              className="primary-btn"
              onClick={onStartGame}
              disabled={players.length < 2}
            >
              Start Game
            </button>
          )}

          {!isHost && gameStatus === "waiting" && (
            <p className="waiting-message">
              Waiting for the host to start the game...
            </p>
          )}

          {gameStatus === "playing" && (
            <p className="waiting-message">
              Game started!
            </p>
          )}

          <button
            className="leave-btn"
            onClick={onLeave}
          >
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
