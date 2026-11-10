
import { useEffect, useRef, useState } from "react";
import DrawingCanvas from "./DrawingCanvas";
import { socket } from "../socket";

function Game({ playerName, roomCode, onLeaveGame, onViewResults, initialGameResult = null}) {
  const [gameState, setGameState] = useState(null);
  const [secretWord, setSecretWord] = useState("");
  const [guess, setGuess] = useState("");
  const [messages, setMessages] = useState([]);
  const [remoteStrokes, setRemoteStrokes] = useState([]);
  const [clearSignal, setClearSignal] = useState(0);
  const [roundResult, setRoundResult] = useState(null);
  const [gameResult, setGameResult] = useState(initialGameResult);
  const [guessError, setGuessError] = useState("");
  const currentRoundRef = useRef(null);
  // The player ID is already stored when joining or creating a room.
  const currentPlayerId = localStorage.getItem("scribblelan_player_id");


  // Restore the final popup after refreshing the browser.
  useEffect(() => {
    if (initialGameResult) {
      setGameResult(initialGameResult);
    }
  }, [initialGameResult]);

  useEffect(() => {
    const handleGameState = (state) => {
        // Reset round-specific information only when a new round begins.
        if (currentRoundRef.current !== state.round) {
            currentRoundRef.current = state.round;

            setSecretWord("");
            setRoundResult(null);
            setMessages([]);
            setGuess("");
            setGuessError("");
        }

        setGameState(state);
    };

    const handleYourWord = (data) => {
        setSecretWord(data.word);
        console.log("Secret word successfully received!");
    };

    const handleRemoteStroke = (stroke) => {
      setRemoteStrokes((previous) => [...previous, stroke]);
    };

    const handleCanvasCleared = () => {
      setRemoteStrokes([]);
      setClearSignal((previous) => previous + 1);
    };

    const handleGuessMessage = (message) => {
      setMessages((previous) => [...previous, message]);
    };

    const handleRoundEnded = (result) => {
      setRoundResult(result);
      setSecretWord("");
      setGuess("");
    };

    const handleGameFinished = (result) => {
        console.log("Game finished. Final results:", result);

        setGameResult(result);
        setSecretWord("");
        setGuess("");
    };

    const requestDrawingState = () => {
      if (!socket.connected) return;

      socket.emit("GET_DRAWING_STATE", (response) => {
        if (!response?.success || !Array.isArray(response.strokes)) {
          console.error(
            "Unable to restore drawing:",
            response?.message
          );
          return;
        }

        console.log(
          `Restored ${response.strokes.length} drawing segments.`
        );

        setRemoteStrokes(response.strokes);
      });
    };

    socket.on("GAME_STATE", handleGameState);
    socket.on("YOUR_WORD", handleYourWord);
    socket.on("DRAW_STROKE", handleRemoteStroke);
    socket.on("CANVAS_CLEARED", handleCanvasCleared);
    socket.on("GUESS_MESSAGE", handleGuessMessage);
    socket.on("ROUND_ENDED", handleRoundEnded);
    socket.on("GAME_FINISHED", handleGameFinished);
    socket.on("connect", requestDrawingState);

    // Request the current game state when this screen opens.
    // Request game state and secret word after registering listeners.
    if (socket.connected) {
        socket.emit("GET_GAME_STATE");
        requestDrawingState();
        // socket.emit("REQUEST_WORD");
    }

    return () => {
      socket.off("GAME_STATE", handleGameState);
      socket.off("YOUR_WORD", handleYourWord);
      socket.off("DRAW_STROKE", handleRemoteStroke);
      socket.off("CANVAS_CLEARED", handleCanvasCleared);
      socket.off("GUESS_MESSAGE", handleGuessMessage);
      socket.off("ROUND_ENDED", handleRoundEnded);
      socket.off("GAME_FINISHED", handleGameFinished);
      socket.off("connect", requestDrawingState);
    };
  }, []);

  
  const isDrawer =
    gameState?.currentDrawerId === currentPlayerId;

  const alreadyGuessed =
    gameState?.guessedPlayerIds?.includes(currentPlayerId);

  const isRoundActive = gameState?.phase === "playing";

  const canGuess =
    isRoundActive && !isDrawer && !alreadyGuessed;

  const handleStroke = (stroke) => {
    if (!isDrawer || !socket.connected || !isRoundActive) return;

    socket.emit("DRAW_STROKE", stroke);
  };

  const handleClearCanvas = () => {
    if (!isDrawer || !socket.connected || !isRoundActive) return;

    socket.emit("CLEAR_CANVAS");
  };

  const submitGuess = (event) => {
    event.preventDefault();

    if (!guess.trim() || !canGuess) return;

    socket.emit(
      "SUBMIT_GUESS",
      { guess: guess.trim() },
      (response) => {
        if (!response || !response.success) {
          setGuessError(response?.message || "Could not submit guess.");
          return;
        }

        setGuessError("");
        setGuess("");
      }
    );
  };

  const players = gameState?.players || [];

  return (
    <div className="game-page">
      <header className="game-header">
        <div>
          <h2>ScribbleLAN</h2>
          <span>Room: {roomCode}</span>
        </div>

        <div className="round-info">
          <span>
            ROUND {gameState?.round || 1} / {gameState?.totalRounds || 1}
          </span>

          <strong>
            {gameState?.timeLeft ?? 60}s
          </strong>
        </div>

        <button
            className="leave-btn"
            onClick={() => {
                const confirmLeave = window.confirm(
                "Are you sure you want to leave this game?"
                );

                if (confirmLeave) {
                onLeaveGame();
                }
            }}
            >
            Leave Game
        </button>
      </header>

      <main className="game-layout">
        <section className="canvas-section">
          <div className="game-instruction">
            <span>🎨</span>

            <strong>
              {isDrawer
                ? "You are drawing!"
                : `${gameState?.currentDrawerName || "Player"} is drawing!`}
            </strong>

            <span>
              {isDrawer
                ? `Your word: ${secretWord || "Loading..."}`
                : `Category: ${gameState?.category || "Waiting"}`}
            </span>
          </div>

          <div className="game-word">
            {isDrawer
              ? `Your word: ${secretWord || "Loading..."}`
              : gameState?.maskedWord || "Waiting for round..."}
          </div>

          <DrawingCanvas
            disabled={!isDrawer || !isRoundActive}
            onStroke={handleStroke}
            onClear={handleClearCanvas}
            remoteStrokes={remoteStrokes}
            clearSignal={clearSignal}
          />

          <div className="game-hint">
            {isDrawer
              ? "Draw the word without revealing it!"
              : alreadyGuessed
                ? "You guessed correctly. Wait for the next round."
                : "Look at the drawing and submit your guess."}
          </div>

          {roundResult && (
            <div className="round-result">
              <h3>Round {roundResult.round} finished!</h3>
              <p>The word was: <strong>{roundResult.word}</strong></p>
              <p>Next round starting shortly...</p>
            </div>
          )}
        </section>

        <aside className="game-sidebar">
          <div className="sidebar-card">
            <h3>🏆 Leaderboard</h3>

            {players
              .slice()
              .sort((a, b) => b.score - a.score)
              .map((player, index) => (
                <div className="score-item" key={player.id}>
                  <span>
                    {index + 1}. {player.name}
                    {player.isDrawer ? " 🎨" : ""}
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
                  <strong>{message.name}: </strong>
                  <span>
                    {message.text}
                    {message.correct && message.points
                      ? ` (+${message.points} points)`
                      : ""}
                  </span>
                </div>
              ))}
            </div>

            <form onSubmit={submitGuess} className="guess-form">
              <input
                type="text"
                placeholder={
                  isDrawer
                    ? "You are drawing..."
                    : alreadyGuessed
                      ? "Already guessed correctly"
                      : "Type your guess..."
                }
                value={guess}
                onChange={(event) => setGuess(event.target.value)}
                disabled={!canGuess}
                maxLength={50}
              />

              <button type="submit" disabled={!canGuess}>
                Send
              </button>
            </form>

            {guessError && (
              <p className="guess-error">{guessError}</p>
            )}
          </div>
        </aside>
      </main>

      {gameResult && (
        <div className="game-result-overlay">
          <div className="game-result-card">
            <h2>🏆 Game Finished!</h2>

            {gameResult.winner && (
              <h3>
                Winner: {gameResult.winner.name}
              </h3>
            )}

            <h3>Final Scores</h3>

            {(gameResult?.scores || [])
                .slice()
                .sort((a, b) => b.score - a.score)
                .map((player, index) => (
                    <div className="score-item" key={player.id || index}>
                        <span>
                            {index + 1}. {player.name}
                        </span>

                        <strong>{player.score}</strong>
                    </div>
            ))}
            
            <button className="leave-btn" onClick={() => onViewResults(gameResult)}>
                View Final Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Game;
