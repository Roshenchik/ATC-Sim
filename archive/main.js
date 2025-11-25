import { globals } from './globals.js';
import { 
  confirmAltitudeChange,
  confirmHeadingChange,
  confirmSpeedChange,
  sayReachedAltitude, 
  sayReachedHeading, 
  sayReachedSpeed,
  reportTcasAlarm,
} from '../pilotReplyAudioApi.js';
import { airlinePrefixes, callsignAliasesJoined } from '../callsignAliases.js';

// =====================
// ====== CONSTANTS ======
// =====================

// ---- real-world sizes (meters) ----
const RUNWAY_LENGTH_M = 3000;
const RUNWAY_WIDTH_M = 60;
const FINAL_LENGTH_M = 20000;
const FINAL_BUFFER_M = 100;
const STCA_RADIUS_M = 30000;
const STCA_VERT_DIST_F = 300;
const OFFSCREEN_MARGIN_M = 10000;
const RADAR_RADIUS_M = 20000;
const VECTOR_LENGTH_M = 5000;

const MIN_SPEED_KPH = 600; 
const MAX_SPEED_KPH = 900;
globals.MIN_SPEED_KPH = MIN_SPEED_KPH;
globals.MAX_SPEED_KPH = MAX_SPEED_KPH;

const ACCELERATION_KPH_PER_SEC = 5; // крейсерская смена скорости
const DECELERATION_KPH_PER_SEC = 5; // замедление

const MAX_CLIMB_RATE_FPM = 2500; 
const MAX_DESCENT_RATE_FPM = 3000; 

function kphToPxPerSec(kph) {
  return (kph / 3.6) / METERS_PER_PIXEL; // м/с → px/с
}

// ---- visual scale (pixels) ----
const RUNWAY_LENGTH_PX = 15; // runway visual length in px

// ---- meters -> pixels conversion ----
const METERS_PER_PIXEL = RUNWAY_LENGTH_M / RUNWAY_LENGTH_PX;
function metersToPixels(meters) {
  return meters / METERS_PER_PIXEL;
}

const RUNWAY_LENGTH = RUNWAY_LENGTH_PX;
const RUNWAY_HEIGHT = (RUNWAY_WIDTH_M / METERS_PER_PIXEL) + 3; // +3 px for visibility
const FINAL_LENGTH = metersToPixels(FINAL_LENGTH_M);
const FINAL_BUFFER = metersToPixels(FINAL_BUFFER_M);
const STCA_RADIUS = metersToPixels(STCA_RADIUS_M);
const OFFSCREEN_MARGIN = metersToPixels(OFFSCREEN_MARGIN_M);
const RADAR_RADIUS = metersToPixels(RADAR_RADIUS_M);
const VECTOR_LENGTH = metersToPixels(VECTOR_LENGTH_M);
//const PLANE_SPEED = kphToPxPerSec(BASE_SPEED_KPH); // pixels per second unit (will be multiplied by delta)
 
// ---- other ----
const SIDEBAR_WIDTH = 260;
const PLANE_SIZE = 4;
const SELECT_RADIUS = Math.sqrt(PLANE_SIZE ** 2.5 + PLANE_SIZE ** 2.5);
const RADAR_UPLOAD = 5000;
const MAX_PLANES = 8;
const AIRLINES = ["SAS", "DLH", "BAW", "AFL", "RYR", "KLM"];

// =====================
// ====== DOM / UI ======
// =====================
const ui = {
  canvas: document.querySelector('[data-element="canvas"]'),
  planeInfo: document.querySelector('[data-element="plane-info"]'),
  courseInput: document.querySelector('[data-element="course-input"]'),
  altitudeInput: document.querySelector('[data-element="altitude-input"]'),

  // radar computed from runway and canvas size
  get radar() {
    const centerX = runway.x + runway.width / 2;
    const centerY = runway.y + runway.height / 2;
    const maxRadius = Math.min(this.canvas.width, this.canvas.height) / 2;
    return { centerX, centerY, maxRadius };
  }
};

const ctx = ui.canvas.getContext('2d');
let selectedPlane = null;

// =====================
// ====== RUNWAY ======
// =====================
const runway = { x: 0, y: 0, width: RUNWAY_LENGTH, height: RUNWAY_HEIGHT };
const finalZone = { x1: 0, y1: 0, x2: 0, y2: 0 };

