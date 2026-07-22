const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

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
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 50;
const BASE_HEIGHT = 3200;
const HEIGHT_PER_PLAYER = 24;
const FUNNEL_HEIGHT = 380;
const EXIT_GAP = 70;
const COLORS = ["#ff5252", "#ffca28", "#42a5f5", "#66bb6a", "#ab47bc", "#26c6da", "#ff8a65", "#9ccc65"];

let W = window.innerWidth;
let BOARD_H = BASE_HEIGHT;

let pendingNames = [];
let pegs = [];
let windmills = [];
let balls = [];
let spawnQueue = [];
let spawnIndex = 0;
let spawnTimer = 0;
let finishedCount = 0;
let totalPlayers = 0;
let state = "setup";

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function sizeCanvas(playerCount) {
  W = window.innerWidth;
  BOARD_H = BASE_HEIGHT + Math.min(playerCount, MAX_PLAYERS) * HEIGHT_PER_PLAYER;
  canvas.width = W;
  canvas.height = BOARD_H;
}

function nearWindmill(y) {
  return windmills.some((w) => Math.abs(w.y - y) < 90);
}

function buildWindmills() {
  windmills = [];
  const fieldBottom = BOARD_H - FUNNEL_HEIGHT;
  let y = 480;
  let side = 0;
  while (y < fieldBottom - 200) {
    const x = side % 2 === 0 ? W * 0.3 : W * 0.7;
    windmills.push({
      x,
      y,
      armLength: 75,
      angle: Math.random() * Math.PI * 2,
      speed: (Math.random() < 0.5 ? -1 : 1) * randRange(0.03, 0.05),
      thickness: 8,
    });
    side++;
    y += 550;
  }
}

function buildPegs() {
  pegs = [];
  const margin = 40;
  const rowGap = 55;
  const targetColGap = 70;
  const cols = Math.max(5, Math.round((W - margin * 2) / targetColGap) + 1);
  const colGap = (W - margin * 2) / (cols - 1);
  const fieldBottom = BOARD_H - FUNNEL_HEIGHT;

  for (let y = 150; y < fieldBottom; y += rowGap) {
    if (nearWindmill(y)) continue;
    const rowIndex = Math.round((y - 150) / rowGap);
    const offset = rowIndex % 2 === 0 ? 0 : colGap / 2;
    for (let c = 0; c < cols; c++) {
      const x = margin + c * colGap + offset;
      if (x >= margin && x <= W - margin) {
        pegs.push({ x, y });
      }
    }
  }

  const funnelStartY = fieldBottom;
  const funnelEndY = BOARD_H - 20;
  const steps = 20;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const y = funnelStartY + t * (funnelEndY - funnelStartY);
    const leftX = margin + t * (W / 2 - EXIT_GAP / 2 - margin);
    pegs.push({ x: leftX, y });
    pegs.push({ x: W - leftX, y });
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
  const count = pendingNames.length;
  startBtn.disabled = count < MIN_PLAYERS;
  startBtn.textContent = count < MIN_PLAYERS ? "시작 (최소 1명)" : `시작 (${count}명)`;
}

nameForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const v = nameInput.value.trim();
  if (!v) return;
  if (pendingNames.length >= MAX_PLAYERS) {
    alert(`참가자는 최대 ${MAX_PLAYERS}명까지 추가할 수 있습니다.`);
    return;
  }
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
  if (pendingNames.length < MIN_PLAYERS) return;
  startGame(pendingNames);
});

restartBtn.addEventListener("click", () => {
  balls = [];
  spawnQueue = [];
  spawnIndex = 0;
  finishedCount = 0;
  totalPlayers = 0;
  state = "setup";
  rankPanel.classList.add("hidden");
  setupPanel.classList.remove("hidden");
  overlayEl.textContent = "왼쪽 아래에서 참가자를 추가하고 시작하세요";
  overlayEl.classList.remove("hidden");
  sizeCanvas(pendingNames.length);
  buildWindmills();
  buildPegs();
  window.scrollTo(0, 0);
});

function startGame(names) {
  totalPlayers = names.length;
  sizeCanvas(totalPlayers);
  buildWindmills();
  buildPegs();
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
  window.scrollTo(0, 0);
}

function addRankEntry(rank, name) {
  const li = document.createElement("li");
  li.textContent = `${rank}등: ${name}`;
  rankListEl.appendChild(li);
}

function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function handleWindmillCollision(ball, w) {
  const dx1 = Math.cos(w.angle) * w.armLength;
  const dy1 = Math.sin(w.angle) * w.armLength;
  const p1 = { x: w.x - dx1, y: w.y - dy1 };
  const p2 = { x: w.x + dx1, y: w.y + dy1 };
  const closest = closestPointOnSegment(ball, p1, p2);
  const dx = ball.x - closest.x;
  const dy = ball.y - closest.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = ball.r + w.thickness;

  if (dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;
    ball.x = closest.x + nx * minDist;
    ball.y = closest.y + ny * minDist;

    const rx = closest.x - w.x;
    const ry = closest.y - w.y;
    const pointVx = -w.speed * ry;
    const pointVy = w.speed * rx;

    const relVx = ball.vx - pointVx;
    const relVy = ball.vy - pointVy;
    const dot = relVx * nx + relVy * ny;
    const restitution = 1.6;

    ball.vx = pointVx + (relVx - restitution * dot * nx);
    ball.vy = pointVy + (relVy - restitution * dot * ny);
  }
}

function updateWindmills() {
  windmills.forEach((w) => {
    w.angle += w.speed;
  });
}

function update() {
  if (state !== "dropping") return;

  updateWindmills();

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

    windmills.forEach((w) => handleWindmillCollision(b, w));
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
    if (b.y - b.r > BOARD_H - 6) {
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

function updateScroll() {
  if (state !== "dropping") return;
  let leaderY = 0;
  if (balls.length > 0) {
    leaderY = Math.max(...balls.map((b) => b.y));
  }
  const target = Math.max(0, leaderY - window.innerHeight * 0.4);
  window.scrollTo(0, target);
}

function drawWindmill(w) {
  const dx = Math.cos(w.angle) * w.armLength;
  const dy = Math.sin(w.angle) * w.armLength;
  ctx.beginPath();
  ctx.moveTo(w.x - dx, w.y - dy);
  ctx.lineTo(w.x + dx, w.y + dy);
  ctx.lineCap = "round";
  ctx.lineWidth = w.thickness * 2;
  ctx.strokeStyle = "#f2a900";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(w.x, w.y, 6, 0, Math.PI * 2);
  ctx.fillStyle = "#c77c00";
  ctx.fill();
}

function draw() {
  ctx.clearRect(0, 0, W, BOARD_H);
  ctx.fillStyle = "#10151c";
  ctx.fillRect(0, 0, W, BOARD_H);

  pegs.forEach((p) => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, PEG_R, 0, Math.PI * 2);
    ctx.fillStyle = "#3a4552";
    ctx.fill();
  });

  windmills.forEach(drawWindmill);

  ctx.fillStyle = "#8b949e";
  ctx.font = "13px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("출구", W / 2, BOARD_H - 4);

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
  updateScroll();
  requestAnimationFrame(loop);
}

renderNameList();
sizeCanvas(0);
buildWindmills();
buildPegs();
loop();
