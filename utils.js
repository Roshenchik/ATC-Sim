import { METERS_PER_PIXEL } from "./constants.js";
// =====================
// ====== HELPERS ======
// =====================
export function normalizeAngle(angle) { return (angle % 360 + 360) % 360; }
export function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }


//converters
export function metersToPixels(meters) { return meters / METERS_PER_PIXEL; }
export function kphToPxPerSec(kph) { return (kph / 3.6) / METERS_PER_PIXEL; }
export function degToRad(deg) { return deg * Math.PI / 180; }
export function radToDeg(rad) { return rad * 180 / Math.PI; }