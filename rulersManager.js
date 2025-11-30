//rulerManager.js
import { Ruler } from "./ruler.js";
import { getMouseCoords } from "./ui.js"
import { screenToWorld } from "./zoom.js";


// --- Measure tool state ---
let isMeasuring = false;   // идёт ли рисование превью
let measureStart = null;   // начало превью
let measureEnd = null;     // текущая позиция мыши
let lastMouseScreen = null;
let rulers = [];           // сохранённые линейки

export function rulerHandleLeftClick(event) {
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

export function rulerHandleRightClick(event) {
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

export function rulerHandleMouseMove(event) {
  lastMouseScreen = getMouseCoords(event);

  if (isMeasuring) {
    measureEnd = screenToWorld(lastMouseScreen);
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