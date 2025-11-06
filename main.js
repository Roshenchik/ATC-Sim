// =====================
// ====== КОНСТАНТЫ ======
// =====================

// ==== РЕАЛЬНЫЕ РАЗМЕРЫ (в метрах) ====
const RUNWAY_LENGTH_M = 3000;       // длина ВПП (типичная для международного аэропорта)
const RUNWAY_WIDTH_M = 60;          // ширина ВПП
const FINAL_LENGTH_M = 10000;        // длина участка финала
const FINAL_BUFFER_M = 100;          // допустимая зона в финале
const STCA_RADIUS_M = 10000;          // радиус конфликтной зоны (10 км)
const OFFSCREEN_MARGIN_M = 10000;   // запас за радиусом радара (10 км)
const RADAR_RADIUS_M = 20000;       // радиус радара (20 км) // пока не используется напрямую
const VECTOR_LENGTH_M = 3000;       // длина вектора направления (3 км)
const PLANE_SPEED_KPH = 1500; // для информации в формуляре
const PLANE_SPEED_MPS = PLANE_SPEED_KPH / 3.6; // скорость самолёта (м/с ≈ 238 км/ч)

// ==== ВИЗУАЛЬНЫЙ МАСШТАБ ====
const RUNWAY_LENGTH_PX = 30; // длина полосы в пикселях — базовый визуальный размер

// ==== ПЕРЕВОД В ПИКСЕЛИ ====
const METERS_PER_PIXEL = RUNWAY_LENGTH_M / RUNWAY_LENGTH_PX; // сколько метров в 1 пикселе

const RUNWAY_LENGTH = RUNWAY_LENGTH_PX;
const RUNWAY_HEIGHT = (RUNWAY_WIDTH_M / METERS_PER_PIXEL) + 3; // +3 пикселя для видимости
const FINAL_LENGTH = FINAL_LENGTH_M / METERS_PER_PIXEL;
const FINAL_BUFFER = FINAL_BUFFER_M / METERS_PER_PIXEL;
const STCA_RADIUS = STCA_RADIUS_M / METERS_PER_PIXEL;
const OFFSCREEN_MARGIN = OFFSCREEN_MARGIN_M / METERS_PER_PIXEL;
const RADAR_RADIUS = RADAR_RADIUS_M / METERS_PER_PIXEL;
const VECTOR_LENGTH = VECTOR_LENGTH_M / METERS_PER_PIXEL;
const PLANE_SPEED = PLANE_SPEED_MPS / METERS_PER_PIXEL; // в пикселях за кадр

// ==== ПРОЧЕЕ ====
const SIDEBAR_WIDTH = 260;
const PLANE_SIZE = 4;
const SELECT_RADIUS = Math.sqrt(PLANE_SIZE ** 2.5 + PLANE_SIZE ** 2.5);
const RADAR_UPLOAD = 1000;
const MAX_PLANES = 8;

// =====================
// ====== DOM ЭЛЕМЕНТЫ ======
const ui = {
  canvas: document.querySelector('[data-element="canvas"]'),
  planeInfo: document.querySelector('[data-element="plane-info"]'),
  courseInput: document.querySelector('[data-element="course-input"]'),
  altitudeInput: document.querySelector('[data-element="altitude-input"]'),

  
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
// ====== ПОЛОСА ======
const runway = { x: 0, y: 0, width: RUNWAY_LENGTH, height: RUNWAY_HEIGHT };
// зона финала перед полосой
const finalZone = { x1: 0, y1: 0, x2: 0, y2: 0 };

// фиксируем положение полосы в центре экрана при старте
function initRunway() {
  runway.x = (window.innerWidth - SIDEBAR_WIDTH) / 2 - RUNWAY_LENGTH / 2;
  runway.y = window.innerHeight / 2 - RUNWAY_HEIGHT / 2;

  // пересчитываем финальную зону один раз
  finalZone.x1 = runway.x - FINAL_LENGTH;
  finalZone.y1 = runway.y - FINAL_BUFFER;
  finalZone.x2 = runway.x;
  finalZone.y2 = runway.y + RUNWAY_HEIGHT + FINAL_BUFFER;
}
// =====================
// ====== РИСОВАНИЕ СЕТКИ ======
// =====================

function drawRadarGrid() {
  const { centerX, centerY, maxRadius } = ui.radar;
  const ringStep = 100; // шаг дальности в пикселях
  const angleStep = 15; // шаг азимута в градусах

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 1;

  // --- Концентрические круги ---
  for (let r = ringStep; r < maxRadius; r += ringStep) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  // --- Радиальные линии ---
  for (let a = 0; a < 360; a += angleStep) {
    const rad = (a * Math.PI) / 180;
    const x2 = centerX + Math.cos(rad) * maxRadius;
    const y2 = centerY + Math.sin(rad) * maxRadius;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.restore();
}

const resizeCanvas = () => {
  ui.canvas.width = window.innerWidth - SIDEBAR_WIDTH;
  ui.canvas.height = window.innerHeight;
};
window.addEventListener('resize', resizeCanvas);

// =====================
// ====== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ======
function drawPlane(ctx, x, y, angle, selected, stca = false) {
  const fillColor = stca ? 'red' : (selected ? 'green' : 'rgba(255,255,255,1)');

  // ромб
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

  // вектор направления
  const rad = ((angle - 90) * Math.PI) / 180;
  const x2 = x + Math.cos(rad) * VECTOR_LENGTH;
  const y2 = y + Math.sin(rad) * VECTOR_LENGTH;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = fillColor;
  ctx.lineWidth = 1;
  ctx.stroke();
}

function updatePlaneInfo(plane) {
  if (!plane) {
    ui.planeInfo.innerHTML = "<p>Выберите самолёт</p>";
    return;
  }
  ui.planeInfo.innerHTML = `
  <p><b>${plane.callsign}</b></p>
  <p>Heading: ${plane.angle.toFixed(0)}°</p>
  <p>Speed: ${plane.groundSpeed} км/ч</p>
  <p>Altitude: FL${plane.flightLevel}</p>
  `;
}

function checkSTCA(planes) {
  planes.forEach(p => p.stca = false);

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i];
      const b = planes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // STCA: только если расстояние меньше порога и эшелон совпадает
      if (distance < STCA_RADIUS && a.flightLevel === b.flightLevel) {
        a.stca = true;
        b.stca = true;
      }
    }
  }
}

