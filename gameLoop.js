import { getPlanes, cleanupPlanes } from "./planesManager.js";
import { drawStatics } from "./radarStatics.js";
import { ui, ctx, drawSavedRulers, drawPreviewRuler } from "./ui.js";
import { checkZoomChange } from "./zoom.js";

let lastTime = performance.now();

export function gameLoop(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

  drawStatics(ctx);

  const planes = getPlanes();

  planes.forEach(p => p.update(delta));
  planes.forEach(p => p.drawAll());

  cleanupPlanes(planes, ui.azimuthalGrid);

  drawSavedRulers(ctx);
  drawPreviewRuler(ctx);

  //=checkZoomChange(ctx)

  requestAnimationFrame(gameLoop);
}
