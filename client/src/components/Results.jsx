
function Results({ onPlayAgain, onHome }) {

  const players = [
    { name: "Player 2", score: 350 },
    { name: "Player 1", score: 250 },
    { name: "Player 3", score: 150 }
  ];

  return (
    <div className="results-page">

      <div className="results-card">

        <div className="winner-icon">🏆</div>

        <h1>Game Over!</h1>

        <p className="results-subtitle">
          Congratulations to the winner!
        </p>

        <div className="winner-box">
          <span>🥇 WINNER</span>
          <h2>{players[0].name}</h2>
          <strong>{players[0].score} Points</strong>
        </div>

        <h3>Final Leaderboard</h3>

        {players.map((player, index) => (
          <div className="result-row" key={index}>
            <span>{index + 1}. {player.name}</span>
            <strong>{player.score} pts</strong>
          </div>
        ))}

        <button className="primary-btn" onClick={onPlayAgain}>
          Play Again
        </button>

        <button className="leave-btn" onClick={onHome}>
          Back to Home
        </button>

      </div>

    </div>
  );
}

export default Results;
