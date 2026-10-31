import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { randomBytes } from "crypto";

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());

const rooms = new Map();

app.get("/", (_req, res) => {
  res.send("YouTube Watch Party server is running.");
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", activeRooms: rooms.size });
});

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

function normalizeRoomCode(code) {
  return typeof code === "string"
    ? code.trim().toUpperCase()
    : "";
}

function generateRoomCode() {
  let code;

  do {
    code = randomBytes(3).toString("hex").toUpperCase();
  } while (rooms.has(code));

  return code;
}

function publicUsers(room) {
  return [...room.users.entries()].map(([id, user]) => ({
    id,
    name: user.name,
    role: user.role
  }));
}

function sendError(socket, message) {
  socket.emit("error_message", { message });
}

function canControl(room, socketId) {
  const user = room?.users.get(socketId);

  return Boolean(
    user && ["Host", "Moderator"].includes(user.role)
  );
}

function emitUsers(roomCode) {
  const room = rooms.get(roomCode);

  if (room) {
    io.to(roomCode).emit("room_users", {
      users: publicUsers(room)
    });
  }
}

function applyPlaybackAction(room, action, data = {}) {
  if (!["play", "pause", "seek", "change_video"].includes(action)) {
    return null;
  }

  if (action === "play") {
    room.playing = true;
  } else if (action === "pause") {
    room.playing = false;
  } else if (action === "seek") {
    const currentTime = Number(data.currentTime);

    if (!Number.isFinite(currentTime) || currentTime < 0) {
      return null;
    }

    room.currentTime = currentTime;
  } else if (action === "change_video") {
    const videoId = String(data.videoId || "");

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      return null;
    }

    room.videoId = videoId;
    room.currentTime = 0;
    room.playing = false;
  }

  return {
    action,
    videoId: room.videoId,
    currentTime: room.currentTime,
    playing: room.playing
  };
}

function broadcastPlayback(roomCode, update) {
  io.to(roomCode).emit("playback_updated", update);
}

