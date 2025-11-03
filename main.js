// =====================
// ====== КОНСТАНТЫ ======
// =====================
const SIDEBAR_WIDTH = 260;
const RUNWAY_WIDTH = 60; 
const RUNWAY_HEIGHT = 7;
const FINAL_LENGTH = 100; 
const FINAL_BUFFER = 5; // допустимая зона в файнале для начала захода
const PLANE_SIZE = 7;
const VECTOR_LENGTH = 30;
const PLANE_SPEED = 0.01;
const SELECT_RADIUS = Math.sqrt(PLANE_SIZE ** 2.5 + PLANE_SIZE ** 2.5);
const RADAR_UPLOAD = 6000;
const STCA_RADIUS = 50;
const MAX_PLANES = 8;
const OFFSCREEN_MARGIN = 50; // расстояние за пределами canvas, после которого самолет удаляется


// =====================
// ====== DOM ЭЛЕМЕНТЫ ======
const ui = {
  canvas: document.querySelector('[data-element="canvas"]'),
  planeInfo: document.querySelector('[data-element="plane-info"]'),
  courseInput: document.querySelector('[data-element="course-input"]'),
};
const ctx = ui.canvas.getContext('2d');
let selectedPlane = null;

// =====================
// ====== ПОЛОСА ======
const runway = { x: 0, y: 0, width: RUNWAY_WIDTH, height: RUNWAY_HEIGHT };
// зона финала перед полосой
const finalZone = { x1: 0, y1: 0, x2: 0, y2: 0 };

// фиксируем положение полосы в центре экрана при старте
function initRunway() {
  runway.x = (window.innerWidth - SIDEBAR_WIDTH) / 2 - RUNWAY_WIDTH / 2;
  runway.y = window.innerHeight / 2 - RUNWAY_HEIGHT / 2;

  // пересчитываем финальную зону один раз
  finalZone.x1 = runway.x - FINAL_LENGTH;
  finalZone.y1 = runway.y - FINAL_BUFFER;
  finalZone.x2 = runway.x;
  finalZone.y2 = runway.y + RUNWAY_HEIGHT + FINAL_BUFFER;
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
  ui.planeInfo.innerHTML = `<p><b>Самолёт</b></p><p>Курс: ${plane.angle.toFixed(0)}°</p>`;
}

function checkSTCA(planes) {
  planes.forEach(p => p.stca = false);

  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      const a = planes[i];
      const b = planes[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) < STCA_RADIUS) {
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
  }
  
  update() {
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
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      } else {
        this.x = targetX;
        this.y = targetY;
        this.landed = true;
      }
    } else {
      // обычное движение
      const rad = ((this.angle - 90) * Math.PI) / 180;
      this.x += this.speed * Math.cos(rad);
      this.y += this.speed * Math.sin(rad);

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

  const side = Math.floor(Math.random() * 4);
  let x, y, angle;

  switch (side) {
    case 0: x = Math.random() * ui.canvas.width; y = -10; angle = 180 + (Math.random() * 60 - 30); break;
    case 1: x = Math.random() * ui.canvas.width; y = ui.canvas.height + 10; angle = 0 + (Math.random() * 60 - 30); break;
    case 2: x = -10; y = Math.random() * ui.canvas.height; angle = 90 + (Math.random() * 60 - 30); break;
    case 3: x = ui.canvas.width + 10; y = Math.random() * ui.canvas.height; angle = 270 + (Math.random() * 60 - 30); break;
  }

  planes.push(new Plane(x, y, angle));
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
function gameLoop() {
  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);
  drawRunway();

  for (let i=planes.length-1; i>=0; i--) {
    const p = planes[i];
    p.update();

    // проверка посадки
    if (p.landed) {
      if (selectedPlane === p) { selectedPlane=null; updatePlaneInfo(null); }
      planes.splice(i,1);
      spawnPlane();
      continue;
    }

    // удаление за экран
    if (p.x<-OFFSCREEN_MARGIN || p.x>ui.canvas.width+OFFSCREEN_MARGIN || p.y<-OFFSCREEN_MARGIN || p.y>ui.canvas.height+OFFSCREEN_MARGIN) {
      if (selectedPlane === p) { selectedPlane=null; updatePlaneInfo(null); }
      planes.splice(i,1);
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
gameLoop();
