// zoom.js
import { clamp } from "./utils.js";
import { ui } from "./ui.js";

export const camera = {
  x: 0, // центр камеры в world coordinates
  y: 0,
  zoom: 1,
  minZoom: 0.5,
  maxZoom: 4,
};

export function setCameraOnObjCenter(x, y, width, height) {
  camera.x = x + width / 2;
  camera.y = y + height / 2;
}

// Convertions
export function worldToScreen({ x, y, ...sizes }) {
  const result = {
    x: (x - camera.x) * camera.zoom + ui.canvas.width / 2,
    y: (y - camera.y) * camera.zoom + ui.canvas.height / 2,
  };

  for (const key in sizes) {
    result[key] = sizes[key] * camera.zoom;
  }

  return result;
}

export function screenToWorld({ x, y, ...sizes }) {
  const result = {
    x: (x - ui.canvas.width / 2) / camera.zoom + camera.x,
    y: (y - ui.canvas.height / 2) / camera.zoom + camera.y,
  };

  for (const key in sizes) {
    result[key] = sizes[key] / camera.zoom;
  }

  return result;
}


//ZOOM
export function onWheelZoom(e) {
  e.preventDefault();
  const zoomStep = 0.1;

  camera.zoom += e.deltaY < 0 ? -zoomStep : zoomStep;
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
}

export function onKeyboardZoom(e) {
  const zoomStep = 0.1;

  if (e.key === '=' || e.key === '+') {
    camera.zoom += zoomStep;
  } else if (e.key === '-') {
    camera.zoom -= zoomStep;
  }
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
}

let prevZoom = camera.zoom
export function checkZoomChange() {
  if (camera.zoom == prevZoom) return;
  prevZoom = camera.zoom;
  return true
}


//CAMERA MOVE
let isCameraDragging = false;
let cameraDragStartScreen = null;
export function startCameraDrag(event) {
  if (event.button !== 1) return; // средняя кнопка
  isCameraDragging = true;
  cameraDragStartScreen = { x: event.clientX, y: event.clientY };
}

export function dragCamera(event) {
  if (!isCameraDragging) return;

  const dx = (cameraDragStartScreen.x - event.clientX) / camera.zoom;
  const dy = (cameraDragStartScreen.y - event.clientY) / camera.zoom;

  camera.x += dx;
  camera.y += dy;

  cameraDragStartScreen = { x: event.clientX, y: event.clientY };
}

export function stopCameraDrag(event) {
  if (event.button !== 1) return;
  isCameraDragging = false;
  cameraDragStartScreen = null;
}






