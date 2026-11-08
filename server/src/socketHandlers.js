
const gameManager = require("./gameManager");

function registerSocketHandlers(io) {

  io.on("connection", (socket) => {

    console.log("\n================================");
    console.log("NEW CLIENT CONNECTED");
    console.log("Socket ID:", socket.id);
    console.log("================================");

    // CREATE ROOM
    socket.on("CREATE_ROOM", (data, callback) => {

      try {

        const { playerId, playerName } = data || {};

        if (!playerId || !playerName?.trim()) {
          throw new Error("Player ID and nickname are required.");
        }

        if (playerName.trim().length > 15) {
          throw new Error("Nickname cannot exceed 15 characters.");
        }

        if (gameManager.findPlayerRoom(playerId)) {
          throw new Error("You are already in another room.");
        }

        const room = gameManager.createRoom(
          playerId,
          playerName.trim(),
          socket.id
        );

        socket.join(room.roomCode);

        socket.data.playerId = playerId;
        socket.data.roomCode = room.roomCode;

        console.log(
          `${playerName} created room ${room.roomCode}`
        );

        io.to(room.roomCode).emit("ROOM_UPDATE", room);

        if (typeof callback === "function") {
          callback({
            success: true,
            room
          });
        }

      } catch (error) {

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message
          });
        }

      }

    });

    // JOIN ROOM
    socket.on("JOIN_ROOM", (data, callback) => {

      try {

        const { playerId, playerName, roomCode } = data || {};

        if (!playerId || !playerName?.trim() || !roomCode) {
          throw new Error("Please provide all required information.");
        }

        if (playerName.trim().length > 15) {
          throw new Error("Nickname cannot exceed 15 characters.");
        }

        if (gameManager.findPlayerRoom(playerId)) {
          throw new Error("You are already in another room.");
        }

        const room = gameManager.joinRoom(
          roomCode.toUpperCase(),
          playerId,
          playerName.trim(),
          socket.id
        );

        socket.join(room.roomCode);

        socket.data.playerId = playerId;
        socket.data.roomCode = room.roomCode;

        console.log(
          `${playerName} joined room ${room.roomCode}`
        );

        io.to(room.roomCode).emit("ROOM_UPDATE", room);

        if (typeof callback === "function") {
          callback({
            success: true,
            room
          });
        }

      } catch (error) {

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message
          });
        }

      }

    });

    
    // RESUME ROOM AFTER BROWSER REFRESH
    socket.on("RESUME_ROOM", (data, callback) => {

    try {

        const { playerId, roomCode } = data || {};

        if (!playerId || !roomCode) {
        throw new Error("Invalid reconnection information.");
        }

        const room = gameManager.getRoom(roomCode);

        if (!room) {
        throw new Error("Game room no longer exists.");
        }

        const player = gameManager.getPlayer(
        roomCode,
        playerId
        );

        if (!player) {
        throw new Error("Player is not registered in this room.");
        }

        // Restore the player's new Socket.IO connection
        gameManager.updatePlayerSocket(
        roomCode,
        playerId,
        socket.id
        );

        // Join the existing Socket.IO room
        socket.join(roomCode);

        // Restore connection information
        socket.data.playerId = playerId;
        socket.data.roomCode = roomCode;

        // Get updated room information
        const updatedRoom = gameManager.getRoom(roomCode);

        console.log(
        `${player.name} reconnected to room ${roomCode}`
        );

        // Notify all players
        io.to(roomCode).emit("ROOM_UPDATE", updatedRoom);

        if (typeof callback === "function") {
        callback({
            success: true,
            room: updatedRoom,
            playerName: player.name
        });
        }

    } catch (error) {

        if (typeof callback === "function") {
        callback({
            success: false,
            message: error.message
        });
        }

    }

    });

    // START GAME
    socket.on("START_GAME", (data, callback) => {

      try {

        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          throw new Error("You are not in a game room.");
        }

        const room = gameManager.startGame(
          roomCode,
          playerId
        );

        io.to(roomCode).emit("ROOM_UPDATE", room);

        io.to(roomCode).emit("GAME_STARTED", {
          roomCode,
          message: "The game is starting!"
        });

        console.log(`Game started in room ${roomCode}`);

        if (typeof callback === "function") {
          callback({
            success: true,
            room
          });
        }

      } catch (error) {

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message
          });
        }

      }

    });

    // LEAVE ROOM
    socket.on("LEAVE_ROOM", (data, callback) => {

      try {

        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          throw new Error("You are not currently in a room.");
        }

        const result = gameManager.removePlayer(
          roomCode,
          playerId
        );

        socket.leave(roomCode);

        delete socket.data.roomCode;
        delete socket.data.playerId;

        if (result?.room) {
          io.to(roomCode).emit("ROOM_UPDATE", result.room);
        }

        console.log(`Player ${playerId} left room ${roomCode}`);

        if (typeof callback === "function") {
          callback({
            success: true
          });
        }

      } catch (error) {

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message
          });
        }

      }

    });

    
    // CLIENT DISCONNECTION
    socket.on("disconnect", (reason) => {

        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        console.log("\nCLIENT DISCONNECTED");
        console.log("Socket ID:", socket.id);
        console.log("Reason:", reason);

        if (roomCode && playerId) {

            // Do not remove the player.
            // Temporarily mark them as offline.
            const updatedRoom = gameManager.markPlayerDisconnected(
            roomCode,
            playerId,
            socket.id
            );

            if (updatedRoom) {

            io.to(roomCode).emit("PLAYER_DISCONNECTED", {
                playerId
            });

            io.to(roomCode).emit("ROOM_UPDATE", updatedRoom);

            console.log(
                `Player ${playerId} temporarily disconnected from ${roomCode}`
            );

            }

        }

    });


  });


}

module.exports = registerSocketHandlers;
