
const gameManager = require("./gameManager");

const {
  createRoom,
  joinRoom,
  findPlayerRoom,
  startGame,
  removePlayer,
  getPublicRoom,
  updatePlayerSocket,
  markPlayerDisconnected,
  getRoom,
  getPlayer
} = require("./gameManager");

const gameLogic = require("./gameLogic");

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

        const player = gameManager.getPlayer(roomCode, playerId);

        if (!player) {
          throw new Error("Player is not registered in this room.");
        }

        // Restore the player's new Socket.IO connection.
        const restored = gameManager.updatePlayerSocket(
          roomCode,
          playerId,
          socket.id
        );

        if (!restored) {
          throw new Error("Unable to restore player connection.");
        }

        // Join the existing Socket.IO room.
        socket.join(roomCode);

        // Restore the socket's player information.
        socket.data.playerId = playerId;
        socket.data.roomCode = roomCode;

        // IMPORTANT: Convert the internal room Map into a public array.
        const publicRoom = gameManager.getPublicRoom(room);

        console.log(
          `${player.name} reconnected to room ${roomCode}`
        );

        console.log(
          "Restored room players:",
          publicRoom.players.map((p) => ({
            name: p.name,
            connected: p.connected
          }))
        );

        // Notify all players with the correctly formatted room.
        io.to(roomCode).emit("ROOM_UPDATE", publicRoom);

        // Return the same public room structure to the reconnecting player.
        if (typeof callback === "function") {
          callback({
            success: true,
            room: publicRoom,
            playerName: player.name
          });
        }

      } catch (error) {
        console.error("RESUME_ROOM error:", error.message);

        if (typeof callback === "function") {
          callback({
            success: false,
            message: error.message
          });
        }
      }
    });

    // START GAME
    socket.on("START_GAME", (callback) => {
      try {
        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "You are not in a room."
            });
          }
          return;
        }

        // Step 1: Validate host and update room status.
        const result = startGame(roomCode, playerId);

        if (!result.success) {
          if (typeof callback === "function") {
            callback(result);
          }
          return;
        }

        // Step 2: Initialise rounds, drawer, word and timer.
        const gameResult = gameLogic.startGame(io, roomCode);

        if (!gameResult.success) {
          if (typeof callback === "function") {
            callback(gameResult);
          }
          return;
        }

        // Step 3: Get updated room information.
        const updatedRoom = getPublicRoom(getRoom(roomCode));

        // Step 4: Notify all players.
        io.to(roomCode).emit("ROOM_UPDATE", updatedRoom);
        io.to(roomCode).emit("GAME_STARTED");

        // Step 5: Respond to the host.
        if (typeof callback === "function") {
          callback({
            success: true,
            room: updatedRoom
          });
        }

        console.log(`Game successfully started in room ${roomCode}`);

      } catch (error) {
        console.error("START_GAME error:", error);

        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Unable to start game. Please try again."
          });
        }
      }
    });


    
    // Return everyone to the same room for a rematch.
    
    // Player requests a rematch.
    socket.on("PLAY_AGAIN", (callback) => {
      try {
        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "You are not in a room."
            });
          }
          return;
        }

        const result = gameLogic.prepareRematch(roomCode, playerId);

        if (!result.success) {
          if (typeof callback === "function") {
            callback(result);
          }
          return;
        }

        const room = gameManager.getRoom(roomCode);
        const requester = gameManager.getPlayer(roomCode, playerId);

        // Send invitation to every other connected player.
        for (const [id, player] of room.players.entries()) {
          if (
            id !== playerId &&
            player.connected &&
            player.socketId
          ) {
            io.to(player.socketId).emit("REMATCH_REQUEST", {
              roomCode,
              requesterId: playerId,
              requesterName: requester.name
            });
          }
        }

        // Update room information for everyone.
        io.to(roomCode).emit("ROOM_UPDATE", result.room);

        // Only the requester is moved to the lobby.
        socket.emit("RETURN_TO_LOBBY", result.room);

        if (typeof callback === "function") {
          callback({
            success: true,
            room: result.room
          });
        }

      } catch (error) {
        console.error("PLAY_AGAIN error:", error);

        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Unable to request a rematch."
          });
        }
      }
    });

    // Player accepts the rematch invitation.
    socket.on("ACCEPT_REMATCH", (callback) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;

      const result = gameLogic.acceptRematch(roomCode, playerId);

      if (!result.success) {
        if (typeof callback === "function") {
          callback(result);
        }
        return;
      }

      io.to(roomCode).emit("ROOM_UPDATE", result.room);

      // Move only the accepting player to the existing lobby.
      socket.emit("RETURN_TO_LOBBY", result.room);

      if (typeof callback === "function") {
        callback({
          success: true,
          room: result.room
        });
      }
    });

    // Player declines the rematch invitation.
    socket.on("DECLINE_REMATCH", (callback) => {
      try {
        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "You are not in a room."
            });
          }
          return;
        }

        const room = gameManager.getRoom(roomCode);
        const player = gameManager.getPlayer(roomCode, playerId);

        if (!room || !player) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "Room or player not found."
            });
          }
          return;
        }

        const playerName = player.name;

        // Remove the declining player from the existing room.
        gameManager.removePlayer(roomCode, playerId);

        // Disconnect this socket from the room.
        socket.leave(roomCode);

        delete socket.data.roomCode;
        delete socket.data.playerId;

        // Retrieve the latest room directly from the room manager.
        const remainingRoom = gameManager.getRoom(roomCode);

        let publicRoom = null;

        if (remainingRoom) {
          // The room must remain in the waiting state for the rematch.
          remainingRoom.status = "waiting";

          publicRoom = gameManager.getPublicRoom(remainingRoom);

          // Send the updated player list to everyone still in the room.
          io.to(roomCode).emit("ROOM_UPDATE", publicRoom);
        }

        console.log(
          `${playerName} declined the rematch and left room ${roomCode}.`
        );

        if (typeof callback === "function") {
          callback({
            success: true,
            message: "You declined the rematch.",
            room: publicRoom
          });
        }

      } catch (error) {
        console.error("DECLINE_REMATCH error:", error);

        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Unable to decline the rematch."
          });
        }
      }
    });


    
    
    // Receive a drawing segment and broadcast it to other players.
    socket.on("DRAW_STROKE", (data) => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;

      if (!roomCode || !playerId || !data) return;

      const room = getRoom(roomCode);
      const player = getPlayer(roomCode, playerId);

      // Only valid players in an active game can draw.
      if (!room || !player || room.status !== "playing") return;

      // Only the selected drawer is allowed to draw.
      if (!gameLogic.canDraw(roomCode, playerId)) {
        return;
      }

      const { color, width, tool, points } = data;

      // Validate drawing data.
      if (
        typeof color !== "string" ||
        !/^#[0-9a-fA-F]{6}$/.test(color) ||
        !Number.isFinite(width) ||
        width < 1 ||
        width > 30 ||
        !["brush", "eraser"].includes(tool) ||
        !Array.isArray(points) ||
        points.length < 1 ||
        points.length > 2
      ) {
        return;
      }

      const validPoints = points.every(
        (point) =>
          point &&
          Number.isFinite(point.x) &&
          Number.isFinite(point.y) &&
          point.x >= 0 &&
          point.x <= 1 &&
          point.y >= 0 &&
          point.y <= 1
      );

      if (!validPoints) return;

      // Save the segment so it can be restored after reconnection.
      const saved = gameLogic.recordDrawingSegment(
        roomCode,
        playerId,
        {
          color,
          width,
          tool,
          points
        }
      );

      if (!saved) {
        return;
      }

      // Send to everyone in the room except the sender.
      socket.to(roomCode).emit("DRAW_STROKE", {
        color,
        width,
        tool,
        points
      });
    });

    // Clear the canvas for everyone in the room.
    socket.on("CLEAR_CANVAS", () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;

      if (!roomCode || !playerId) return;

      const room = getRoom(roomCode);
      const player = getPlayer(roomCode, playerId);

      if (!room || !player || room.status !== "playing") return;

      if (!gameLogic.canDraw(roomCode, playerId)) {
        return;
      }

      const cleared = gameLogic.clearDrawingHistory(roomCode, playerId);

      if (!cleared) {
        return;
      }

      socket.to(roomCode).emit("CANVAS_CLEARED");
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

    
    // A player asks for the current game state.
    socket.on("GET_GAME_STATE", () => {
      const roomCode = socket.data.roomCode;
      const playerId = socket.data.playerId;

      if (!roomCode || !playerId) return;

      const state = gameLogic.getPublicState(roomCode);

      if (!state) return;

      socket.emit("GAME_STATE", state);

      // Only the drawer receives the secret word.
      gameLogic.sendPrivateWord(socket, roomCode, playerId);
    });


    // Receive a guess and let the backend validate it.
    socket.on("SUBMIT_GUESS", (data, callback) => {
      const guess = data && data.guess;
      const result = gameLogic.submitGuess(io, socket, guess);

      if (typeof callback === "function") {
        callback(result);
      }
    });


    
    // Send saved drawing history to a player who has reconnected.
    socket.on("GET_DRAWING_STATE", (callback) => {
      try {
        const roomCode = socket.data.roomCode;
        const playerId = socket.data.playerId;

        if (!roomCode || !playerId) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "Player is not in a room.",
              strokes: []
            });
          }
          return;
        }

        const room = gameManager.getRoom(roomCode);
        const player = gameManager.getPlayer(roomCode, playerId);

        if (!room || !player || player.socketId !== socket.id) {
          if (typeof callback === "function") {
            callback({
              success: false,
              message: "Invalid player connection.",
              strokes: []
            });
          }
          return;
        }

        const strokes = gameLogic.getDrawingHistory(roomCode);

        console.log(
          `Sending ${strokes.length} saved drawing segments to ${player.name}.`
        );

        if (typeof callback === "function") {
          callback({
            success: true,
            strokes
          });
        }

      } catch (error) {
        console.error("GET_DRAWING_STATE error:", error);

        if (typeof callback === "function") {
          callback({
            success: false,
            message: "Unable to restore drawing.",
            strokes: []
          });
        }
      }
    });




  });


}

module.exports = registerSocketHandlers;
