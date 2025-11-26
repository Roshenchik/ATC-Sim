// ui.js
import { MAX_SPEED_KPH, MIN_SPEED_KPH, MIN_FL, MAX_FL, SELECT_RADIUS, SIDEBAR_WIDTH, METERS_PER_PIXEL } from "./constants.js";
import { clamp } from "./utils.js";
import { getPlanes } from "./planesManager.js";
import { confirmAltitudeChange, confirmHeadingChange, confirmSpeedChange } from "./pilotReplyAudioApi.js";

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
  const rect = ui.canvas.getBoundingClientRect();
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;
  const mx = (event.clientX - rect.left) * scaleX;
  const my = (event.clientY - rect.top) * scaleY;

  unsetSelectedPlane(planes);

  const radiusSq = SELECT_RADIUS * SELECT_RADIUS;
  for (const p of planes) {
    const dx = mx - p.displayX;
    const dy = my - p.displayY;

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

// =====================
// ====== DRAWING RULER ======
// --- Measure tool state ---
let isMeasuring = false;
let measureStart = null;
let measureEnd = null;

function getMouseCoords(event) {
  const rect = ui.canvas.getBoundingClientRect();
  const scaleX = ui.canvas.width / rect.width;
  const scaleY = ui.canvas.height / rect.height;

  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY
  };
}

function onMeasureStart(event) {
  // чтобы не конфликтовало — только ЛКМ
  if (event.button !== 0) return;

  isMeasuring = true;
  measureStart = getMouseCoords(event);
  measureEnd = { ...measureStart };
}

function onMeasureMove(event) {
  if (!isMeasuring) return;
  measureEnd = getMouseCoords(event);
}

function onMeasureEnd(event) {
  if (!isMeasuring) return;

  isMeasuring = false;
  measureStart = null;
  measureEnd = null;
}

export function drawMeasureTool(ctx) {
  if (!isMeasuring || !measureStart || !measureEnd) return;

  ctx.save();

  const x1 = measureStart.x;
  const y1 = measureStart.y;
  const x2 = measureEnd.x;
  const y2 = measureEnd.y;

  ctx.strokeStyle = "rgba(0,255,255,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  // вычисления
  const dx = x2 - x1;
  const dy = y2 - y1;
  const pixDist = Math.sqrt(dx * dx + dy * dy);

  // твоя константа METERS_PER_PIXEL
  const meters = pixDist * METERS_PER_PIXEL;
  const km = meters / 1000;

  // азимут (0° — вверх)
  let angleRad = Math.atan2(dx, -dy);
  let angleDeg = (angleRad * 180 / Math.PI + 360) % 360;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const label = `${km.toFixed(2)} km | ${angleDeg.toFixed(0)}°`;

  // фон
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(midX - 60, midY - 12, 120, 20);

  // текст
  ctx.fillStyle = "cyan";
  ctx.font = "13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, midX, midY);

  ctx.restore();
}


export function setPttActive(active) {
  if (!ui.pttLightElement) return;
  ui.pttLightElement.classList.toggle("active", active);
}

// =====================
// ====== EVENT LISTENERS ======
ui.canvas.addEventListener("mousedown", onMeasureStart);
ui.canvas.addEventListener("mousemove", onMeasureMove);
ui.canvas.addEventListener("mouseup", onMeasureEnd);

ui.canvas.addEventListener('click', e => handleCanvasClick(e, getPlanes() || []));
document.addEventListener('click', handleDocumentClick);
