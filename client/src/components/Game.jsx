
import { useEffect, useState } from "react";
import DrawingCanvas from "./DrawingCanvas";

function Game({ playerName, roomCode, onEndGame }) {

  const [timeLeft, setTimeLeft] = useState(60);
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState([
    { name: "Player 2", text: "Is it an animal?" },
    { name: "Player 3", text: "Maybe a vehicle!" }
  ]);

  const players = [
    { name: playerName, score: 100 },
    { name: "Player 2", score: 150 },
    { name: "Player 3", score: 50 }
  ];

  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((previous) => Math.max(0, previous - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  const submitGuess = (event) => {
    event.preventDefault();

    if (!guess.trim()) return;

    setMessages((previous) => [
      ...previous,
      { name: playerName, text: guess.trim() }
    ]);

    setGuess("");
  };

  return (
    <div className="game-page">

      <header className="game-header">

        <div>
          <h2>ScribbleLAN</h2>
          <span>Room: {roomCode}</span>
        </div>

        <div className="round-info">
          <span>ROUND 1 / 3</span>
          <strong>{timeLeft}s</strong>
        </div>

        <button className="leave-btn" onClick={onEndGame}>
          End Game
        </button>

      </header>

      <main className="game-layout">

        <section className="canvas-section">

          <div className="game-instruction">
            <span>🎨</span>
            <strong>Player 1 is drawing!</strong>
            <span>Guess the word</span>
          </div>

          <DrawingCanvas />

          <div className="game-hint">
            This is a sample round. Multiplayer synchronization
            will be added in the networking phase.
          </div>

        </section>

        <aside className="game-sidebar">

          <div className="sidebar-card">

            <h3>🏆 Leaderboard</h3>

            {players.map((player, index) => (
              <div className="score-item" key={index}>
                <span>
                  {index + 1}. {player.name}
                </span>

                <strong>{player.score}</strong>
              </div>
            ))}

          </div>

          <div className="sidebar-card chat-card">

            <h3>💬 Guesses</h3>

            <div className="chat-messages">
              {messages.map((message, index) => (
                <div className="chat-message" key={index}>
                  <strong>{message.name}:</strong>
                  <span>{message.text}</span>
                </div>
              ))}
            </div>

            <form onSubmit={submitGuess} className="guess-form">

              <input
                type="text"
                placeholder="Type your guess..."
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
              />

              <button type="submit">Send</button>

            </form>

          </div>

        </aside>

      </main>

    </div>
  );
}

export default Game;
