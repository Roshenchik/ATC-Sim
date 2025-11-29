import { RUNWAY_WIDTH, RUNWAY_LENGTH, SIDEBAR_WIDTH, FINAL_LENGTH, FINAL_BUFFER, RADAR_RADIUS } from "./constants.js";
import { degToRad } from "./utils.js";
import { ui } from "./ui.js";
import { camera, worldToScreen } from "./zoom.js";

// ============================
// INITIALIZERS
// ============================
// let staticCanvas;     
// let staticCtx;
// export function initStaticCanvas(rw, grid, mainCanvas) {
//   staticCanvas = document.createElement('canvas');
//   staticCanvas.width = mainCanvas.width;
//   staticCanvas.height = mainCanvas.height;

//   staticCtx = staticCanvas.getContext('2d');

//   drawRunway(staticCtx, rw);
//   drawFinalLegLine(staticCtx, rw);
//   drawAzimuthalGrid(staticCtx, grid);
// }

let runway
let finalLegArea;
let azimuthalGrid

export function initStatics() {
    runway = initRunway();
    finalLegArea = initFinalLegArea(runway);
    azimuthalGrid = initAzimuthalGrid(runway);
}

export function initRunway() {
  runway = { x: 0, y: 0, width: RUNWAY_LENGTH, height: RUNWAY_WIDTH };

  const radarFieldWidth = window.innerWidth - SIDEBAR_WIDTH;
  const radarFieldHeight = window.innerHeight;

  runway.x = radarFieldWidth / 2 - RUNWAY_LENGTH / 2;
  runway.y = radarFieldHeight / 2 - RUNWAY_WIDTH / 2;

  return runway;
}

export function initFinalLegArea(rw) {
  finalLegArea = {
    x1: rw.x - FINAL_LENGTH,
    y1: rw.y - FINAL_BUFFER,
    x2: rw.x,
    y2: rw.y + rw.height + FINAL_BUFFER
  };
  return finalLegArea;
}

export function initAzimuthalGrid(rw) {
  azimuthalGrid = {
    centerX: rw.x + rw.width / 2,
    centerY: rw.y + rw.height / 2,
    maxRadius: RADAR_RADIUS,
  };
  return azimuthalGrid;
}

export function getRunway() { return runway; }
export function getFinalLegArea() { return finalLegArea; }
export function getAzimuthalGrid() { return azimuthalGrid; }

// ============================
// DRAWING HELPERS
// ============================
export function drawStatics(ctx) {
    drawRunway(ctx, runway);
    drawFinalLegLine(ctx, runway);
    drawAzimuthalGrid(ctx, azimuthalGrid);
}

export function renderStatic(ctx) {
  ctx.save();

  ctx.drawImage(staticCanvas, 0, 0);

  ctx.restore();
}

export function drawRunway(ctx, rw) {
  const scldRw = worldToScreen(rw)

  ctx.fillStyle = 'gray';
  ctx.fillRect(scldRw.x, scldRw.y, scldRw.width, scldRw.height);
}

export function drawFinalLegLine(ctx, rw) {
  const scldRw = worldToScreen(rw)
  const scldFl = FINAL_LENGTH * camera.zoom;

  ctx.strokeStyle = 'gray';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(scldRw.x, scldRw.y + scldRw.height / 2);
  ctx.lineTo(scldRw.x - scldFl, scldRw.y + scldRw.height / 2);
  ctx.stroke();
}

export function drawAzimuthalGrid(ctx, grid) {
  const scaled = worldToScreen({ 
    x: grid.centerX,
    y: grid.centerY,
    maxRadius: grid.maxRadius
  });
  const { x: centerX, y: centerY, maxRadius } = scaled;

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