function removeParticipant(roomCode, userId) {
  const room = rooms.get(roomCode);

  if (!room || !room.users.has(userId)) {
    return null;
  }

  const removed = room.users.get(userId);

  room.users.delete(userId);

  const targetSocket = io.sockets.sockets.get(userId);

  if (targetSocket) {
    targetSocket.leave(roomCode);

    targetSocket.emit("participant_removed", {
      message: "You were removed from the room."
    });
  }

  emitUsers(roomCode);

  console.log(`${removed.name} removed from room ${roomCode}`);

  return removed;
}

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  socket.on("create_room", ({ name } = {}) => {
    const cleanName = String(name || "").trim().slice(0, 40);

    if (!cleanName) {
      return sendError(socket, "Please enter your name.");
    }

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
      name: cleanName,
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
      users: publicUsers(room),
      requests: []
    });

    console.log(`Room ${roomCode} created by ${cleanName}`);
  });

  socket.on("join_room", ({ name, roomCode } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const cleanName = String(name || "").trim().slice(0, 40);

    const room = rooms.get(code);

    if (!cleanName || !code) {
      return sendError(socket, "Enter your name and room code.");
    }

    if (!room) {
      return sendError(socket, "Room not found. Check the room code.");
    }

    room.users.set(socket.id, {
      name: cleanName,
      role: "Participant"
    });

    socket.join(code);

    socket.emit("room_joined", {
      roomCode: code,
      role: "Participant",
      videoId: room.videoId,
      currentTime: room.currentTime,
      playing: room.playing,
      users: publicUsers(room),
      requests: []
    });

    socket.to(code).emit("user_joined", {
      users: publicUsers(room)
    });

    console.log(`${cleanName} joined room ${code}`);
  });

  socket.on("playback_action", ({ roomCode, action, ...data } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || !room.users.has(socket.id)) {
      return sendError(socket, "You are not in this room.");
    }

    if (!canControl(room, socket.id)) {
      return sendError(
        socket,
        "Only the Host or Moderator can control playback."
      );
    }

    const update = applyPlaybackAction(room, action, data);

    if (!update) {
      return sendError(
        socket,
        "Invalid playback action or YouTube video ID."
      );
    }

    broadcastPlayback(code, update);
  });

  socket.on("request_action", ({ roomCode, action, ...data } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);
    const user = room?.users.get(socket.id);

    if (!room || !user) {
      return sendError(socket, "You are not in this room.");
    }

    if (user.role !== "Participant") {
      return sendError(
        socket,
        "Your role does not require approval."
      );
    }

    if (!["play", "pause", "seek", "change_video"].includes(action)) {
      return sendError(socket, "Invalid playback request.");
    }

    if (
      action === "change_video" &&
      !/^[A-Za-z0-9_-]{11}$/.test(String(data.videoId || ""))
    ) {
      return sendError(socket, "Invalid YouTube video ID.");
    }

    if (
      action === "seek" &&
      (!Number.isFinite(Number(data.currentTime)) ||
        Number(data.currentTime) < 0)
    ) {
      return sendError(socket, "Invalid seek position.");
    }

    const request = {
      id: randomBytes(4).toString("hex"),
      userId: socket.id,
      name: user.name,
      action,
      ...(action === "seek"
        ? { currentTime: Number(data.currentTime) }
        : {}),
      ...(action === "change_video"
        ? { videoId: data.videoId }
        : {})
    };

    room.requests.push(request);

    io.to(room.hostId).emit("action_requested", {
      requests: room.requests
    });

    socket.emit("request_sent", {
      requestId: request.id
    });

    console.log(
      `Request ${action} from ${user.name} sent to Host in ${code}`
    );
  });
    socket.on("approve_request", ({ roomCode, requestId, approved } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || !canControl(room, socket.id)) {
      return sendError(
        socket,
        "Only the Host or Moderator can approve requests."
      );
    }

    const index = room.requests.findIndex(
      (request) => request.id === requestId
    );

    if (index === -1) {
      return sendError(socket, "Request not found or already handled.");
    }

    const request = room.requests.splice(index, 1)[0];

    if (approved) {
      const update = applyPlaybackAction(
        room,
        request.action,
        request
      );

      if (update) {
        broadcastPlayback(code, update);
      } else {
        const requester = io.sockets.sockets.get(request.userId);

        if (requester) {
          sendError(
            requester,
            "The requested action could not be applied."
          );
        }
      }
    } else {
      const requester = io.sockets.sockets.get(request.userId);

      if (requester) {
        sendError(
          requester,
          "Your request was rejected by the Host."
        );
      }
    }

    io.to(room.hostId).emit("request_updated", {
      requests: room.requests
    });
  });

  socket.on("assign_role", ({ roomCode, userId, role } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || room.hostId !== socket.id) {
      return sendError(socket, "Only the Host can assign roles.");
    }

    if (
      !room.users.has(userId) ||
      userId === room.hostId ||
      !["Moderator", "Participant"].includes(role)
    ) {
      return sendError(socket, "Invalid participant or role.");
    }

    room.users.get(userId).role = role;

    io.to(code).emit("role_updated", {
      userId,
      role,
      users: publicUsers(room)
    });
  });

  socket.on("remove_participant", ({ roomCode, userId } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || room.hostId !== socket.id) {
      socket.emit("remove_result", {
        success: false,
        message: "Only the Host can remove participants."
      });
      return;
    }

    if (userId === room.hostId) {
      socket.emit("remove_result", {
        success: false,
        message: "Host cannot remove themselves."
      });
      return;
    }

    const removed = removeParticipant(code, userId);

    socket.emit("remove_result", {
      success: Boolean(removed),
      message: removed
        ? `${removed.name} removed successfully.`
        : "Participant not found."
    });
  });

  socket.on("leave_room", ({ roomCode } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || !room.users.has(socket.id)) {
      return;
    }

    const user = room.users.get(socket.id);

    if (room.hostId === socket.id) {
      io.to(code).emit("room_closed", {
        message: "The Host has closed the room."
      });

      for (const userId of room.users.keys()) {
        const memberSocket = io.sockets.sockets.get(userId);

        if (memberSocket) {
          memberSocket.leave(code);
        }
      }

      rooms.delete(code);
      console.log(`Room ${code} closed by Host`);
      return;
    }

    room.users.delete(socket.id);
    socket.leave(code);

    io.to(code).emit("user_left", {
      users: publicUsers(room),
      name: user.name
    });

    console.log(`${user.name} left room ${code}`);
  });

  socket.on("time_update", ({ roomCode, currentTime } = {}) => {
    const code = normalizeRoomCode(roomCode);
    const room = rooms.get(code);

    if (!room || !canControl(room, socket.id)) {
      return;
    }

    const time = Number(currentTime);

    if (Number.isFinite(time) && time >= 0) {
      room.currentTime = time;
    }
  });

  socket.on("disconnect", () => {
    console.log("Disconnected:", socket.id);

    for (const [roomCode, room] of rooms.entries()) {
      if (!room.users.has(socket.id)) {
        continue;
      }

      const user = room.users.get(socket.id);

      if (room.hostId === socket.id) {
        io.to(roomCode).emit("room_closed", {
          message: "The Host has disconnected. Room closed."
        });

        rooms.delete(roomCode);
        continue;
      }

      room.users.delete(socket.id);

      io.to(roomCode).emit("user_left", {
        users: publicUsers(room),
        name: user.name
      });
    }
  });
});

const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});