function initRunway() {
  // place runway in visual center at start
  runway.x = (window.innerWidth - SIDEBAR_WIDTH) / 2 - RUNWAY_LENGTH / 2;
  runway.y = window.innerHeight / 2 - RUNWAY_HEIGHT / 2;

  // compute final zone once
  finalZone.x1 = runway.x - FINAL_LENGTH;
  finalZone.y1 = runway.y - FINAL_BUFFER;
  finalZone.x2 = runway.x;
  finalZone.y2 = runway.y + RUNWAY_HEIGHT + FINAL_BUFFER;
}

// =====================
// ====== CANVAS SIZE (DPI) ======
// =====================
function resizeCanvas() {
  // set CSS pixel size to available area
  ui.canvas.width = window.innerWidth - SIDEBAR_WIDTH;
  ui.canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// =====================
// ====== HELPERS ======
// =====================
function degToRad(deg) { return deg * Math.PI / 180; }
function radToDeg(rad) { return rad * 180 / Math.PI; }

// =====================
// ====== DRAWING HELPERS ======
// =====================
function drawPlane(ctx, x, y, angle, selected, stca = false) {
  const fillColor = stca ? 'red' : (selected ? 'green' : 'rgba(255,255,255,1)');

  // diamond shape
  ctx.beginPath();
  ctx.moveTo(x, y - PLANE_SIZE);
  ctx.lineTo(x + PLANE_SIZE, y);
  ctx.lineTo(x, y + PLANE_SIZE);
  ctx.lineTo(x - PLANE_SIZE, y);
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.stroke();

  // heading vector (line)
  const rad = degToRad(angle - 90);
  const x2 = x + Math.cos(rad) * VECTOR_LENGTH;
  const y2 = y + Math.sin(rad) * VECTOR_LENGTH;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawRunway() {
  ctx.fillStyle = 'gray';
  ctx.fillRect(runway.x, runway.y, runway.width, runway.height);

  // final line
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(runway.x, runway.y + RUNWAY_HEIGHT / 2);
  ctx.lineTo(runway.x - FINAL_LENGTH, runway.y + RUNWAY_HEIGHT / 2);
  ctx.stroke();
}

function drawRadarGrid() {
  const { centerX, centerY, maxRadius } = ui.radar;
  const ringStep = 100;
  const angleStep = 15;

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  for (let r = ringStep; r < maxRadius; r += ringStep) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (let a = 0; a < 360; a += angleStep) {
    const rad = degToRad(a);
    const x2 = centerX + Math.cos(rad) * maxRadius;
    const y2 = centerY + Math.sin(rad) * maxRadius;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

// =====================
// ====== INFO PANEL ======
// =====================
function updatePlaneInfo(plane) {
  if (!plane) {
    ui.planeInfo.innerHTML = "<p>Select a flight</p>";
    return;
  }

  // internationalized labels kept short
  ui.planeInfo.innerHTML = `
    <p><b>${plane.callsign}</b></p>
    <p>Heading: ${plane.angle.toFixed(0)}°</p>
    <p>Speed: ${plane.groundSpeed} km/h</p>
    <p>Altitude: FL${plane.flightLevel}</p>
  `;
}
globals.updatePlaneInfo = updatePlaneInfo;

// =====================
// ====== STCA CHECK ======
// =====================
function checkSTCA(planes) {
  planes.forEach(p => p.stca = false);

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i];
      const b = planes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      const isCloseHoriz = distance < STCA_RADIUS
      const isCloseVert = Math.abs(a.altitude - b.altitude) < STCA_VERT_DIST_F
      if (isCloseVert && isCloseHoriz) {
        a.stca = true;
        b.stca = true;
      }
    }
  }
}

// =====================
// ====== PLANE CLASS ======
// =====================
class Plane {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;

    this.angle = this.normalizeAngle(angle);
    this.setAngle = this.angle;
    this.displayAngle = this.angle;

    this.displayX = x;
    this.displayY = y;

    // determine speed randomly within range
    const speedKph = MIN_SPEED_KPH + Math.random() * (MAX_SPEED_KPH - MIN_SPEED_KPH);
    this.speed = kphToPxPerSec(speedKph);
    this.accelerationKphPerSec = ACCELERATION_KPH_PER_SEC;
    this.decelerationKphPerSec = DECELERATION_KPH_PER_SEC;

    this.selected = false;
    this.stca = false;
    this.landing = false;
    this.landed = false;
    this.bankAngle = 25; // degrees
    this.turnSide = 0 // 1 = clockwise, -1 = counterclockwise

    // Flight strip field
    const callsignData = this.generateCallsign();
    this.callsignPrefix = callsignData.prefix;
    this.callsignNum = callsignData.number;
    this.callsign = callsignData.prefix + callsignData.number;
    this.airline = airlinePrefixes[callsignData.prefix] || callsignData.prefix;; // заменяем на алиас, если есть
    const possibleFlightLevels = [290, 300, 310, 320, 330, 340, 350, 360];
    this.flightLevel = possibleFlightLevels[Math.floor(Math.random() * possibleFlightLevels.length)];
    this.altitude = this.flightLevel * 100; // feet

    this.groundSpeed = Math.floor(speedKph);
    this.targetSpeed = Math.floor(speedKph);

    this.targetAltitude = this.altitude; // цель по высоте (в футах)
    this.maxClimbRate = MAX_CLIMB_RATE_FPM; // футов в минуту, реалистично для пассажирских лайнеров
    this.maxDescentRate = MAX_DESCENT_RATE_FPM; // футов в минуту
  }

  // ======== LOGIC METHODS ========

  generateCallsign() {
    const callsign = { prefix: null, number: null}
    callsign.prefix = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
    callsign.number = Math.floor(100 + Math.random() * 900).toString();
    return callsign;
  }

  // Update position for straight flight
  updatePosition(delta) {
    const rad = degToRad(this.angle - 90);
    this.x += this.speed * Math.cos(rad) * delta;
    this.y += this.speed * Math.sin(rad) * delta;
  }

  updateAltitude(delta) {
    const vertSpeedFpm = this.targetAltitude > this.altitude ? this.maxClimbRate : this.maxDescentRate;
    const vertSpeedFps = vertSpeedFpm / 60
    const vertSpeedFpf = vertSpeedFps * delta;
    const direction = Math.sign(this.targetAltitude - this.altitude)

    if (Math.abs(this.targetAltitude - this.altitude) <= vertSpeedFpf) {
      this.altitude = this.targetAltitude;
      this.flightLevel = Math.round(this.altitude / 100);
      sayReachedAltitude(this);
      return;
    } 

    this.altitude += direction * vertSpeedFpf;
    this.flightLevel = Math.round(this.altitude / 100);
  }

  updateSpeed(delta) {
    const deltaSpeed = this.targetSpeed - this.groundSpeed; // разница в скорости
    const maxDelta = this.accelerationKphPerSec * delta; // максимально возможное изменение за этот кадр

    if (Math.abs(deltaSpeed) <= maxDelta) {
      this.groundSpeed = this.targetSpeed; // достигли цели
      sayReachedSpeed(this)
    } else {
      this.groundSpeed += Math.sign(deltaSpeed) * maxDelta; // увеличиваем или уменьшаем
    }
    // пересчитываем пиксели/сек
    this.speed = kphToPxPerSec(this.groundSpeed);
    //console.log(`Plane ${this.callsign} speed updated to ${this.groundSpeed} km/h`);
  }

  turn(delta) {
    const angle = this.normalizeAngle(this.angle);
    const target = this.normalizeAngle(this.setAngle);

    const angleDifference = this.shortestAngleDiff(target, angle);
    const turnRate = this.calcMaxAngularSpeed(); // degrees per second
    const turnRateDpf = turnRate * delta; // degrees per frame
    this.turnSide = this.turnDirection(target, angle)

    // If the angle is so small that we don't have time to "finish" it, we just set it
    if (Math.abs(angleDifference) <= turnRateDpf) {
        this.angle = this.setAngle;
        this.turnSide = 0;
        sayReachedHeading(this)
        return;
    }
    // Выполняем поворот
    this.angle = this.normalizeAngle(
        angle + this.turnSide * turnRateDpf
    );
    //console.log(`this.setAngle: ${this.setAngle}, this.angle: ${this.angle}, angleDifference: ${angleDifference}, direction: ${this.turnSide}, turnRate: ${turnRate}`);
  }

  calcTurningRadius() {
    const g = 9.81; // ускорение свободного падения
    const V = this.groundSpeed / 3.6; // км/ч → м/с
    const phi = this.bankAngle * Math.PI / 180; // градусы → радианы
    return V * V / (g * Math.tan(phi)); // радиус в метрах
  }

  calcMaxAngularSpeed() {
    const R = this.calcTurningRadius(); // м
    const V = this.groundSpeed / 3.6; // м/с
    const maxAngularSpeed = radToDeg(V / R); // град/сек
    return maxAngularSpeed;
  }

  turnDirection(target, current) {
    const diff = this.shortestAngleDiff(target, current);
    return Math.sign(diff);
  }

  normalizeAngle(angle) {
    return (angle + 360) % 360;
  }

  shortestAngleDiff(target, current) {
    return this.normalizeAngle(target - current + 180) - 180;
  }

  // Check if plane enters landing zone
  checkLanding() {
    if (!this.landing &&
        this.x >= finalZone.x1 && this.x <= finalZone.x2 &&
        this.y >= finalZone.y1 && this.y <= finalZone.y2) {
      this.landing = true;
    }
  }

  // Update plane position during landing
  updateLanding(delta) {
    const targetX = runway.x + runway.width / 2;
    const targetY = runway.y + runway.height / 2;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    this.angle = (radToDeg(Math.atan2(dy, dx)) + 90 + 360) % 360;

    if (dist > this.speed * delta) {
      this.x += (dx / dist) * this.speed * delta;
      this.y += (dy / dist) * this.speed * delta;
    } else {
      this.x = targetX;
      this.y = targetY;
      this.landed = true;
    }
  }

  // Main update method: decides which logic to run
  update(delta = 1 / 60) {
    if (this.landed) return;

    if (this.setAngle !== this.angle) {
      this.turn(delta);
    }

    if (this.targetAltitude !== this.altitude) {
      this.updateAltitude(delta);
    }

    if (this.targetSpeed !== this.groundSpeed) {
      this.updateSpeed(delta);
    }

    if (this.landing) {
      this.updateLanding(delta);
    } else {
      this.updatePosition(delta);
      this.checkLanding();
    }
  }

  refreshDisplay() {
    this.displayX = this.x;
    this.displayY = this.y;
    this.displayAngle = this.angle;
  }

  checkRunway() {
    return this.x > runway.x &&
           this.x < runway.x + runway.width &&
           this.y > runway.y &&
           this.y < runway.y + runway.height;
  }

  // ======== VISUALIZATION METHODS ========
  draw() {
    drawPlane(ctx, this.displayX, this.displayY, this.displayAngle, this.selected, this.stca);
    this.drawLabel();
  }

  drawLabel() {
    const rad = degToRad(this.displayAngle - 90);
    const offset = 15;
    let offsetX = -Math.sin(rad) * offset;
    let offsetY = Math.cos(rad) * offset;
    let textX = this.displayX + offsetX;
    let textY = this.displayY + offsetY;

    ctx.save();
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;

    const lines = [
      `${this.callsign}`,
      `HDG ${this.angle.toFixed(0).padStart(3,'0')}`,
      `SPD ${this.groundSpeed.toFixed(0)}`,
      `FL ${this.flightLevel}`
    ];

    let maxWidth = 0;
    for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    const boxWidth = maxWidth + 8;
    const boxHeight = lines.length * 12 + 4;

    if (this.displayAngle > 180 && this.displayAngle <= 270) {
      textX = this.displayX - offsetX;
      textY = this.displayY - offsetY;
    }
    let boxClosestCorner = textX - 4;
    if (this.displayAngle > 90 && this.displayAngle <= 180) {
      textX = this.displayX - boxWidth + offsetX;
      boxClosestCorner = (textX - 4) + boxWidth;
    }

    ctx.fillStyle = 'rgba(100,100,100,0.5)';
    ctx.fillRect(textX - 4, textY - 2, boxWidth, boxHeight);

    ctx.beginPath();
    ctx.moveTo(boxClosestCorner, textY - 2);
    ctx.lineTo(this.displayX, this.displayY);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = this.selected ? '#0f0' : '#fff';
    lines.forEach((line,i) => ctx.fillText(line, textX, textY + i * 12));
    ctx.restore();
  }
}


