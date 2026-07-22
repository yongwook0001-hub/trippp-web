const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const overlayEl = document.getElementById("overlay");
const setupPanel = document.getElementById("setupPanel");
const nameForm = document.getElementById("nameForm");
const nameInput = document.getElementById("nameInput");
const nameListEl = document.getElementById("nameList");
const startBtn = document.getElementById("startBtn");
const rankPanel = document.getElementById("rankPanel");
const rankListEl = document.getElementById("rankList");
const restartBtn = document.getElementById("restartBtn");

const GRAVITY = 0.35;
const BALL_R = 9;
const PEG_R = 6;
const SPAWN_INTERVAL = 24;
const BIN_AREA_HEIGHT = 100;
const COLORS = ["#ff5252", "#ffca28", "#42a5f5", "#66bb6a", "#ab47bc", "#26c6da", "#ff8a65", "#9ccc65"];

let pendingNames = [];
let pegs = [];
let balls = [];
let bins = [];
let spawnQueue = [];
let spawnIndex = 0;
let spawnTimer = 0;
let finishedCount = 0;
let totalPlayers = 0;
let state = "setup";

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function buildPegs() {
  pegs = [];
  const rows = 10;
  const startY = 90;
  const rowGap = 40;
  const margin = 30;
  const cols = 9;
  const colGap = (W - margin * 2) / (cols - 1);

  for (let r = 0; r < rows; r++) {
    const offset = r % 2 === 0 ? 0 : colGap / 2;
    for (let c = 0; c < cols; c++) {
      const x = margin + c * colGap + offset;
      if (x >= margin && x <= W - margin) {
        pegs.push({ x, y: startY + r * rowGap });
      }
    }
  }
}

function renderNameList() {
  nameListEl.innerHTML = "";
  pendingNames.forEach((name, i) => {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = name;
    const btn = document.createElement("button");
    btn.className = "remove-btn";
    btn.type = "button";
    btn.textContent = "×";
    btn.dataset.i = i;
    btn.setAttribute("aria-label", "삭제");
    li.appendChild(span);
    li.appendChild(btn);
    nameListEl.appendChild(li);
  });
  startBtn.disabled = pendingNames.length < 2;
  startBtn.textContent =
    pendingNames.length < 2 ? "시작 (최소 2명)" : `시작 (${pendingNames.length}명)`;
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = nameInput.value.trim();
  if (!v) return;
  pendingNames.push(v);
  nameInput.value = "";
  renderNameList();
  nameInput.focus();
});

nameListEl.addEventListener("click", (e) => {
  if (e.target.matches(".remove-btn")) {
    pendingNames.splice(Number(e.target.dataset.i), 1);
    renderNameList();
  }
});

startBtn.addEventListener("click", () => {
  if (pendingNames.length < 2) return;
  startGame(pendingNames);
});

restartBtn.addEventListener("click", () => {
  balls = [];
  bins = [];
  spawnQueue = [];
  spawnIndex = 0;
  finishedCount = 0;
  totalPlayers = 0;
  state = "setup";
  rankPanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  overlayEl.textContent = "왼쪽 아래에서 참가자를 추가하고 시작하세요";
  overlayEl.classList.remove("hidden");
});

function startGame(names) {
  totalPlayers = names.length;
  buildPegs();
  bins = new Array(totalPlayers).fill(null);
  balls = [];
  spawnQueue = names.map((n, i) => ({ name: n, color: COLORS[i % COLORS.length] }));
  spawnIndex = 0;
  spawnTimer = SPAWN_INTERVAL;
  finishedCount = 0;
  state = "dropping";
  setupPanel.classList.add("hidden");
  overlayEl.classList.add("hidden");
  rankPanel.classList.remove("hidden");
  rankListEl.innerHTML = "";
}

function addRankEntry(rank, name) {
  const li = document.createElement("li");
  li.textContent = `${rank}등: ${name}`;
  rankListEl.appendChild(li);
}

function update() {
  if (state !== "dropping") return;

  spawnTimer++;
  if (spawnIndex < spawnQueue.length && spawnTimer >= SPAWN_INTERVAL) {
    spawnTimer = 0;
    const p = spawnQueue[spawnIndex++];
    balls.push({
      x: W / 2 + randRange(-15, 15),
      y: 20,
      vx: randRange(-1, 1),
      vy: 0,
      r: BALL_R,
      name: p.name,
      color: p.color,
    });
  }

  balls.forEach((b) => {
    b.vy += GRAVITY;
    b.x += b.vx;
    b.y += b.vy;

    if (b.x < b.r) {
      b.x = b.r;
      b.vx *= -0.7;
    } else if (b.x > W - b.r) {
      b.x = W - b.r;
      b.vx *= -0.7;
    }
    if (b.y < b.r) {
      b.y = b.r;
      b.vy *= -0.5;
    }

    pegs.forEach((peg) => {
      const dx = b.x - peg.x;
      const dy = b.y - peg.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = b.r + PEG_R;
      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        b.x = peg.x + nx * minDist;
        b.y = peg.y + ny * minDist;
        const dot = b.vx * nx + b.vy * ny;
        b.vx -= 1.6 * dot * nx;
        b.vy -= 1.6 * dot * ny;
        b.vx += randRange(-0.6, 0.6);
      }
    });
  });

  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = a.r + b.r;
      if (dist < minDist) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = (minDist - dist) / 2;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;

        const relVx = b.vx - a.vx;
        const relVy = b.vy - a.vy;
        const relDot = relVx * nx + relVy * ny;
        if (relDot < 0) {
          a.vx += relDot * nx;
          a.vy += relDot * ny;
          b.vx -= relDot * nx;
          b.vy -= relDot * ny;
        }
      }
    }
  }

  const stillFalling = [];
  balls.forEach((b) => {
    if (b.y - b.r > H - 6) {
      bins[finishedCount] = { name: b.name, color: b.color };
      finishedCount++;
      addRankEntry(finishedCount, b.name);
    } else {
      stillFalling.push(b);
    }
  });
  balls = stillFalling;

  if (finishedCount >= totalPlayers && spawnIndex >= spawnQueue.length) {
    state = "done";
    overlayEl.textContent = "완료! 결과를 확인하세요";
    overlayEl.classList.remove("hidden");
  }
}

function drawBins() {
  const binWidth = W / totalPlayers;
  const binTop = H - BIN_AREA_HEIGHT;

  ctx.strokeStyle = "#30363d";
  ctx.lineWidth = 2;
  for (let i = 0; i <= totalPlayers; i++) {
    const x = i * binWidth;
    ctx.beginPath();
    ctx.moveTo(x, binTop);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  for (let i = 0; i < totalPlayers; i++) {
    const cx = i * binWidth + binWidth / 2;
    ctx.fillStyle = "#8b949e";
    ctx.font = "11px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), cx, binTop - 8);

    const occupant = bins[i];
    if (occupant) {
      ctx.beginPath();
      ctx.arc(cx, H - 28, BALL_R, 0, Math.PI * 2);
      ctx.fillStyle = occupant.color;
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = "10px sans-serif";
      ctx.fillText(occupant.name, cx, H - 42);
    }
  }
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#10151c";
  ctx.fillRect(0, 0, W, H);

  pegs.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
    ctx.fillStyle = "#3a4552";
    ctx.fill();
  });

  if (state !== "setup") {
    drawBins();
  }

  balls.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(b.name, b.x, b.y - b.r - 4);
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

renderNameList();
loop();
