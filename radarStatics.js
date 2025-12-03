import { RUNWAY_WIDTH, RUNWAY_LENGTH, SIDEBAR_WIDTH, FINAL_LENGTH, FINAL_BUFFER, RADAR_RADIUS } from "./constants.js";
import { degToRad, radToDeg } from "./utils.js";
import { camera, worldToScreen } from "./zoom.js";


let runway
let finalLegArea;
let azimuthalGrid

export function initStatics() {
    runway = initRunway();
    finalLegArea = initFinalLegArea(runway);
    azimuthalGrid = initAzimuthalGrid(runway);
}

export function initRunway(headingDeg = 130) {
  runway = {
     x: 0,
     y: 0,
    width: RUNWAY_LENGTH,
    height: RUNWAY_WIDTH,
    heading: headingDeg,
    get altHeading() {
      return (this.heading + 180) % 360;
    }
  };

  const radarFieldWidth = window.innerWidth - SIDEBAR_WIDTH;
  const radarFieldHeight = window.innerHeight;

  runway.x = radarFieldWidth / 2 - RUNWAY_LENGTH / 2;
  runway.y = radarFieldHeight / 2 - RUNWAY_WIDTH / 2;

  return runway;
}

export function initFinalLegArea(rw) {
  const angle = degToRad(rw.heading - 90);

  // локальные точки финального сектора
  const p1 = { x: rw.x - FINAL_LENGTH, y: rw.y - FINAL_BUFFER };
  const p2 = { x: rw.x,                y: rw.y - FINAL_BUFFER };
  const p3 = { x: rw.x,                y: rw.y + rw.height + FINAL_BUFFER };
  const p4 = { x: rw.x - FINAL_LENGTH, y: rw.y + rw.height + FINAL_BUFFER };

  // центр вращения — середина полосы
  const cx = rw.x + rw.width / 2;
  const cy = rw.y + rw.height / 2;

  // поворачиваем
  const fa1 = rotatePoint(p1.x, p1.y, cx, cy, angle);
  const fa2 = rotatePoint(p2.x, p2.y, cx, cy, angle);
  const fa3 = rotatePoint(p3.x, p3.y, cx, cy, angle);
  const fa4  = rotatePoint(p4.x, p4.y, cx, cy, angle);

  return finalLegArea = [fa1, fa2, fa3, fa4];
}

export function initAzimuthalGrid(rw) {
  azimuthalGrid = {
    centerX: rw.x + rw.width / 2,
    centerY: rw.y + rw.height / 2,
    maxRadius: RADAR_RADIUS,
  };
  return azimuthalGrid;
}

//To rotate points around center of runway. 
//For initial placement of objects according to runway heading
function rotatePoint(px, py, cx, cy, angleRad) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = px - cx;
  const dy = py - cy;

  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos
  };
}

export function getRunway() { return runway; }
export function getFinalLegArea() { return finalLegArea; }
export function getAzimuthalGrid() { return azimuthalGrid; }

// ============================
// DRAWING HELPERS
// ============================
export function drawStatics(ctx) {
    drawRunway(ctx, runway);
    drawFinalLegLine(ctx, runway, finalLegArea);
    drawAzimuthalGrid(ctx, azimuthalGrid);
}

export function drawRunway(ctx, rw) {
  const scld = worldToScreen(rw);

  const cx = scld.x + scld.width / 2;
  const cy = scld.y + scld.height / 2;

  ctx.save();

  // Перенос в центр полосы
  ctx.translate(cx, cy);

  // Поворот вокруг центра
  ctx.rotate((rw.heading - 90) * Math.PI / 180);

  // Рисуем прямоугольник ВОКРУГ центра
  ctx.fillStyle = "gray";
  ctx.fillRect(-scld.width / 2, -scld.height / 2, scld.width, scld.height);

  ctx.restore();
}

export function drawFinalLegLine(ctx, rw, fa) {
  const scldRw = worldToScreen(rw)
  const scldFl = FINAL_LENGTH * camera.zoom;

  const cx = scldRw.x + scldRw.width / 2;
  const cy = scldRw.y + scldRw.height / 2;

  ctx.save();

  ctx.strokeStyle = 'green';
  ctx.lineWidth = 1;

  ctx.translate(cx, cy);
  ctx.rotate((rw.heading - 90) * Math.PI / 180);

  ctx.beginPath();
  ctx.moveTo(-scldRw.width / 2, 0);
  ctx.lineTo(-scldRw.width / 2 - scldFl, 0);
  ctx.stroke();

  ctx.restore();

  const scaledFa = fa.map(pt => worldToScreen(pt));
  ctx.strokeStyle = 'red';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(scaledFa[0].x, scaledFa[0].y);
  ctx.lineTo(scaledFa[1].x, scaledFa[1].y);
  ctx.lineTo(scaledFa[2].x, scaledFa[2].y);
  ctx.lineTo(scaledFa[3].x, scaledFa[3].y);
  ctx.lineTo(scaledFa[0].x, scaledFa[0].y); 
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