// =====================
// ====== SPAWNING ======
// =====================
const planes = [];
globals.planes = planes;

function spawnPlane() {
  if (planes.length >= MAX_PLANES) return;

  const { centerX, centerY, maxRadius } = ui.radar;
  const spawnRadius = maxRadius + OFFSCREEN_MARGIN;
  const angle = Math.round(Math.random() * 360);

  const rad = degToRad(angle);
  const x = centerX + Math.cos(rad) * spawnRadius;
  const y = centerY + Math.sin(rad) * spawnRadius;

  const courseToCenter = (radToDeg(Math.atan2(centerY - y, centerX - x)) + 90 + 360) % 360;
  const angleWithNoise = courseToCenter + Math.round(Math.random() * 30 - 15);

  planes.push(new Plane(x, y, angleWithNoise));
}

// ====== REMOVING PLANES ======
function removePlane(index) {
  const p = planes[index];
  if (selectedPlane === p) {
    selectedPlane = null;
    updatePlaneInfo(null);
  }
  planes.splice(index, 1);
  spawnPlane();
}

// =====================
// ====== INPUTS / EVENTS ======
// =====================
ui.canvas.addEventListener('click', e => {
  const rect = ui.canvas.getBoundingClientRect();

  // convert CSS px -> canvas px
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  selectedPlane = null;
  planes.forEach(p => p.selected = false);

  const radiusSq = SELECT_RADIUS * SELECT_RADIUS;
  for (const p of planes) {
    const dx = mx - p.displayX;
    const dy = my - p.displayY;
    if (dx * dx + dy * dy < radiusSq) {
      p.selected = true;
      selectedPlane = p;
      globals.selectedPlane = p;
      console.log(`Selected plane: ${p.callsign}, company: ${p.airline}, heading ${p.angle}°, speed ${p.groundSpeed} km/h, altitude ${p.altitude} ft`); // delete after testing
      // let maxAngularSpeed = p.calcMaxAngularSpeed(); // delete after testing
      //console.log(`Max angular speed for ${p.callsign}: ${maxAngularSpeed.toFixed(2)} deg/sec`); // delete after testing
      updatePlaneInfo(p);



      break;
    }
  }

  if (!selectedPlane) updatePlaneInfo(null);
});

