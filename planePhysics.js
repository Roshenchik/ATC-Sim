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

