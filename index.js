
import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";
import { randomBytes } from "crypto";

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;
const rooms = new Map();

function generateRoomCode() {
  let code;

  do {
    code = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));

  return code;
}

function getRoomUsers(room) {
  return Array.from(room.users.values());
}

function emitRoomUsers(roomCode) {
  const room = rooms.get(roomCode);

  if (room) {
    io.to(roomCode).emit("room_users", {
      users: getRoomUsers(room)
    });
  }
}

function canControl(room, socketId) {
  const user = room.users.get(socketId);
  return user && ["Host", "Moderator"].includes(user.role);
}

function sendError(socket, message) {
  socket.emit("error_message", { message });
}

function applyPlaybackAction(room, action, data = {}) {
  if (!["play", "pause", "seek", "change_video"].includes(action)) {
    return false;
  }

  if (action === "play") {
    room.playing = true;
  }

  if (action === "pause") {
    room.playing = false;
  }

  if (action === "seek") {
    const time = Number(data.currentTime);

    if (!Number.isFinite(time) || time < 0) {
      return false;
    }

    room.currentTime = time;
  }

  if (action === "change_video") {
    const videoId = data.videoId;

    if (
      typeof videoId !== "string" ||
      !/^[a-zA-Z0-9_-]{11}$/.test(videoId)
    ) {
      return false;
    }

    room.videoId = videoId;
    room.currentTime = 0;
    room.playing = false;
  }

  return true;
}

function broadcastPlayback(roomCode, room, action) {
  io.to(roomCode).emit("playback_updated", {
    action,
    videoId: room.videoId,
    currentTime: room.currentTime,
    playing: room.playing
  });
}