document.addEventListener('click', e => {
  const action = e.target.dataset.action;
  if (action === 'set-course' && selectedPlane) {
    const newAngle = parseFloat(ui.courseInput.value);
    if (!isNaN(newAngle) && newAngle >= 0 && newAngle < 360) {
      selectedPlane.setAngle = newAngle;
      updatePlaneInfo(selectedPlane);
      confirmHeadingChange(selectedPlane, newAngle)
    }
  }

  if (action === 'set-altitude' && selectedPlane) {
    const flInput = document.querySelector('[data-element="flightlevel-input"]');
    if (!flInput) return;
    const newFL = parseInt(flInput.value, 10);
    // accept any FL from 0..660
    if (!isNaN(newFL) && newFL >= 0 && newFL <= 660) {
      selectedPlane.targetAltitude = newFL * 100;
      updatePlaneInfo(selectedPlane);
      confirmAltitudeChange(selectedPlane, newFL)
    }
  }

  if (action === 'set-speed' && selectedPlane) {
    const input = document.querySelector('[data-element="speed-input"]');
    if (!input) return;

    let newSpeed = parseFloat(input.value);
    if (!isNaN(newSpeed)) {
      // ограничиваем диапазон MIN/MAX вручную
      if (newSpeed < MIN_SPEED_KPH) newSpeed = MIN_SPEED_KPH;
      if (newSpeed > MAX_SPEED_KPH) newSpeed = MAX_SPEED_KPH;

      selectedPlane.targetSpeed = newSpeed;
      updatePlaneInfo(selectedPlane);
      confirmSpeedChange(selectedPlane, newSpeed)
    }
  }
});

