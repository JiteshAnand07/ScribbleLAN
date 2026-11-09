
const gameManager = require("./gameManager");

const ROUND_DURATION = 60;
const ROUND_BREAK = 4;

const WORDS = [
  { word: "APPLE", category: "Food" },
  { word: "ELEPHANT", category: "Animal" },
  { word: "BICYCLE", category: "Object" },
  { word: "RAINBOW", category: "Nature" },
  { word: "AIRPLANE", category: "Transport" },
  { word: "GUITAR", category: "Object" },
  { word: "PIZZA", category: "Food" },
  { word: "BUTTERFLY", category: "Animal" },
  { word: "MOUNTAIN", category: "Nature" },
  { word: "COMPUTER", category: "Technology" },
  { word: "CRICKET", category: "Sport" },
  { word: "SUNFLOWER", category: "Nature" },
  { word: "TELEPHONE", category: "Object" },
  { word: "TIGER", category: "Animal" },
  { word: "HELICOPTER", category: "Transport" },
  { word: "CHOCOLATE", category: "Food" },
  { word: "FOOTBALL", category: "Sport" },
  { word: "UMBRELLA", category: "Object" }
];

// Active game sessions, indexed by room code.
const sessions = new Map();

function normalizeWord(word) {
  return String(word)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ");
}

function createMaskedWord(word) {
  return word
    .split("")
    .map((char) => char === " " ? "/" : "_")
    .join(" ");
}

function getRemainingTime(session) {
  if (!session || session.phase !== "playing") return 0;

  return Math.max(
    0,
    Math.ceil((session.endsAt - Date.now()) / 1000)
  );
}

// Create a public game state. Never include the secret word here.
function getPublicState(roomCode) {
  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);

  if (!room || !session) return null;

  const players = Array.from(room.players.entries()).map(
    ([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0,
      connected: player.connected !== false,
      isDrawer: id === session.currentDrawerId
    })
  );

  const drawer = gameManager.getPlayer(
    roomCode,
    session.currentDrawerId
  );

  return {
    roomCode,
    phase: session.phase,
    round: session.round,
    totalRounds: session.totalRounds,
    timeLeft: getRemainingTime(session),
    currentDrawerId: session.currentDrawerId,
    currentDrawerName: drawer ? drawer.name : "Unknown",
    category: session.category,
    maskedWord: session.phase === "playing"
      ? createMaskedWord(session.currentWord)
      : "",
    guessedPlayerIds: Array.from(session.guessedPlayers),
    players
  };
}

function broadcastGameState(io, roomCode) {
  const state = getPublicState(roomCode);

  if (state) {
    io.to(roomCode).emit("GAME_STATE", state);
  }
}


function sendPrivateWord(socket, roomCode, playerId) {
  const session = sessions.get(roomCode);

  if (!session) {
    console.log("Cannot send word: game session not found.");
    return false;
  }

  if (session.phase !== "playing") {
    console.log("Cannot send word: round is not active.");
    return false;
  }

  // Only the selected drawer can receive the secret word.
  if (session.currentDrawerId !== playerId) {
    console.log("Word request ignored: player is not the drawer.");
    return false;
  }

  socket.emit("YOUR_WORD", {
    word: session.currentWord,
    category: session.category
  });

  console.log(
    `Secret word sent successfully to drawer ${playerId} in room ${roomCode}.`
  );

  return true;
}


// Send the secret word only to the drawer.
function sendWordToDrawer(io, roomCode) {
  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);

  if (!room || !session) return;

  const drawer = room.players.get(session.currentDrawerId);

  if (drawer && drawer.socketId) {
    io.to(drawer.socketId).emit("YOUR_WORD", {
      word: session.currentWord,
      category: session.category
    });
  }
}

function stopSessionTimers(session) {
  if (session.timer) {
    clearInterval(session.timer);
    session.timer = null;
  }

  if (session.nextRoundTimer) {
    clearTimeout(session.nextRoundTimer);
    session.nextRoundTimer = null;
  }
}

