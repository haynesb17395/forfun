"use strict";

const path = require("path");
const fs = require("fs");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");
const { customAlphabet } = require("nanoid");

const PORT = process.env.PORT || 3000;

// App and HTTP server
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*" }
});

// Data loading
const QUESTIONS_PATH = path.join(__dirname, "data", "questions.json");
const ALL_QUESTIONS = JSON.parse(fs.readFileSync(QUESTIONS_PATH, "utf8"));

// In-memory rooms
/**
 * Room shape:
 * {
 *   hostSocketId: string,
 *   playersBySocketId: Map<socketId, { name: string, score: number, hasAnswered: boolean, selectedIndex: number | null }>,
 *   state: "lobby" | "question" | "reveal" | "finished",
 *   questions: Array<{ id: string, prompt: string, choices: string[], correctIndex: number }>,
 *   currentIndex: number
 * }
 */
const roomsById = new Map();
const generateRoomId = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 5);

function chooseRandomQuestions(all, count) {
  const copy = [...all];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.max(1, Math.min(copy.length, count)));
}

function serializeLobby(roomId) {
  const room = roomsById.get(roomId);
  const players = [];
  for (const [socketId, p] of room.playersBySocketId.entries()) {
    players.push({ socketId, name: p.name, score: p.score });
  }
  return {
    roomId,
    hostSocketId: room.hostSocketId,
    players
  };
}

function broadcastLobby(roomId) {
  io.to(roomId).emit("lobbyUpdate", serializeLobby(roomId));
}

function sendQuestion(roomId) {
  const room = roomsById.get(roomId);
  const q = room.questions[room.currentIndex];
  const payload = {
    roomId,
    index: room.currentIndex + 1,
    total: room.questions.length,
    prompt: q.prompt,
    choices: q.choices
  };
  io.to(roomId).emit("question", payload);
}

function revealAnswer(roomId) {
  const room = roomsById.get(roomId);
  const q = room.questions[room.currentIndex];

  // Score: +1000 for correct
  for (const player of room.playersBySocketId.values()) {
    if (player.selectedIndex === q.correctIndex) {
      player.score += 1000;
    }
  }

  const scoreboard = [...room.playersBySocketId.entries()]
    .map(([socketId, p]) => ({ socketId, name: p.name, score: p.score, selectedIndex: p.selectedIndex }))
    .sort((a, b) => b.score - a.score);

  io.to(roomId).emit("reveal", {
    roomId,
    index: room.currentIndex + 1,
    total: room.questions.length,
    correctIndex: q.correctIndex,
    scoreboard
  });
}

function resetAnswers(roomId) {
  const room = roomsById.get(roomId);
  for (const p of room.playersBySocketId.values()) {
    p.hasAnswered = false;
    p.selectedIndex = null;
  }
}

