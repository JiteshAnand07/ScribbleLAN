
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

  // Check whether this room is currently handling a rematch.
  const roomHasRematch = players.some(
    (player) =>
      player.rematchStatus !== null &&
      player.rematchStatus !== undefined
  );

  // Players who have not yet responded to the invitation.
  const pendingRematchPlayers = players.filter(
    (player) =>
      player.connected !== false &&
      player.rematchStatus === "pending"
  );

  // Players who have accepted the rematch.
  const acceptedPlayers = players.filter(
    (player) =>
      player.connected !== false &&
      (
        player.rematchStatus === "accepted" ||
        !roomHasRematch
      )
  );

  // At least two eligible players must be ready.
  const canStartGame =
    pendingRematchPlayers.length === 0 &&
    acceptedPlayers.length >= 2;

  const connectedPlayers = players.filter(
    (player) => player.connected !== false
  ).length;

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
            ? roomHasRematch
              ? "Waiting for players to join the rematch..."
              : "Waiting for players to join..."
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

                {roomHasRematch && (
                  <span className="rematch-player-status">
                    {player.rematchStatus === "accepted"
                      ? "Rematch accepted"
                      : player.rematchStatus === "pending"
                        ? "Rematch pending"
                        : player.rematchStatus === "disconnected"
                          ? "Disconnected"
                          : "Joined"}
                  </span>
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

          {roomHasRematch && pendingRematchPlayers.length > 0 && (
            <p className="rematch-waiting">
              Waiting for {pendingRematchPlayers.length}
              {" "}player(s) to accept or decline...
            </p>
          )}

          {roomHasRematch && pendingRematchPlayers.length === 0 && (
            <p className="rematch-ready">
              All connected invited players have responded.
            </p>
          )}

        </div>

        <div className="lobby-actions">

          {isHost && gameStatus === "waiting" && (
            <button
              className="primary-btn"
              onClick={onStartGame}
              disabled={!canStartGame}
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