app.get("/health", (req, res) => {
  res.json({
    status: "Server is running",
    activeRooms: rooms.size
  });
});

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // CREATE ROOM
  socket.on("create_room", ({ name } = {}) => {
    const roomCode = generateRoomCode();

    const room = {
      hostId: socket.id,
      videoId: "jfKfPfyJRdk",
      currentTime: 0,
      playing: false,
      users: new Map(),
      requests: []
    };

    room.users.set(socket.id, {
      id: socket.id,
      name: name?.trim() || "Host",
      role: "Host"
    });

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit("room_created", {
      roomCode,
      role: "Host",
      videoId: room.videoId,
      currentTime: room.currentTime,
      playing: room.playing,
      users: getRoomUsers(room),
      requests: []
    });

    console.log("Room created:", roomCode);
  });

  // JOIN ROOM
  socket.on("join_room", ({ name, roomCode } = {}) => {
    const code = roomCode?.trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      sendError(socket, "Room not found. Check the room code.");
      return;
    }

    if (room.users.has(socket.id)) return;

    const user = {
      id: socket.id,
      name: name?.trim() || "Participant",
      role: "Participant"
    };

    room.users.set(socket.id, user);
    socket.join(code);

    socket.emit("room_joined", {
      roomCode: code,
      role: user.role,
      videoId: room.videoId,
      currentTime: room.currentTime,
      playing: room.playing,
      users: getRoomUsers(room),
      requests: room.requests
    });

    socket.to(code).emit("user_joined", {
      users: getRoomUsers(room)
    });

    emitRoomUsers(code);

    console.log(user.name, "joined room:", code);
  });

  // PLAYBACK ACTIONS
  socket.on("playback_action", ({ roomCode, action, ...data } = {}) => {
    const room = rooms.get(roomCode);

    if (!room || !canControl(room, socket.id)) {
      sendError(socket, "You do not have permission to control playback.");
      return;
    }

    if (!applyPlaybackAction(room, action, data)) {
      sendError(socket, "Invalid playback action or video details.");
      return;
    }

    broadcastPlayback(roomCode, room, action);
  });

  // SYNC POSITION
  socket.on("time_update", ({ roomCode, currentTime } = {}) => {
    const room = rooms.get(roomCode);

    if (!room || !canControl(room, socket.id)) return;

    if (
      typeof currentTime !== "number" ||
      !Number.isFinite(currentTime)
    ) {
      return;
    }

    room.currentTime = Math.max(0, currentTime);
  });

  // ASSIGN MODERATOR
  socket.on("assign_role", ({ roomCode, userId, role } = {}) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) {
      sendError(socket, "Only the Host can assign roles.");
      return;
    }

    if (!["Moderator", "Participant"].includes(role)) {
      sendError(socket, "Invalid role.");
      return;
    }

    const targetUser = room.users.get(userId);

    if (!targetUser || userId === room.hostId) return;

    targetUser.role = role;

    io.to(userId).emit("role_updated", {
      userId,
      role,
      users: getRoomUsers(room)
    });

    emitRoomUsers(roomCode);

    console.log(targetUser.name, "role updated to:", role);
  });

  // REMOVE PARTICIPANT
  socket.on("remove_participant", ({ roomCode, userId } = {}) => {
    const room = rooms.get(roomCode);

    if (!room || room.hostId !== socket.id) {
      sendError(socket, "Only the Host can remove participants.");
      return;
    }

    if (!userId || userId === room.hostId) return;

    const targetUser = room.users.get(userId);

    if (!targetUser) return;

    room.users.delete(userId);

    const targetSocket = io.sockets.sockets.get(userId);

    if (targetSocket) {
      targetSocket.leave(roomCode);
      targetSocket.emit("participant_removed", {
        message: "You were removed from the room."
      });
    }

    emitRoomUsers(roomCode);

    console.log(targetUser.name, "removed from room:", roomCode);
  });

  // PARTICIPANT REQUEST
  socket.on("request_action", ({ roomCode, action, ...data } = {}) => {
    const room = rooms.get(roomCode);
    const user = room?.users.get(socket.id);

    if (!room || !user || user.role !== "Participant") {
      return;
    }

    if (!["play", "pause", "seek", "change_video"].includes(action)) {
      sendError(socket, "Invalid playback request.");
      return;
    }

    const request = {
      id: randomBytes(4).toString("hex"),
      userId: socket.id,
      name: user.name,
      action,
      ...data
    };

    room.requests.push(request);

    io.to(room.hostId).emit("action_requested", {
      requests: room.requests
    });

    console.log("Playback request:", action, "from", user.name);
  });

  // APPROVE OR REJECT REQUEST
  socket.on("approve_request", ({ roomCode, requestId, approved } = {}) => {
    const room = rooms.get(roomCode);

    if (!room || !canControl(room, socket.id)) {
      sendError(socket, "You cannot approve this request.");
      return;
    }

    const index = room.requests.findIndex(
      (request) => request.id === requestId
    );

    if (index === -1) return;

    const request = room.requests.splice(index, 1)[0];

    if (approved) {
      const requestData = {
        currentTime: request.currentTime,
        videoId: request.videoId
      };

      const valid = applyPlaybackAction(
        room,
        request.action,
        requestData
      );

      if (valid) {
        broadcastPlayback(roomCode, room, request.action);
      } else {
        io.to(request.userId).emit("error_message", {
          message: "Your playback request contained invalid details."
        });
      }
    } else {
      io.to(request.userId).emit("error_message", {
        message: "Your playback request was rejected."
      });
    }

    io.to(room.hostId).emit("request_updated", {
      requests: room.requests
    });
  });

  // LEAVE ROOM
  socket.on("leave_room", ({ roomCode } = {}) => {
    leaveRoom(socket, roomCode);
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    for (const roomCode of [...rooms.keys()]) {
      leaveRoom(socket, roomCode);
    }
  });
});

function leaveRoom(socket, roomCode) {
  const room = rooms.get(roomCode);

  if (!room || !room.users.has(socket.id)) return;

  const wasHost = room.hostId === socket.id;

  room.users.delete(socket.id);
  socket.leave(roomCode);

  if (wasHost || room.users.size === 0) {
    for (const userId of room.users.keys()) {
      io.to(userId).emit("participant_removed", {
        message: "The Host has closed the room."
      });
    }

    io.to(roomCode).emit("room_closed");
    rooms.delete(roomCode);

    console.log("Room closed:", roomCode);
    return;
  }

  io.to(roomCode).emit("user_left", {
    users: getRoomUsers(room)
  });

  emitRoomUsers(roomCode);
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
