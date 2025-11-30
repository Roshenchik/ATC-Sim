// ui.js
import { MAX_SPEED_KPH, MIN_SPEED_KPH, MIN_FL, MAX_FL, SELECT_RADIUS, SIDEBAR_WIDTH, METERS_PER_PIXEL } from "./constants.js";
import { clamp } from "./utils.js";
import { getPlanes } from "./planesManager.js";
import { confirmAltitudeChange, confirmHeadingChange, confirmSpeedChange } from "./pilotReplyAudioApi.js";
import { Ruler } from "./ruler.js";
import { onKeyboardZoom, screenToWorld, worldToScreen, checkZoomChange } from "./zoom.js";

export const ui = {
  canvas: document.querySelector('[data-element="canvas"]'),
  planeInfo: document.querySelector('[data-element="plane-info"]'),
  headingInput: document.querySelector('[data-element="heading-input"]'),
  altitudeInput: document.querySelector('[data-element="flightlevel-input"]'),
  speedInput: document.querySelector('[data-element="speed-input"]'),
  pttLightElement: document.querySelector('[data-element="ptt-light"]'),
};

export const ctx = ui.canvas.getContext('2d');

let selectedPlane = null;
export function getSelectedPlane() { 
  return selectedPlane; 
}
export function setSelectedPlane(p) { 
  p.selected = true;
  selectedPlane = p; 
  updatePlaneInfo(p); 
}
export function unsetSelectedPlane(planeArr) { 
  planeArr.forEach(p => p.selected = false);
  selectedPlane = null;
  updatePlaneInfo(null); 
}
// =====================
// ====== CANVAS SIZE (DPI) ======
export function resizeCanvas() {
  ui.canvas.width = window.innerWidth - SIDEBAR_WIDTH;
  ui.canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);

// =====================
// ====== INFO PANEL ======
export function updatePlaneInfo(plane) {
  if (!plane) {
    ui.planeInfo.innerHTML = "<p>Select a flight</p>";
    return;
  }

  ui.planeInfo.innerHTML = `
    <p><b>${plane.callsign}</b></p>
    <p>Heading: ${plane.heading.toFixed(0)}°</p>
    <p>Speed: ${plane.groundSpeed} km/h</p>
    <p>Altitude: FL${plane.flightLevel}</p>
  `;
}

// =====================
// ====== SELECTION LOGIC ======
export function handleCanvasClick(event, planes) {
  const m = getMouseCoords(event)

  unsetSelectedPlane(planes);

  const radiusSq = SELECT_RADIUS * SELECT_RADIUS;
  for (const p of planes) {
    const screenPos = worldToScreen({ x: p.displayX, y: p.displayY });
    const dx = m.x - screenPos.x;
    const dy = m.y - screenPos.y;

    if (dx * dx + dy * dy < radiusSq) {
      setSelectedPlane(p)
      break;
    }
  }

  if (!selectedPlane) updatePlaneInfo(null);
}

// =====================
// ====== INPUT HANDLERS ======
export function handleDocumentClick(event) {
  if (!selectedPlane) return;

  const action = event.target.dataset.action;

  if (action === 'set-heading') {
    let newHeading = parseFloat(ui.headingInput.value);
    if (isNaN(newHeading)) return;
    if (newHeading >= 0 && newHeading < 360) {
      selectedPlane.targetHeading = newHeading;
      updatePlaneInfo(selectedPlane);
      confirmHeadingChange(selectedPlane, newHeading);
    }

  } else if (action === 'set-altitude') {
    let newFL = parseFloat(ui.altitudeInput.value);
    if (isNaN(newFL)) return;
    if (newFL >= MIN_FL && newFL <= MAX_FL) {
      selectedPlane.targetAltitude = newFL * 100;
      updatePlaneInfo(selectedPlane);
      confirmAltitudeChange(selectedPlane, newFL);
    }

  } else if (action === 'set-speed') {
    let newSpeed = parseFloat(ui.speedInput.value);
    if (isNaN(newSpeed)) return;
    newSpeed = clamp(newSpeed, MIN_SPEED_KPH, MAX_SPEED_KPH);
    selectedPlane.targetSpeed = newSpeed;
    updatePlaneInfo(selectedPlane);
    confirmSpeedChange(selectedPlane, newSpeed);
  }
}

// --- Measure tool state ---
let isMeasuring = false;   // идёт ли рисование превью
let measureStart = null;   // начало превью
let measureEnd = null;     // текущая позиция мыши
let rulers = [];           // сохранённые линейки

function onLeftClick(event) {
  const worldPos = screenToWorld(getMouseCoords(event));

  if (!isMeasuring) {
    // старт превью — только мировые координаты
    isMeasuring = true;
    measureStart = { ...worldPos };
    measureEnd = { ...worldPos };
    return;
  }

  // завершение — сохраняем линейку в мировых координатах
  rulers.push(new Ruler(measureStart.x, measureStart.y, measureEnd.x, measureEnd.y));

  // сброс превью
  isMeasuring = false;
  measureStart = null;
  measureEnd = null;
}

let lastMouseScreen = null;
function onMouseMove(event) {
  lastMouseScreen = getMouseCoords(event);

  if (isMeasuring) {
    measureEnd = screenToWorld(lastMouseScreen);
  }
}

function onRightClick(event) {
  event.preventDefault();

  const world = screenToWorld(getMouseCoords(event));

  // отмена текущего превью
  if (isMeasuring) {
    isMeasuring = false;
    measureStart = null;
    measureEnd = null;
    return;
  }

  // удаление ближайшей сохранённой линейки
  const threshold = 5;
  for (let i = 0; i < rulers.length; i++) {
    if (rulers[i].isNear(world.x, world.y, threshold)) {
      rulers.splice(i, 1);
      break;
    }
  }
}

// рисование всех сохранённых линейок
export function drawSavedRulers(ctx) {
  rulers.forEach(r => r.draw(ctx));
}

// рисование превью
export function drawPreviewRuler(ctx) {
  if (!isMeasuring || !measureStart || !measureEnd) return;

  measureEnd = screenToWorld(lastMouseScreen);

  new Ruler(measureStart.x, measureStart.y, measureEnd.x, measureEnd.y)
    .draw(ctx, "rgba(0,255,255,0.9)");
}

export function setPttActive(active) {
  if (!ui.pttLightElement) return;
  ui.pttLightElement.classList.toggle("active", active);
}

function getMouseCoords(event) {
  const rect = ui.canvas.getBoundingClientRect();
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

// =====================
// ====== EVENT LISTENERS ======
ui.canvas.addEventListener("mousemove", onMouseMove);

ui.canvas.addEventListener("mousedown", e => {
  if (e.button === 0) onLeftClick(e);
  if (e.button === 2) onRightClick(e);
});

// блокируем дефолтное контекстное меню
ui.canvas.addEventListener("contextmenu", e => e.preventDefault());

ui.canvas.addEventListener('click', e => handleCanvasClick(e, getPlanes() || []));

document.addEventListener('keydown', e => onKeyboardZoom(e));

document.addEventListener('click', handleDocumentClick);
