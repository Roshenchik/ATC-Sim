// constants.js

// real sizes
const RUNWAY_LENGTH_M = 3000;
const RUNWAY_WIDTH_M = 60;
const FINAL_LENGTH_M = 20000;
const FINAL_BUFFER_M = 100;
const STCA_RADIUS_M = 10000;
const OFFSCREEN_MARGIN_M = 10000;
const RADAR_RADIUS_M = 20000;
const VECTOR_LENGTH_M = 5000;
export const VECTOR_WIDTH = 1; //px
export const STCA_VERT_DIST_F = 300;

// speeds
export const MIN_SPEED_KPH = 600;
export const MAX_SPEED_KPH = 900;

export const ACCELERATION_KPH_PER_SEC = 5;
export const DECELERATION_KPH_PER_SEC = 5;



// altitude
export const FLIGHTLEVELS = [170, 180, 190, 200, 210, 220,];
export const MIN_FL = 0;
export const MAX_FL = 660;
export const MAX_CLIMB_RATE_FPM = 2500;
export const MAX_DESCENT_RATE_FPM = 3000;

// px scaling
const RUNWAY_LENGTH_PX = 15;

export const METERS_PER_PIXEL = RUNWAY_LENGTH_M / RUNWAY_LENGTH_PX;

export function metersToPixels(meters) {
  return meters / METERS_PER_PIXEL;
}

export function kphToPxPerSec(kph) {
  return (kph / 3.6) / METERS_PER_PIXEL;
}

// derived values
export const RUNWAY_LENGTH = RUNWAY_LENGTH_PX;
export const RUNWAY_WIDTH = (RUNWAY_WIDTH_M / METERS_PER_PIXEL) + 3;
export const FINAL_LENGTH = metersToPixels(FINAL_LENGTH_M);
export const FINAL_BUFFER = metersToPixels(FINAL_BUFFER_M);
export const STCA_RADIUS = metersToPixels(STCA_RADIUS_M);
export const OFFSCREEN_MARGIN = metersToPixels(OFFSCREEN_MARGIN_M);
export const RADAR_RADIUS = metersToPixels(RADAR_RADIUS_M);
export const VECTOR_LENGTH = metersToPixels(VECTOR_LENGTH_M);

export const SIDEBAR_WIDTH = 260;
export const PLANE_SIZE = 4;
export const SELECT_RADIUS = Math.sqrt(2 * PLANE_SIZE * PLANE_SIZE);
export const RADAR_UPLOAD = 5000;
export const MAX_PLANES = 8;
export const AIRLINES = ["SAS", "DLH", "BAW", "AFL", "RYR", "KLM"];

export const PTT_BUTTON = 'Space';


