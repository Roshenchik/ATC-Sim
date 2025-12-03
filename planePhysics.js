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

