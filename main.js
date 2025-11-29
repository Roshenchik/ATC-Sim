import { ui, resizeCanvas } from "./ui.js";
import { 
    getAzimuthalGrid,
    getRunway,
    initStatics
} from "./radarStatics.js";

import { spawnPlane, updateRadarData, getPlanes } from "./planesManager.js";
import { gameLoop } from "./gameLoop.js";
import { MAX_PLANES, RADAR_UPLOAD } from "./constants.js";
import { setCameraOnObjCenter } from "./zoom.js";

// =====================
// ====== START ======
// =====================
resizeCanvas();

initStatics();

const rw = getRunway();
setCameraOnObjCenter(rw.x, rw.y, rw.width, rw.height);

// сохранить grid в ui, чтобы spawnPlane мог его видеть
ui.azimuthalGrid = getAzimuthalGrid();

// отрисовать статичный слой
// ——— SPAWNING ————
spawnPlane(MAX_PLANES);        // начальные самолеты
//setInterval(() => spawnPlane(1), 2500); // каждую секунду по 1

// ——— RADAR PINGS ————
const planes = getPlanes();
updateRadarData(planes);
setInterval(() => updateRadarData(planes), RADAR_UPLOAD);

// ——— GAME LOOP ————
gameLoop(performance.now());
