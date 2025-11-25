// ui.js
import { MAX_SPEED_KPH, MIN_SPEED_KPH, MIN_FL, MAX_FL, SELECT_RADIUS, SIDEBAR_WIDTH } from "./constants.js";
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

export function setPttActive(active) {
  if (!ui.pttLightElement) return;
  ui.pttLightElement.classList.toggle("active", active);
}

// =====================
// ====== EVENT LISTENERS ======
ui.canvas.addEventListener('click', e => handleCanvasClick(e, getPlanes() || []));
document.addEventListener('click', handleDocumentClick);
