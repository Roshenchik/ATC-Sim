import { getPlanes, cleanupPlanes } from "./planesManager.js";
import { renderStatic } from "./radarStatics.js";
import { ui, ctx } from "./ui.js";

let lastTime = performance.now();

export function gameLoop(now) {
  const delta = (now - lastTime) / 1000;
  lastTime = now;

  ctx.clearRect(0, 0, ui.canvas.width, ui.canvas.height);

  renderStatic(ctx);

  const planes = getPlanes();

  planes.forEach(p => p.update(delta));
  planes.forEach(p => p.drawAll());

  cleanupPlanes(planes, ui.azimuthalGrid);

  requestAnimationFrame(gameLoop);
}