// =====================
// ====== REFRESH / STCA ======
// =====================
function refreshDisplay() {
  planes.forEach(p => p.refreshDisplay());
  checkSTCA(planes);
}

// =====================
// ====== GAME LOOP ======
// =====================
let lastTime = performance.now();

function gameLoop(now) {
  // pass in timestamp from requestAnimationFrame; called initially as gameLoop(performance.now())
  const delta = (now - lastTime) / 1000; // seconds
  lastTime = now;

  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  drawRadarGrid();
  drawRunway();

  // update and garbage-collect planes
  for (let i = planes.length - 1; i >= 0; i--) {
    const p = planes[i];
    p.update(delta);

    // landed -> remove
    // outside radar -> remove
    const dx = p.x - ui.radar.centerX;
    const dy = p.y - ui.radar.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (p.landed || dist > ui.radar.maxRadius + OFFSCREEN_MARGIN + 20) {
      removePlane(i);
      continue;
    }
  }

  // draw
  planes.forEach(p => p.draw());

  requestAnimationFrame(gameLoop);
}

// =====================
// ====== START ======
// =====================
resizeCanvas();
initRunway();
for (let i = 0; i < MAX_PLANES; i++) spawnPlane();
setInterval(spawnPlane, 2500);
refreshDisplay();
setInterval(refreshDisplay, RADAR_UPLOAD);
setInterval(() => planes.forEach(reportTcasAlarm), 30000);

// Start the animation loop with an initial timestamp
gameLoop(performance.now());
