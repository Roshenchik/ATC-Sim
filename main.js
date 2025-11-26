import { ui, resizeCanvas } from "./ui.js";
import { 
    initRunway, 
    initAzimuthalGrid, 
    initStaticCanvas, 
    initFinalLegArea
} from "./radarStatics.js";

import { spawnPlane, updateRadarData, getPlanes } from "./planesManager.js";
import { gameLoop } from "./gameLoop.js";
import { MAX_PLANES, RADAR_UPLOAD } from "./constants.js";

// =====================
// ====== START ======
// =====================
resizeCanvas();

const runway = initRunway();
initFinalLegArea(runway);
const azimuthalGrid = initAzimuthalGrid(runway, ui.canvas);

// сохранить grid в ui, чтобы spawnPlane мог его видеть
ui.azimuthalGrid = azimuthalGrid;

// отрисовать статичный слой
initStaticCanvas(runway, azimuthalGrid, ui.canvas);

// ——— SPAWNING ————
spawnPlane(MAX_PLANES);        // начальные самолеты
//setInterval(() => spawnPlane(1), 2500); // каждую секунду по 1

// ——— RADAR PINGS ————
const planes = getPlanes();
updateRadarData(planes);
setInterval(() => updateRadarData(planes), RADAR_UPLOAD);

// ——— GAME LOOP ————
gameLoop(performance.now());
