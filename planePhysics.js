// planePhysics.js
import { degToRad, radToDeg, normalizeAngle } from "./utils.js";

export function shortestAngleDiff(target, current) {
  return normalizeAngle(target - current + 180) - 180;
}

export function turnDirection(target, current) {
  return Math.sign(shortestAngleDiff(target, current));
}

export function calcTurningRadius(speed, bankAngle) {
  const g = 9.81;
  const V = speed / 3.6;
  const phi = bankAngle * Math.PI / 180;
  return V * V / (g * Math.tan(phi));
}

export function calcMaxAngularSpeed(speed, bankAngle) {
  const R = calcTurningRadius(speed, bankAngle);
  const V = speed / 3.6;
  return radToDeg(V / R);
}

export function planeInArea(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;

    const intersect = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);

    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceToLineAxis(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  
  // нормаль к линии
  const nx = -dy;
  const ny = dx;
  
  // вектор от начала линии до точки
  const vx = px - x1;
  const vy = py - y1;
  
  // проекция на нормаль
  const dist = (vx * nx + vy * ny) / Math.sqrt(nx*nx + ny*ny);
  return dist; // может быть положительное или отрицательное
}

export function timeToCrossLine(plane, lineStart, lineEnd) {
  // расстояние до линии через твою функцию
  const distance = distanceToLineAxis(
    plane.x, plane.y,
    lineStart.x, lineStart.y,
    lineEnd.x, lineEnd.y
  );

  // угол линии
  const lineAngle = Math.atan2(lineEnd.y - lineStart.y, lineEnd.x - lineStart.x);
  const headingRad = degToRad(plane.heading);

  // скорость по нормали к линии
  const speedPerp = plane.speed * Math.sin(headingRad - lineAngle);

  if (speedPerp === 0) return Infinity; // движется параллельно линии
  return distance / speedPerp;
}