function finishGame(io, roomCode) {
  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);

  if (!room || !session || session.phase === "finished") return;

  stopSessionTimers(session);

  session.phase = "finished";
  room.status = "finished";

  const scores = Array.from(room.players.entries())
    .map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0
    }))
    .sort((a, b) => b.score - a.score);

  const winner = scores.length > 0 ? scores[0] : null;

  io.to(roomCode).emit("GAME_FINISHED", {
    scores,
    winner
  });

  io.to(roomCode).emit("ROOM_UPDATE", gameManager.getPublicRoom(room));
}



function prepareRematch(roomCode, requesterId) {
  const room = gameManager.getRoom(roomCode);

  if (!room) {
    return {
      success: false,
      message: "Room does not exist."
    };
  }

  if (room.status !== "finished") {
    return {
      success: false,
      message: "The game has not finished yet."
    };
  }

  const requester = gameManager.getPlayer(roomCode, requesterId);

  if (!requester) {
    return {
      success: false,
      message: "Player is no longer in this room."
    };
  }

  // Stop and remove the previous game session.
  const session = sessions.get(roomCode);

  if (session) {
    stopSessionTimers(session);
    sessions.delete(roomCode);
  }

  // Activate rematch invitation mode.
  room.status = "waiting";
  room.rematchActive = true;

  // The requester has automatically accepted.
  // Other connected players must respond.
  for (const [id, player] of room.players.entries()) {
    player.rematchStatus =
      id === requesterId
        ? "accepted"
        : player.connected === false
          ? "disconnected"
          : "pending";
  }

  console.log(`Rematch requested in room ${roomCode}`);

  return {
    success: true,
    room: gameManager.getPublicRoom(room)
  };
}

function acceptRematch(roomCode, playerId) {
  const room = gameManager.getRoom(roomCode);

  if (!room || !room.rematchActive || room.status !== "waiting") {
    return {
      success: false,
      message: "This rematch invitation is no longer active."
    };
  }

  const player = gameManager.getPlayer(roomCode, playerId);

  if (!player || player.connected === false) {
    return {
      success: false,
      message: "Player is not connected to this room."
    };
  }

  if (player.rematchStatus === "accepted") {
    return {
      success: true,
      room: gameManager.getPublicRoom(room)
    };
  }

  if (player.rematchStatus !== "pending") {
    return {
      success: false,
      message: "No pending rematch invitation."
    };
  }

  player.rematchStatus = "accepted";

  console.log(`Player ${player.name} accepted rematch in ${roomCode}`);

  return {
    success: true,
    room: gameManager.getPublicRoom(room)
  };
}



function endRound(io, roomCode) {
  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);

  if (!room || !session || session.phase !== "playing") return;

  stopSessionTimers(session);
  session.phase = "round-ended";

  const scores = Array.from(room.players.entries()).map(
    ([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0
    })
  );

  io.to(roomCode).emit("ROUND_ENDED", {
    round: session.round,
    word: session.currentWord,
    scores
  });

  broadcastGameState(io, roomCode);

  session.nextRoundTimer = setTimeout(() => {
    startNextRound(io, roomCode);
  }, ROUND_BREAK * 1000);
}

function startNextRound(io, roomCode) {
  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);

  if (!room || !session || session.phase === "finished") return;

  session.round += 1;

  if (session.round > session.totalRounds) {
    finishGame(io, roomCode);
    return;
  }

  session.currentDrawerId =
    session.playerOrder[(session.round - 1) % session.playerOrder.length];

  const selected = WORDS[Math.floor(Math.random() * WORDS.length)];

  session.currentWord = selected.word;
  session.category = selected.category;
  session.guessedPlayers = new Set();
  session.phase = "playing";
  session.endsAt = Date.now() + ROUND_DURATION * 1000;

  // Start each round with a clean canvas.
  io.to(roomCode).emit("CANVAS_CLEARED");

  broadcastGameState(io, roomCode);
  sendWordToDrawer(io, roomCode);

  session.timer = setInterval(() => {
    if (session.phase !== "playing") {
      stopSessionTimers(session);
      return;
    }

    const remaining = getRemainingTime(session);

    broadcastGameState(io, roomCode);

    if (remaining <= 0) {
      endRound(io, roomCode);
    }
  }, 1000);
}

