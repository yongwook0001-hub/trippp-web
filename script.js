const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const scoreEl = document.getElementById("score");
const ballsEl = document.getElementById("balls");
const overlayEl = document.getElementById("overlay");

const GRAVITY = 0.4;
const BALL_R = 9;
const BUMPER_COLORS = ["#ff5252", "#ffca28", "#42a5f5", "#66bb6a", "#ab47bc"];

const leftFlipper = {
  pivot: { x: 120, y: 610 },
  length: 75,
  restAngle: 0.45,
  activeAngle: -0.55,
  angle: 0.45,
  angularSpeed: 0.35,
  active: false,
  thickness: 9,
};

const rightFlipper = {
  pivot: { x: 280, y: 610 },
  length: 75,
  restAngle: Math.PI - 0.45,
  activeAngle: Math.PI + 0.55,
  angle: Math.PI - 0.45,
  angularSpeed: 0.35,
  active: false,
  thickness: 9,
};

let ball, bumpers, score, balls, state;

function randRange(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

function generateBumpers() {
  const count = randInt(4, 6);
  const result = [];
  let attempts = 0;

  while (result.length < count && attempts < 500) {
    attempts++;
    const candidate = {
      x: randRange(50, W - 50),
      y: randRange(70, 480),
      r: 18,
      color: BUMPER_COLORS[randInt(0, BUMPER_COLORS.length - 1)],
      cooldown: 0,
      flash: 0,
    };
    const overlaps = result.some(
      (b) => Math.hypot(b.x - candidate.x, b.y - candidate.y) < b.r + candidate.r + 25
    );
    if (!overlaps) result.push(candidate);
  }
  return result;
}

function resetBall() {
  ball = { x: W / 2, y: H - 40, vx: 0, vy: 0, r: BALL_R };
}

function updateHUD() {
  scoreEl.textContent = score;
  ballsEl.textContent = "●".repeat(Math.max(balls, 0));
}

function showOverlay(text) {
  overlayEl.textContent = text;
  overlayEl.classList.remove("hidden");
}

function hideOverlay() {
  overlayEl.classList.add("hidden");
}

function newGame() {
  score = 0;
  balls = 3;
  bumpers = generateBumpers();
  resetBall();
  state = "ready";
  updateHUD();
  showOverlay("스페이스바를 눌러 발사하세요");
}

function launchBall() {
  ball.vx = randRange(-2, 2);
  ball.vy = randRange(-17, -13);
  state = "playing";
  hideOverlay();
}

function loseBall() {
  balls--;
  updateHUD();
  if (balls <= 0) {
    state = "gameover";
    showOverlay(`게임 오버! 최종 점수: ${score} (R로 다시 시작)`);
  } else {
    state = "ready";
    resetBall();
    showOverlay("스페이스바를 눌러 발사하세요");
  }
}

function updateFlipper(flipper) {
  const target = flipper.active ? flipper.activeAngle : flipper.restAngle;
  const diff = target - flipper.angle;
  const prevAngle = flipper.angle;
  if (Math.abs(diff) < flipper.angularSpeed) {
    flipper.angle = target;
  } else {
    flipper.angle += Math.sign(diff) * flipper.angularSpeed;
  }
  flipper.omega = flipper.angle - prevAngle;
}

function tipOf(flipper) {
  return {
    x: flipper.pivot.x + Math.cos(flipper.angle) * flipper.length,
    y: flipper.pivot.y + Math.sin(flipper.angle) * flipper.length,
  };
}

function closestPointOnSegment(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { x: a.x + abx * t, y: a.y + aby * t };
}

function handleFlipperCollision(flipper) {
  const tip = tipOf(flipper);
  const closest = closestPointOnSegment(ball, flipper.pivot, tip);
  const dx = ball.x - closest.x;
  const dy = ball.y - closest.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = ball.r + flipper.thickness;

  if (dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = closest.x + nx * minDist;
    ball.y = closest.y + ny * minDist;

    const rx = closest.x - flipper.pivot.x;
    const ry = closest.y - flipper.pivot.y;
    const pointVx = -flipper.omega * ry;
    const pointVy = flipper.omega * rx;

    const relVx = ball.vx - pointVx;
    const relVy = ball.vy - pointVy;
    const dot = relVx * nx + relVy * ny;
    const restitution = 1.7;

    const newRelVx = relVx - restitution * dot * nx;
    const newRelVy = relVy - restitution * dot * ny;

    ball.vx = pointVx + newRelVx;
    ball.vy = pointVy + newRelVy;
  }
}

function handleBumperCollision(bumper) {
  const dx = ball.x - bumper.x;
  const dy = ball.y - bumper.y;
  const dist = Math.hypot(dx, dy) || 0.001;
  const minDist = ball.r + bumper.r;

  if (dist < minDist) {
    const nx = dx / dist;
    const ny = dy / dist;

    ball.x = bumper.x + nx * (minDist + 0.5);
    ball.y = bumper.y + ny * (minDist + 0.5);

    const dot = ball.vx * nx + ball.vy * ny;
    ball.vx -= 2 * dot * nx;
    ball.vy -= 2 * dot * ny;
    ball.vx += nx * 3;
    ball.vy += ny * 3;

    const speed = Math.hypot(ball.vx, ball.vy);
    const kickMin = 7;
    if (speed < kickMin) {
      const scale = kickMin / speed;
      ball.vx *= scale;
      ball.vy *= scale;
    }

    if (bumper.cooldown <= 0) {
      score += randInt(10, 50);
      updateHUD();
      bumper.cooldown = 12;
      bumper.flash = 10;
    }
  }
}

function update() {
  updateFlipper(leftFlipper);
  updateFlipper(rightFlipper);

  bumpers.forEach((b) => {
    if (b.cooldown > 0) b.cooldown--;
    if (b.flash > 0) b.flash--;
  });

  if (state !== "playing") return;

  ball.vy += GRAVITY;
  ball.x += ball.vx;
  ball.y += ball.vy;

  if (ball.x < ball.r) {
    ball.x = ball.r;
    ball.vx *= -0.8;
  } else if (ball.x > W - ball.r) {
    ball.x = W - ball.r;
    ball.vx *= -0.8;
  }
  if (ball.y < ball.r) {
    ball.y = ball.r;
    ball.vy *= -0.8;
  }

  bumpers.forEach(handleBumperCollision);
  handleFlipperCollision(leftFlipper);
  handleFlipperCollision(rightFlipper);

  if (ball.y - ball.r > H) {
    loseBall();
  }
}

function drawFlipper(flipper) {
  const tip = tipOf(flipper);
  ctx.beginPath();
  ctx.moveTo(flipper.pivot.x, flipper.pivot.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineCap = "round";
  ctx.lineWidth = flipper.thickness * 2;
  ctx.strokeStyle = "#e6edf3";
  ctx.stroke();
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = "#10151c";
  ctx.fillRect(0, 0, W, H);

  bumpers.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.flash > 0 ? b.r + 3 : b.r, 0, Math.PI * 2);
    ctx.fillStyle = b.color;
    ctx.globalAlpha = b.flash > 0 ? 1 : 0.85;
    ctx.fill();
    ctx.globalAlpha = 1;
  });

  drawFlipper(leftFlipper);
  drawFlipper(rightFlipper);

  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fillStyle = "#f5f5f5";
  ctx.fill();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener("keydown", (e) => {
  if (["ArrowLeft", "ArrowRight", "Space", "KeyZ", "KeyM"].includes(e.code)) {
    e.preventDefault();
  }
  if (e.code === "ArrowLeft" || e.code === "KeyZ") leftFlipper.active = true;
  if (e.code === "ArrowRight" || e.code === "KeyM") rightFlipper.active = true;
  if (e.code === "Space" && state === "ready") launchBall();
  if (e.code === "KeyR") newGame();
});

window.addEventListener("keyup", (e) => {
  if (e.code === "ArrowLeft" || e.code === "KeyZ") leftFlipper.active = false;
  if (e.code === "ArrowRight" || e.code === "KeyM") rightFlipper.active = false;
});

newGame();
loop();
