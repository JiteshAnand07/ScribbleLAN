
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
  


  const pendingStrokesRef = useRef([]);
  const flushTimerRef = useRef(null);

  const latencySamplesRef = useRef(
    (() => {
      try {
        const saved = JSON.parse(
          sessionStorage.getItem(metricsStorageKey) || "{}"
        );

        return Array.isArray(saved.latencySamples)
          ? saved.latencySamples.slice(-10)
          : [];
      } catch {
        return [];
      }
    })()
  );

  
  // Get the current player's ID.
  const currentPlayerId = localStorage.getItem("scribblelan_player_id");

  // Each player and room gets a separate statistics record.
  const metricsStorageKey = `scribblelan_metrics_${roomCode}_${currentPlayerId}`;

  const initialNetworkStats = {
    rtt: null,
    averageRtt: null,

    batchesSent: 0,
    segmentsSent: 0,
    sentBytes: 0,

    batchesReceived: 0,
    segmentsReceived: 0,
    receivedBytes: 0,

    failedPings: 0,

    // Cumulative statistics maintained by the backend.
    serverBatches: 0,
    serverSegments: 0,
    serverBytes: 0
  };

  // Restore per-game statistics after a browser refresh.
  const [networkStats, setNetworkStats] = useState(() => {
    try {
      const saved = sessionStorage.getItem(metricsStorageKey);

      if (saved) {
        const parsed = JSON.parse(saved);

        return {
          ...initialNetworkStats,
          ...parsed,

          // Current RTT must be measured again.
          rtt: null,

          // These values will be fetched from the server.
          serverBatches: 0,
          serverSegments: 0,
          serverBytes: 0
        };
      }
    } catch (error) {
      console.error("Unable to restore network statistics:", error);
    }

    return initialNetworkStats;
  });


  
  // Persist per-game client statistics across browser refreshes.
  useEffect(() => {
    const statsToSave = {
      batchesSent: networkStats.batchesSent,
      segmentsSent: networkStats.segmentsSent,
      sentBytes: networkStats.sentBytes,

      batchesReceived: networkStats.batchesReceived,
      segmentsReceived: networkStats.segmentsReceived,
      receivedBytes: networkStats.receivedBytes,

      averageRtt: networkStats.averageRtt,
      failedPings: networkStats.failedPings,

      latencySamples: latencySamplesRef.current
    };

    try {
      sessionStorage.setItem(
        metricsStorageKey,
        JSON.stringify(statsToSave)
      );
    } catch (error) {
      console.error("Unable to save network statistics:", error);
    }
  }, [metricsStorageKey, networkStats]);


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
      const payloadBytes = new Blob([
        JSON.stringify(stroke)
      ]).size;

      setNetworkStats((previous) => ({
        ...previous,
        batchesReceived: previous.batchesReceived + 1,
        segmentsReceived: previous.segmentsReceived + 1,
        receivedBytes: previous.receivedBytes + payloadBytes
      }));

      setRemoteStrokes((previous) => [
        ...previous,
        stroke
      ]);
    };

    const handleCanvasCleared = () => {
      // Remove any unsent drawing segments.
      pendingStrokesRef.current = [];

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }

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

    
    const handleRemoteStrokeBatch = (data) => {
      if (
        !Array.isArray(data?.strokes) ||
        data.strokes.length === 0
      ) {
        return;
      }

      // Calculate the approximate received JSON payload size.
      const payloadBytes = new Blob([
        JSON.stringify(data)
      ]).size;

      // Update receiving statistics.
      setNetworkStats((previous) => ({
        ...previous,
        batchesReceived: previous.batchesReceived + 1,
        segmentsReceived:
          previous.segmentsReceived + data.strokes.length,
        receivedBytes: previous.receivedBytes + payloadBytes
      }));

      // Render the received drawing segments.
      setRemoteStrokes((previous) => [
        ...previous,
        ...data.strokes
      ]);
    };


    const handleSocketDisconnect = () => {
      pendingStrokesRef.current = [];

      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
    };

    socket.on("disconnect", handleSocketDisconnect);

    socket.on("GAME_STATE", handleGameState);
    socket.on("YOUR_WORD", handleYourWord);
    socket.on("DRAW_STROKE", handleRemoteStroke);
    socket.on("CANVAS_CLEARED", handleCanvasCleared);
    socket.on("GUESS_MESSAGE", handleGuessMessage);
    socket.on("ROUND_ENDED", handleRoundEnded);
    socket.on("GAME_FINISHED", handleGameFinished);
    socket.on("connect", requestDrawingState);
    socket.on("DRAW_STROKE_BATCH", handleRemoteStrokeBatch);

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
      socket.off("DRAW_STROKE_BATCH", handleRemoteStrokeBatch);
      socket.off("disconnect", handleSocketDisconnect);
    };
  }, []);


  
  useEffect(() => {
    let mounted = true;

    const measureLatency = () => {
      if (!socket.connected) return;

      const startTime = performance.now();

      socket.timeout(3000).emit(
        "MEASURE_LATENCY",
        (error, response) => {
          if (!mounted) return;

          if (error || !response?.success) {
            setNetworkStats((previous) => ({
              ...previous,
              rtt: null,
              failedPings: previous.failedPings + 1
            }));

            return;
          }

          const rtt = Math.round(
            performance.now() - startTime
          );

          // Retain the latest 10 measurements.
          const samples = [
            ...latencySamplesRef.current,
            rtt
          ].slice(-10);

          latencySamplesRef.current = samples;

          const average = Math.round(
            samples.reduce((sum, value) => sum + value, 0) /
            samples.length
          );

          setNetworkStats((previous) => ({
            ...previous,
            rtt,
            averageRtt: average
          }));
        }
      );

      // Also retrieve aggregate server-side drawing statistics.
      socket.emit("GET_NETWORK_METRICS", (response) => {
        if (!mounted || !response?.success) return;

        setNetworkStats((previous) => ({
          ...previous,
          serverBatches: response.drawingBatchesReceived,
          serverSegments: response.drawingSegmentsReceived,
          serverBytes: response.drawingBytesReceived
        }));
      });
    };

    socket.on("connect", measureLatency);

    if (socket.connected) {
      measureLatency();
    }

    const interval = setInterval(measureLatency, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
      socket.off("connect", measureLatency);
    };
  }, []);


  
  const isDrawer =
    gameState?.currentDrawerId === currentPlayerId;

  const alreadyGuessed =
    gameState?.guessedPlayerIds?.includes(currentPlayerId);

  const isRoundActive = gameState?.phase === "playing";

  const canGuess =
    isRoundActive && !isDrawer && !alreadyGuessed;

  
  
  const flushDrawingBatch = () => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }

    if (!socket.connected || pendingStrokesRef.current.length === 0) {
      return;
    }

    const batch = pendingStrokesRef.current.splice(0, 20);

    const payload = {
      strokes: batch
    };

    // Calculate approximate JSON payload size in bytes.
    const payloadBytes = new Blob([
      JSON.stringify(payload)
    ]).size;

    socket.emit("DRAW_STROKE_BATCH", payload);

    // Update this browser's sending statistics.
    setNetworkStats((previous) => ({
      ...previous,
      batchesSent: previous.batchesSent + 1,
      segmentsSent: previous.segmentsSent + batch.length,
      sentBytes: previous.sentBytes + payloadBytes
    }));

    // Send remaining segments in another batch.
    if (pendingStrokesRef.current.length > 0) {
      flushTimerRef.current = setTimeout(() => {
        flushDrawingBatch();
      }, 50);
    }
  };

  
  const handleStroke = (stroke) => {
    if (!isDrawer || !socket.connected || !isRoundActive) {
      return;
    }

    // Add the new segment to the pending batch.
    pendingStrokesRef.current.push(stroke);

    // Flush immediately when the batch reaches 20 segments.
    if (pendingStrokesRef.current.length >= 20) {
      flushDrawingBatch();
      return;
    }

    // Otherwise, wait for 50 milliseconds.
    if (!flushTimerRef.current) {
      flushTimerRef.current = setTimeout(() => {
        flushDrawingBatch();
      }, 50);
    }
  };


  const handleClearCanvas = () => {
    if (!isDrawer || !socket.connected || !isRoundActive) {
      return;
    }

    // Send pending segments before sending the clear event.
    flushDrawingBatch();

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

          
          <div className="network-stats">
            <strong>Network Performance</strong>

            <div className="network-stats-grid">

              <span>
                Current RTT:{" "}
                {networkStats.rtt === null
                  ? "Measuring..."
                  : `${networkStats.rtt} ms`}
              </span>

              <span>
                Average RTT:{" "}
                {networkStats.averageRtt === null
                  ? "Measuring..."
                  : `${networkStats.averageRtt} ms`}
              </span>

              <span>
                Failed latency probes: {networkStats.failedPings}
              </span>

            </div>

            <div className="network-stats-section">
              <strong>Current Browser – Sending</strong>

              <div className="network-stats-grid">
                <span>Batches sent: {networkStats.batchesSent}</span>

                <span>Segments sent: {networkStats.segmentsSent}</span>

                <span>
                  Sent payload: {(networkStats.sentBytes / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>

            <div className="network-stats-section">
              <strong>Current Browser – Receiving</strong>

              <div className="network-stats-grid">
                <span>Batches received: {networkStats.batchesReceived}</span>

                <span>Segments received: {networkStats.segmentsReceived}</span>

                <span>
                  Received payload: {(networkStats.receivedBytes / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>

            <div className="network-stats-section">
              <strong>Server – Cumulative Statistics</strong>

              <div className="network-stats-grid">
                <span>Server batches: {networkStats.serverBatches}</span>

                <span>Server segments: {networkStats.serverSegments}</span>

                <span>
                  Server payload: {(networkStats.serverBytes / 1024).toFixed(2)} KB
                </span>
              </div>
            </div>
          </div>


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
