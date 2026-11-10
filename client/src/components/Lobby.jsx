
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
  // Safely handle either an array or a room object.
  const playerList = Array.isArray(players)
    ? players
    : Array.isArray(players?.players)
      ? players.players
      : [];

  const isHost = hostId === currentPlayerId;

  // Detect whether the room is handling a rematch.
  const roomHasRematch = playerList.some(
    (player) =>
      player.rematchStatus !== null &&
      player.rematchStatus !== undefined
  );

  // Players who have not responded to the rematch.
  const pendingRematchPlayers = playerList.filter(
    (player) =>
      player.connected !== false &&
      player.rematchStatus === "pending"
  );

  // Players eligible to participate in the game.
  const acceptedPlayers = playerList.filter(
    (player) =>
      player.connected !== false &&
      (
        !roomHasRematch ||
        player.rematchStatus === "accepted"
      )
  );

  const canStartGame =
    pendingRematchPlayers.length === 0 &&
    acceptedPlayers.length >= 2;

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
              ? "Waiting for rematch players..."
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
            Players ({playerList.length}/4)
          </h3>

          {playerList.map((player, index) => {
            const isOnline = player.connected !== false;

            return (
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
                  {(player.name || "?").charAt(0).toUpperCase()}
                </div>

                <div className="player-info">

                  <strong>
                    {player.name || "Unknown Player"}
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
                    isOnline
                      ? "online-status"
                      : "offline-status"
                  }
                >
                  ● {isOnline ? "Online" : "Offline"}
                </span>

              </div>
            );
          })}

          {!roomHasRematch && playerList.length < 4 && (
            <p className="waiting-message">
              Room has space for {4 - playerList.length} more player(s).
            </p>
          )}

          {roomHasRematch && pendingRematchPlayers.length > 0 && (
            <p className="rematch-waiting">
              Waiting for {pendingRematchPlayers.length}
              {" "}player(s) to accept or decline...
            </p>
          )}

          {roomHasRematch &&
            pendingRematchPlayers.length === 0 &&
            acceptedPlayers.length >= 2 && (
              <p className="rematch-ready">
                Players are ready for the rematch!
              </p>
            )}

          {roomHasRematch &&
            pendingRematchPlayers.length === 0 &&
            acceptedPlayers.length < 2 && (
              <p className="rematch-waiting">
                Waiting for at least one more player to join...
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
