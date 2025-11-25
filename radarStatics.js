import { RUNWAY_WIDTH, RUNWAY_LENGTH, SIDEBAR_WIDTH, FINAL_LENGTH, FINAL_BUFFER } from "./constants.js";
import { degToRad } from "./utils.js";

// ============================
// INITIALIZERS
// ============================
let staticCanvas;     
let staticCtx;
export function initStaticCanvas(rw, grid, mainCanvas) {
  staticCanvas = document.createElement('canvas');
  staticCanvas.width = mainCanvas.width;
  staticCanvas.height = mainCanvas.height;

  staticCtx = staticCanvas.getContext('2d');

  drawRunway(staticCtx, rw);
  drawFinalLegLine(staticCtx, rw);
  drawAzimuthalGrid(staticCtx, grid);
}

export function renderStatic(ctx) {
  ctx.drawImage(staticCanvas, 0, 0);
}

let runway
export function initRunway() {
  runway = { x: 0, y: 0, width: RUNWAY_LENGTH, height: RUNWAY_WIDTH };

  const radarFieldWidth = window.innerWidth - SIDEBAR_WIDTH;
  const radarFieldHeight = window.innerHeight;

  runway.x = radarFieldWidth / 2 - RUNWAY_LENGTH / 2;
  runway.y = radarFieldHeight / 2 - RUNWAY_WIDTH / 2;

  return runway;
}
export function getRunway() { return runway; }

let finalLegArea;
export function initFinalLegArea(rw) {
  finalLegArea = {
    x1: rw.x - FINAL_LENGTH,
    y1: rw.y - FINAL_BUFFER,
    x2: rw.x,
    y2: rw.y + rw.height + FINAL_BUFFER
  };
  return finalLegArea;
}
export function getFinalLegArea() { return finalLegArea; }


export function initAzimuthalGrid(rw, canvas) {
  return {
    centerX: rw.x + rw.width / 2,
    centerY: rw.y + rw.height / 2,
    maxRadius: Math.min(canvas.width, canvas.height) / 2
  };
}

// ============================
// DRAWING HELPERS
// ============================
export function drawRunway(ctx, rw) {
  ctx.fillStyle = 'gray';
  ctx.fillRect(rw.x, rw.y, rw.width, rw.height);
}

export function drawFinalLegLine(ctx, rw) {
  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rw.x, rw.y + rw.height / 2);
  ctx.lineTo(rw.x - FINAL_LENGTH, rw.y + rw.height / 2);
  ctx.stroke();
}

export function drawAzimuthalGrid(ctx, grid) {
  const { centerX, centerY, maxRadius } = grid;
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
