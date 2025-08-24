(() => {
  const socket = io();

  // State
  let currentRoomId = null;
  let isHost = false;
  let mySocketId = null;

  // Elements
  const landingEl = document.getElementById("landing");
  const lobbyEl = document.getElementById("lobby");
  const gameEl = document.getElementById("game");
  const revealEl = document.getElementById("reveal");
  const gameoverEl = document.getElementById("gameover");

  const nameInput = document.getElementById("nameInput");
  const roomInput = document.getElementById("roomInput");
  const joinNameInput = document.getElementById("joinNameInput");
  const createBtn = document.getElementById("createBtn");
  const joinBtn = document.getElementById("joinBtn");
  const startBtn = document.getElementById("startBtn");
  const revealBtn = document.getElementById("revealBtn");
  const nextBtn = document.getElementById("nextBtn");
  const endBtn = document.getElementById("endBtn");
  const playAgainBtn = document.getElementById("playAgainBtn");

  const hostBadge = document.getElementById("hostBadge");
  const roomCode = document.getElementById("roomCode");
  const playersList = document.getElementById("playersList");

  const questionCounter = document.getElementById("questionCounter");
  const questionPrompt = document.getElementById("questionPrompt");
  const choicesEl = document.getElementById("choices");
  const progressEl = document.getElementById("progress");

  const revealTitle = document.getElementById("revealTitle");
  const correctAnswer = document.getElementById("correctAnswer");
  const scoreboard = document.getElementById("scoreboard");
  const finalBoard = document.getElementById("finalBoard");

  function show(section) {
    for (const el of [landingEl, lobbyEl, gameEl, revealEl, gameoverEl]) {
      if (!el) continue;
      el.classList.add("hidden");
    }
    section.classList.remove("hidden");
  }

  function setHostUI() {
    hostBadge.classList.toggle("hidden", !isHost);
    startBtn.classList.toggle("hidden", !isHost);
    revealBtn.classList.toggle("hidden", !isHost);
    nextBtn.classList.toggle("hidden", !isHost);
    endBtn.classList.toggle("hidden", !isHost);
  }

  function setChoicesEnabled(enabled) {
    for (const btn of choicesEl.querySelectorAll("button")) {
      btn.disabled = !enabled;
    }
  }

  // Socket lifecycle
  socket.on("connect", () => {
    mySocketId = socket.id;
  });

  // Lobby events
  socket.on("lobbyUpdate", (payload) => {
    if (!payload) return;
    currentRoomId = payload.roomId;
    isHost = payload.hostSocketId === mySocketId;
    setHostUI();
    roomCode.textContent = payload.roomId;
    playersList.innerHTML = "";
    payload.players.forEach((p) => {
      const li = document.createElement("li");
      li.textContent = `${p.name}`;
      const score = document.createElement("span");
      score.className = "score";
      score.textContent = ` ${p.score}`;
      li.appendChild(score);
      if (p.socketId === payload.hostSocketId) {
        const b = document.createElement("span");
        b.className = "badge";
        b.style.marginLeft = "8px";
        b.textContent = "Host";
        li.appendChild(b);
      }
      playersList.appendChild(li);
    });
  });

  // Game events
  socket.on("gameStarted", ({ total }) => {
    show(gameEl);
    progressEl.textContent = "";
    revealBtn.disabled = false;
  });

  socket.on("question", ({ index, total, prompt, choices }) => {
    show(gameEl);
    questionCounter.textContent = `Question ${index} of ${total}`;
    questionPrompt.textContent = prompt;
    choicesEl.innerHTML = "";
    progressEl.textContent = "";
    choices.forEach((choice, i) => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = choice;
      btn.addEventListener("click", () => {
        setChoicesEnabled(false);
        btn.classList.add("selected");
        socket.emit("submitAnswer", { roomId: currentRoomId, selectedIndex: i }, (res) => {
          if (!res?.ok) {
            // allow retry if rejected
            setChoicesEnabled(true);
            btn.classList.remove("selected");
            alert(res?.error || "Failed to submit");
          }
        });
      });
      choicesEl.appendChild(btn);
    });
  });

  socket.on("answersProgress", ({ answered, total }) => {
    progressEl.textContent = `${answered}/${total} answered`;
  });

  socket.on("reveal", ({ correctIndex, scoreboard: board }) => {
    show(revealEl);
    revealTitle.textContent = "Correct Answer";
    const choiceButtons = document.querySelectorAll(".choice");
    choiceButtons.forEach((btn, i) => {
      btn.classList.toggle("correct", i === correctIndex);
      if (i !== correctIndex) btn.classList.add("incorrect");
    });
    correctAnswer.textContent = choiceButtons[correctIndex]?.textContent || "";
    scoreboard.innerHTML = "";
    board.forEach((p, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${idx + 1}. ${p.name}</strong> <span class="spacer"></span> <span class="score">${p.score}</span>`;
      scoreboard.appendChild(li);
    });
  });

  socket.on("gameOver", ({ scoreboard: board }) => {
    show(gameoverEl);
    finalBoard.innerHTML = "";
    board.forEach((p, idx) => {
      const li = document.createElement("li");
      li.innerHTML = `<strong>${idx + 1}. ${p.name}</strong> <span class="spacer"></span> <span class="score">${p.score}</span>`;
      finalBoard.appendChild(li);
    });
  });

  // Buttons
  createBtn.addEventListener("click", () => {
    const name = nameInput.value.trim() || "Host";
    socket.emit("createRoom", { name }, (res) => {
      if (!res?.ok) return alert(res?.error || "Failed to create");
      currentRoomId = res.roomId;
      isHost = !!res.isHost;
      setHostUI();
      roomCode.textContent = currentRoomId;
      show(lobbyEl);
    });
  });

  joinBtn.addEventListener("click", () => {
    const roomId = roomInput.value.trim().toUpperCase();
    const name = joinNameInput.value.trim() || "Player";
    if (!roomId) return alert("Enter a room code");
    socket.emit("joinRoom", { roomId, name }, (res) => {
      if (!res?.ok) return alert(res?.error || "Failed to join");
      currentRoomId = res.roomId;
      isHost = !!res.isHost;
      setHostUI();
      roomCode.textContent = currentRoomId;
      show(lobbyEl);
    });
  });

  startBtn.addEventListener("click", () => {
    socket.emit("startGame", { roomId: currentRoomId }, (res) => {
      if (!res?.ok) alert("Failed to start");
    });
  });

  revealBtn.addEventListener("click", () => {
    socket.emit("revealAnswer", { roomId: currentRoomId }, (res) => {
      if (!res?.ok) alert("Only host can reveal now");
    });
  });

  nextBtn.addEventListener("click", () => {
    socket.emit("nextQuestion", { roomId: currentRoomId }, (res) => {
      if (!res?.ok) alert("Only host can go next now");
    });
  });

  endBtn.addEventListener("click", () => {
    socket.emit("endGame", { roomId: currentRoomId }, (res) => {
      if (!res?.ok) alert("Only host can end now");
    });
  });

  playAgainBtn.addEventListener("click", () => {
    show(lobbyEl);
  });
})();

