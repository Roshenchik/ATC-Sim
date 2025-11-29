// zoom.js
import { clamp } from "./utils.js";
import { ui } from "./ui.js";
import { drawStatics } from "./radarStatics.js";

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

// Конвертация координат мира → экран
export function worldToScreen({ x, y, ...sizes }) {

  const screenX = (x - camera.x) * camera.zoom + ui.canvas.width / 2;
  const screenY = (y - camera.y) * camera.zoom + ui.canvas.height / 2;

  const result = {
    x: screenX,
    y: screenY,
  };

  for (const key in sizes) {
    result[key] = sizes[key] * camera.zoom;
  }

  //console.log(ui.canvas.width/2)

  return result;
}

export function screenToWorld(screenX, screenY) {
  return {
    x: (screenX - ui.canvas.width / 2) / camera.zoom + camera.x,
    y: (screenY - ui.canvas.height / 2) / camera.zoom + camera.y,
  };
}

// export function onWheelScroll(e) {
//   e.preventDefault();
//   const zoomFactor = 1.5;
//   const mouseWorldBefore = screenToWorld(e.offsetX, e.offsetY, ui.canvas);

//   if (e.deltaY < 0) camera.zoom *= zoomFactor;
//   else camera.zoom /= zoomFactor;

//   camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);

//   const mouseWorldAfter = screenToWorld(e.offsetX, e.offsetY, ui.canvas);
//   camera.x += mouseWorldBefore.x - mouseWorldAfter.x;
//   camera.y += mouseWorldBefore.y - mouseWorldAfter.y;
//   console.log(camera.zoom)
// }

export function onKeyboardZoom(e) {
  const zoomStep = 0.1;

  if (e.key === '=' || e.key === '+') {
    camera.zoom += zoomStep;
  } else if (e.key === '-') {
    camera.zoom -= zoomStep;
  }

  // Ограничиваем зум
  camera.zoom = clamp(camera.zoom, camera.minZoom, camera.maxZoom);
}

let prevZoom = camera.zoom
export function checkZoomChange(ctx) {
  if (camera.zoom == prevZoom) return;

  //rerender statik elements
  drawStatics(ctx);


  prevZoom = camera.zoom;
}
