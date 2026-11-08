
const crypto = require("crypto");

// Stores all active game rooms
const rooms = new Map();

// Maximum players in a room
const MAX_PLAYERS = 4;

// Generate a unique six-character room code
function generateRoomCode() {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let code;

  do {
    code = "";

    for (let i = 0; i < 6; i++) {
      const index = crypto.randomInt(characters.length);
      code += characters[index];
    }

  } while (rooms.has(code));

  return code;
}

// Convert room data into a safe object for clients
function getPublicRoom(room) {
  return {
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    players: Array.from(room.players.values()).map((player) => ({
      id: player.id,
      name: player.name,
      score: player.score,
      isHost: player.isHost,
      connected: player.connected
    }))
  };
}

// Create a new room
function createRoom(playerId, playerName, socketId) {

  if (!playerId || !playerName || !socketId) {
    throw new Error("Invalid player information.");
  }

  const roomCode = generateRoomCode();

  const room = {
    roomCode,
    hostId: playerId,
    status: "waiting",
    players: new Map(),
    createdAt: Date.now()
  };

  const player = {
    id: playerId,
    name: playerName,
    socketId,
    score: 0,
    isHost: true,
    connected: true
  };

  room.players.set(playerId, player);

  rooms.set(roomCode, room);

  return getPublicRoom(room);
}

// Join an existing room
function joinRoom(roomCode, playerId, playerName, socketId) {

  const room = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room does not exist. Check the room code.");
  }

  if (room.status !== "waiting") {
    throw new Error("This game has already started.");
  }

  if (room.players.has(playerId)) {
    throw new Error("You are already a member of this room.");
  }

  if (room.players.size >= MAX_PLAYERS) {
    throw new Error("Room is full. Maximum 4 players allowed.");
  }

  const player = {
    id: playerId,
    name: playerName,
    socketId,
    score: 0,
    isHost: false,
    connected: true
  };

  room.players.set(playerId, player);

  return getPublicRoom(room);
}

// Find a room using a player's ID
function findPlayerRoom(playerId) {

  for (const room of rooms.values()) {
    if (room.players.has(playerId)) {
      return room;
    }
  }

  return null;
}

// Start the game
function startGame(roomCode, playerId) {

  const room = rooms.get(roomCode);

  if (!room) {
    throw new Error("Room does not exist.");
  }

  if (room.hostId !== playerId) {
    throw new Error("Only the host can start the game.");
  }

  if (room.players.size < 2) {
    throw new Error("At least 2 players are required.");
  }

  if (room.status !== "waiting") {
    throw new Error("Game has already started.");
  }

  room.status = "playing";

  return getPublicRoom(room);
}

// Remove a player from a room
function removePlayer(roomCode, playerId) {

  const room = rooms.get(roomCode);

  if (!room) {
    return null;
  }

  const player = room.players.get(playerId);

  if (!player) {
    return null;
  }

  room.players.delete(playerId);

  // Remove room if empty
  if (room.players.size === 0) {
    rooms.delete(roomCode);
    return {
      roomCode,
      removedPlayer: playerId,
      roomDeleted: true,
      room: null
    };
  }

  // Assign a new host if the old host leaves
  if (room.hostId === playerId) {

    const nextPlayer = room.players.values().next().value;

    room.hostId = nextPlayer.id;

    nextPlayer.isHost = true;
  }

  return {
    roomCode,
    removedPlayer: playerId,
    roomDeleted: false,
    room: getPublicRoom(room)
  };
}

// Get room information
function getRoom(roomCode) {

  const room = rooms.get(roomCode);

  if (!room) return null;

  return getPublicRoom(room);
}

// Get the internal player information
function getPlayer(roomCode, playerId) {

  const room = rooms.get(roomCode);

  if (!room) return null;

  return room.players.get(playerId) || null;
}

// Update socket ID when needed
function updatePlayerSocket(roomCode, playerId, socketId) {

  const room = rooms.get(roomCode);

  if (!room) return false;

  const player = room.players.get(playerId);

  if (!player) return false;

  player.socketId = socketId;
  player.connected = true;

  return true;
}


// Temporarily mark a player as disconnected
function markPlayerDisconnected(roomCode, playerId, socketId) {

  const room = rooms.get(roomCode);

  if (!room) return null;

  const player = room.players.get(playerId);

  if (!player) return null;

  // Ignore disconnect events from an older connection
  if (player.socketId !== socketId) {
    return null;
  }

  player.connected = false;
  player.socketId = null;

  return getPublicRoom(room);
}


module.exports = {
  createRoom,
  joinRoom,
  findPlayerRoom,
  startGame,
  removePlayer,
  getPublicRoom,
  getRoom,
  getPlayer,
  updatePlayerSocket,
  markPlayerDisconnected
};