io.on("connection", (socket) => {
  // Helper to verify host
  function isHost(roomId) {
    const room = roomsById.get(roomId);
    return room && room.hostSocketId === socket.id;
  }

  socket.on("createRoom", ({ name }, ack) => {
    const roomId = generateRoomId();
    const room = {
      hostSocketId: socket.id,
      playersBySocketId: new Map(),
      state: "lobby",
      questions: [],
      currentIndex: 0
    };
    roomsById.set(roomId, room);
    socket.join(roomId);
    // Host also appears as a player
    room.playersBySocketId.set(socket.id, {
      name: name && String(name).trim() ? String(name).trim() : "Host",
      score: 0,
      hasAnswered: false,
      selectedIndex: null
    });
    if (typeof ack === "function") ack({ ok: true, roomId, isHost: true });
    broadcastLobby(roomId);
  });

  socket.on("joinRoom", ({ roomId, name }, ack) => {
    const room = roomsById.get(roomId);
    if (!room) {
      if (typeof ack === "function") ack({ ok: false, error: "Room not found" });
      return;
    }
    socket.join(roomId);
    room.playersBySocketId.set(socket.id, {
      name: name && String(name).trim() ? String(name).trim() : "Player",
      score: 0,
      hasAnswered: false,
      selectedIndex: null
    });
    if (typeof ack === "function") ack({ ok: true, roomId, isHost: room.hostSocketId === socket.id });
    broadcastLobby(roomId);
  });

  socket.on("startGame", ({ roomId, numQuestions = 10 }, ack) => {
    const room = roomsById.get(roomId);
    if (!room || !isHost(roomId)) {
      if (typeof ack === "function") ack({ ok: false, error: "Only host can start" });
      return;
    }
    room.questions = chooseRandomQuestions(ALL_QUESTIONS, numQuestions);
    room.state = "question";
    room.currentIndex = 0;
    resetAnswers(roomId);
    io.to(roomId).emit("gameStarted", { roomId, total: room.questions.length });
    sendQuestion(roomId);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("submitAnswer", ({ roomId, selectedIndex }, ack) => {
    const room = roomsById.get(roomId);
    if (!room || room.state !== "question") {
      if (typeof ack === "function") ack({ ok: false, error: "Not accepting answers" });
      return;
    }
    const player = room.playersBySocketId.get(socket.id);
    if (!player) {
      if (typeof ack === "function") ack({ ok: false, error: "Not in room" });
      return;
    }
    if (player.hasAnswered) {
      if (typeof ack === "function") ack({ ok: false, error: "Already answered" });
      return;
    }
    player.hasAnswered = true;
    player.selectedIndex = typeof selectedIndex === "number" ? selectedIndex : null;
    const numPlayers = room.playersBySocketId.size;
    const numAnswered = [...room.playersBySocketId.values()].filter((p) => p.hasAnswered).length;
    io.to(roomId).emit("answersProgress", { answered: numAnswered, total: numPlayers });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("revealAnswer", ({ roomId }, ack) => {
    const room = roomsById.get(roomId);
    if (!room || !isHost(roomId) || room.state !== "question") {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    room.state = "reveal";
    revealAnswer(roomId);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("nextQuestion", ({ roomId }, ack) => {
    const room = roomsById.get(roomId);
    if (!room || !isHost(roomId) || room.state !== "reveal") {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    room.currentIndex += 1;
    if (room.currentIndex >= room.questions.length) {
      room.state = "finished";
      const finalBoard = [...room.playersBySocketId.entries()]
        .map(([socketId, p]) => ({ socketId, name: p.name, score: p.score }))
        .sort((a, b) => b.score - a.score);
      io.to(roomId).emit("gameOver", { roomId, scoreboard: finalBoard });
      if (typeof ack === "function") ack({ ok: true });
      return;
    }
    room.state = "question";
    resetAnswers(roomId);
    sendQuestion(roomId);
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("endGame", ({ roomId }, ack) => {
    const room = roomsById.get(roomId);
    if (!room || !isHost(roomId)) {
      if (typeof ack === "function") ack({ ok: false });
      return;
    }
    room.state = "finished";
    const finalBoard = [...room.playersBySocketId.entries()]
      .map(([socketId, p]) => ({ socketId, name: p.name, score: p.score }))
      .sort((a, b) => b.score - a.score);
    io.to(roomId).emit("gameOver", { roomId, scoreboard: finalBoard });
    if (typeof ack === "function") ack({ ok: true });
  });

  socket.on("disconnect", () => {
    // Remove from any room, possibly promote host
    for (const [roomId, room] of roomsById.entries()) {
      if (room.playersBySocketId.has(socket.id)) {
        room.playersBySocketId.delete(socket.id);
        // If host left, promote first remaining player if any
        if (room.hostSocketId === socket.id) {
          const firstRemaining = room.playersBySocketId.keys().next().value;
          room.hostSocketId = firstRemaining || null;
        }
        broadcastLobby(roomId);
        // If room is empty, delete it
        if (room.playersBySocketId.size === 0) {
          roomsById.delete(roomId);
        }
        break;
      }
    }
  });
});

httpServer.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Trivia server listening on http://localhost:${PORT}`);
});