// =====================
// ====== КЛАСС САМОЛЁТА ======
class Plane {
  constructor(x, y, angle) {
    this.x = x;
    this.y = y;
    this.angle = (angle + 360) % 360;
    this.displayX = x;
    this.displayY = y;
    this.speed = PLANE_SPEED;
    this.selected = false;
    this.stca = false;
    this.landing = false; // заход на полосу
    this.landed = false;  // завершение посадки

    // ---- формуляр ----
    this.callsign = this.generateCallsign();

    const possibleFlightLevels = [290, 310, 330, 350, 370, 390, 410];
    this.flightLevel = possibleFlightLevels[Math.floor(Math.random() * possibleFlightLevels.length)];
    this.altitude = this.flightLevel * 100; // футы, чтобы сохранялась совместимость с ALT

    this.groundSpeed = Math.floor(PLANE_SPEED * METERS_PER_PIXEL * 3.6); // узлы

  }

  generateCallsign() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const airline = ["SAS", "DLH", "BAW", "AFL", "RYR", "KLM"][Math.floor(Math.random() * 6)];
    const num = Math.floor(100 + Math.random() * 900);
    return airline + num;
  }
  
  update(delta) {
    if (this.landing) {
      // движение к середине полосы
      const targetX = runway.x + runway.width/2;
      const targetY = runway.y + runway.height/2;
      const dx = targetX - this.x;
      const dy = targetY - this.y;
      const dist = Math.sqrt(dx*dx + dy*dy);

      // пересчитываем угол для вектора
      this.angle = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;

      if (dist > this.speed) {
        this.x += (dx / dist) * this.speed * delta;
        this.y += (dy / dist) * this.speed * delta;
      } else {
        this.x = targetX;
        this.y = targetY;
        this.landed = true;
      }
    } else {
      // обычное движение
      const rad = ((this.angle - 90) * Math.PI) / 180;
      this.x += this.speed * Math.cos(rad) * delta;
      this.y += this.speed * Math.sin(rad) * delta;

      // проверка попадания в финал
      if (this.x >= finalZone.x1 && this.x <= finalZone.x2 &&
          this.y >= finalZone.y1 && this.y <= finalZone.y2) {
        this.landing = true;
      }
    }
  }

  refreshDisplay() {
    this.displayX = this.x;
    this.displayY = this.y;
  }

  draw() {
    drawPlane(ctx, this.displayX, this.displayY, this.angle, this.selected, this.stca);
    this.drawLabel();
  }

  drawLabel() {
  const rad = ((this.angle - 90) * Math.PI) / 180;

  // === 1. Базовое смещение формуляра относительно самолёта ===
  const offset = 15;
  let offsetX = -Math.sin(rad) * offset;
  let offsetY = Math.cos(rad) * offset;

  // Начальная позиция формуляра
  let textX = this.displayX + offsetX;
  let textY = this.displayY + offsetY;

  // === 2. Подготовка текста ===
  ctx.save();
  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 3;

  const lines = [
    `${this.callsign}`,
    `HDG ${this.angle.toFixed(0).padStart(3, '0')}`,
    `SPD ${this.groundSpeed}`,
    `FL ${this.flightLevel}`
  ];

  // Определяем размеры текста
  let maxWidth = 0;
  for (const line of lines) {
    maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
  }

  const boxWidth = maxWidth + 8;
  const boxHeight = lines.length * 12 + 4;

  // === 3. Корректировка позиции для разных углов ===
  if (this.angle > 180 && this.angle <= 270) {
    // Нижняя левая четверть
    textX = this.displayX - offsetX;
    textY = this.displayY - offsetY;
  }

  let boxClosestCorner = textX - 4;
  if (this.angle > 90 && this.angle <= 180) {
    // Верхняя левая четверть
    textX = this.displayX - boxWidth + offsetX;
    boxClosestCorner = (textX - 4) + boxWidth;
  }

  // === 4. Рисуем подложку ===
  ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
  ctx.fillRect(textX - 4, textY - 2, boxWidth, boxHeight);

  // === 5. Соединительная линия от самолёта к формуляру ===
  ctx.beginPath();
  ctx.moveTo(boxClosestCorner, textY - 2);
  ctx.lineTo(this.displayX, this.displayY);
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // === 6. Отображение текста ===
  ctx.fillStyle = this.selected ? '#0f0' : '#fff';
  lines.forEach((line, i) => {
    ctx.fillText(line, textX, textY + i * 12);
  });

  ctx.restore();
}


  checkRunway() {
    return this.x > runway.x &&
           this.x < runway.x + runway.width &&
           this.y > runway.y &&
           this.y < runway.y + runway.height;
  }
}

