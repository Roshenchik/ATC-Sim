// planes.js
import { MAX_PLANES, OFFSCREEN_MARGIN } from "./constants.js";
import { degToRad, radToDeg } from "./utils.js";
// import { PlaneLogic } from "./planeLogic.js";
// import { PlaneView } from "./planeView.js";
import { Plane } from "./plane.js";
import { 
  ui,
  getSelectedPlane,
  setSelectedPlane,
  unsetSelectedPlane,
  updatePlaneInfo, 
  ctx,
} from "./ui.js";

// =====================
// ====== SPAWNING ======
export const planes = [];

export function spawnPlane(planeNum) {
  for (let i = 0; i < planeNum; i++) {
    if (planes.length >= MAX_PLANES) return;
  
    const { centerX, centerY, maxRadius } = ui.azimuthalGrid;;
    const spawnRadius = 50 + OFFSCREEN_MARGIN; //turn back maxRadius then

    const angle = Math.random() * 360;
    const rad = degToRad(angle);

    const x = centerX + Math.cos(rad) * spawnRadius;
    const y = centerY + Math.sin(rad) * spawnRadius;
  
    const courseToCenter = 
      (radToDeg(Math.atan2(centerY - y, centerX - x)) + 90 + 360) % 360;
      
    const headingDeviation = courseToCenter + Math.random() * 30 - 15;
  
    const plane = new Plane(x, y, headingDeviation, ctx);
  
    planes.push(plane);
  }
}

// ====== REMOVING PLANES ======
export function removePlane(planesArray, index) {
  const p = planesArray[index];
  const sp = getSelectedPlane();
  if (sp && sp === p) {
    unsetSelectedPlane(planesArray);
  }
  planesArray.splice(index, 1);
  spawnPlane(1);
}

// ====== CLEANUP ======
export function cleanupPlanes(planesArray, azimuthalGrid) {
  for (let i = planesArray.length - 1; i >= 0; i--) {
    const p = planesArray[i];
    if (p.landed || p.isOutOfRadar(azimuthalGrid)) {
      removePlane(planesArray, i);
    }
  }
}

// ====== RADAR REFRESH (refreshed after some interval) ====== 
export function updateRadarData(planes) {
  planes.forEach(p => p.getRadarResponse());
  Plane.checkSTCA(planes);
}

// ====== GETTER ======
export function getPlanes() {
  return planes;
}