// Called by START_GAME after gameManager validates the host.
function startGame(io, roomCode) {
  const room = gameManager.getRoom(roomCode);

  if (!room) {
    return { success: false, message: "Room not found." };
  }

  const playerIds = Array.from(room.players.entries())
    .filter(([, player]) => player.connected !== false)
    .map(([id]) => id);

  if (playerIds.length < 2) {
    return {
      success: false,
      message: "At least 2 connected players are required."
    };
  }

  const previousSession = sessions.get(roomCode);

  if (previousSession) {
    stopSessionTimers(previousSession);
  }

  // Reset scores for the new game.
  playerIds.forEach((id) => {
    const player = room.players.get(id);
    player.score = 0;
  });

  const session = {
    playerOrder: playerIds,
    round: 0,
    totalRounds: playerIds.length,
    currentDrawerId: null,
    currentWord: "",
    category: "",
    guessedPlayers: new Set(),
    phase: "playing",
    endsAt: null,
    timer: null,
    nextRoundTimer: null
  };

  sessions.set(roomCode, session);

  startNextRound(io, roomCode);

  return { success: true };
}

function canDraw(roomCode, playerId) {
  const session = sessions.get(roomCode);

  return Boolean(
    session &&
    session.phase === "playing" &&
    session.currentDrawerId === playerId
  );
}

function submitGuess(io, socket, rawGuess) {
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;

  if (!roomCode || !playerId) {
    return { success: false, message: "You are not in a room." };
  }

  const room = gameManager.getRoom(roomCode);
  const session = sessions.get(roomCode);
  const player = gameManager.getPlayer(roomCode, playerId);

  if (!room || !session || !player || session.phase !== "playing") {
    return { success: false, message: "No active round." };
  }

  if (session.currentDrawerId === playerId) {
    return { success: false, message: "The drawer cannot submit guesses." };
  }

  if (session.guessedPlayers.has(playerId)) {
    return { success: false, message: "You have already guessed correctly." };
  }

  if (typeof rawGuess !== "string" || rawGuess.trim().length === 0) {
    return { success: false, message: "Enter a guess first." };
  }

  const guess = rawGuess.trim().slice(0, 50);
  const correct =
    normalizeWord(guess) === normalizeWord(session.currentWord);

  if (correct) {
    const remaining = getRemainingTime(session);
    const guesserPoints = 100 + remaining;
    const drawerPoints = 50;

    player.score = (player.score || 0) + guesserPoints;

    const drawer = gameManager.getPlayer(
      roomCode,
      session.currentDrawerId
    );

    if (drawer) {
      drawer.score = (drawer.score || 0) + drawerPoints;
    }

    session.guessedPlayers.add(playerId);

    io.to(roomCode).emit("GUESS_MESSAGE", {
      name: player.name,
      text: "guessed correctly!",
      correct: true,
      points: guesserPoints
    });

    broadcastGameState(io, roomCode);

    const eligibleGuessers = session.playerOrder.filter(
      (id) => id !== session.currentDrawerId
    );

    if (session.guessedPlayers.size >= eligibleGuessers.length) {
      endRound(io, roomCode);
    }

    return { success: true, correct: true };
  }

  io.to(roomCode).emit("GUESS_MESSAGE", {
    name: player.name,
    text: guess,
    correct: false
  });

  return { success: true, correct: false };
}

module.exports = {
  startGame,
  canDraw,
  submitGuess,
  getPublicState,
  sendPrivateWord,
  prepareRematch,
  acceptRematch
};
