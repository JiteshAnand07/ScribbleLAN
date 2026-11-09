
function Results({ results, onPlayAgain, onHome }) {

  // Get actual scores received from the backend.
  const players = (results?.scores || [])
    .slice()
    .sort((a, b) => b.score - a.score);

  const winner = players.length > 0 ? players[0] : null;

  return (
    <div className="results-page">

      <div className="results-card">

        <div className="winner-icon">🏆</div>

        <h1>Game Over!</h1>

        <p className="results-subtitle">
          {winner
            ? "Congratulations to the winner!"
            : "Final game results"}
        </p>

        {winner ? (
          <>
            <div className="winner-box">
              <span>🥇 WINNER</span>

              <h2>{winner.name}</h2>

              <strong>{winner.score} Points</strong>
            </div>

            <h3>Final Leaderboard</h3>

            {players.map((player, index) => (
              <div className="result-row" key={player.id}>
                <span>
                  {index + 1}. {player.name}
                </span>

                <strong>{player.score} pts</strong>
              </div>
            ))}
          </>
        ) : (
          <p className="results-subtitle">
            Final scores are not available. Please check your
            connection and try again.
          </p>
        )}

        <button
          className="primary-btn"
          onClick={onPlayAgain}
        >
          Play Again
        </button>

        <button
          className="leave-btn"
          onClick={onHome}
        >
          Back to Home
        </button>

      </div>

    </div>
  );
}

export default Results;