// =====================
// ====== МАССИВЫ И СОЗДАНИЕ САМОЛЁТОВ ======
const planes = [];

function spawnPlane() {
  if (planes.length >= MAX_PLANES) return;

  const { centerX, centerY, maxRadius } = ui.radar;
  const spawnRadius = maxRadius + OFFSCREEN_MARGIN;
  const angle = Math.random() * 360;

  const rad = (angle * Math.PI) / 180;
  const x = centerX + Math.cos(rad) * spawnRadius;
  const y = centerY + Math.sin(rad) * spawnRadius;

  const courseToCenter = (Math.atan2(centerY - y, centerX - x) * 180 / Math.PI + 90 + 360) % 360;
  const angleWithNoise = courseToCenter + (Math.random() * 30 - 15);

  planes.push(new Plane(x, y, angleWithNoise));
}

// =====================
// ====== СОБЫТИЯ ======
ui.canvas.addEventListener('click', e => {
  const rect = ui.canvas.getBoundingClientRect();

  // convert from CSS pixels to canvas pixels
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;
  const mx = (e.clientX - rect.left) * scaleX;
  const my = (e.clientY - rect.top) * scaleY;

  selectedPlane = null;
  planes.forEach(p => p.selected = false);

  const radiusSq = SELECT_RADIUS * SELECT_RADIUS; // ensure SELECT_RADIUS is in canvas pixels
  for (const p of planes) {
    const dx = mx - p.displayX;
    const dy = my - p.displayY;
    if (dx * dx + dy * dy < radiusSq) {
      p.selected = true;
      selectedPlane = p;
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
      selectedPlane.angle = newAngle;
      updatePlaneInfo(selectedPlane);
    }
  }

  if (action === 'set-flightlevel' && selectedPlane) {
    const newFL = parseInt(document.querySelector('[data-element="flightlevel-input"]').value);
    if (!isNaN(newFL) && newFL >= 0 && newFL <= 660) {
      selectedPlane.flightLevel = newFL;
      selectedPlane.altitude = newFL * 100;
      updatePlaneInfo(selectedPlane);
    }
  }
});

// =====================
// ====== ОБНОВЛЕНИЕ РАДАРА ======
function refreshDisplay() {
  planes.forEach(p => p.refreshDisplay());
  checkSTCA(planes);
}

// =====================
// ====== РИСОВАНИЕ ПОЛОСЫ ======
function drawRunway() {
  // Полоса
  ctx.fillStyle = 'gray';
  ctx.fillRect(runway.x, runway.y, runway.width, runway.height);

  // Линия финала (перед полосой)
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 1;

  ctx.beginPath();
  // допустим, линия горизонтальная сверху полосы
  ctx.moveTo(runway.x, runway.y + RUNWAY_HEIGHT / 2);
  ctx.lineTo(runway.x - FINAL_LENGTH, runway.y + RUNWAY_HEIGHT / 2);
  ctx.stroke();
}

// =====================
// ====== ИГРОВОЙ ЦИКЛ ======
let lastTime = performance.now();

function gameLoop(now) {
  const delta = (now - lastTime) / 1000; // секунды
  lastTime = now;
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  drawRadarGrid();
  drawRunway();

  for (let i=planes.length-1; i>=0; i--) {
    const p = planes[i];
    p.update(delta);

    // проверка посадки
    if (p.landed) {
      if (selectedPlane === p) { selectedPlane=null; updatePlaneInfo(null); }
      planes.splice(i,1);
      spawnPlane();
      continue;
    }

    // удаление за экран
    const dx = p.x - ui.radar.centerX;
    const dy = p.y - ui.radar.centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > ui.radar.maxRadius + OFFSCREEN_MARGIN + 20) {
      if (selectedPlane === p) { selectedPlane = null; updatePlaneInfo(null); }
      planes.splice(i, 1);
      spawnPlane();
    }
  }
  planes.forEach(p => p.draw());

  requestAnimationFrame(gameLoop);
}

// =====================
// ====== ЗАПУСК ======
resizeCanvas();
initRunway();
for (let i = 0; i < MAX_PLANES; i++) spawnPlane();
setInterval(spawnPlane, 2500);
refreshDisplay();
setInterval(refreshDisplay, RADAR_UPLOAD);
gameLoop(performance.now());