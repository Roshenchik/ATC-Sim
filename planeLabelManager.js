//planeLabelManager.js
import { screenToWorld } from "./zoom.js";
import { getMouseCoords } from "./ui.js";

// =====================
// ====== LABEL DRAGGING ======
let draggingLabel = null;
let dragStart = { x: null, y: null };
let startOffset = { x: null, y: null };

export function startLabelDrag(event, planes) {
  if (event.button !== 1) return;
  const m = (getMouseCoords(event))

  for (const p of planes) {
    if (p.renderer.isLabelHovered(m)) {
      draggingLabel = p;

      const dragStartWorld = screenToWorld({ x: m.x, y: m.y, })
      dragStart.x = dragStartWorld.x;
      dragStart.y = dragStartWorld.y;

      //convert label area to world coords
      const labelWorld = screenToWorld({x: p.renderer.labelArea.x1, y: p.renderer.labelArea.y1}); 

      p.renderer.labelOffsetWX = labelWorld.x - p.displayX;
      p.renderer.labelOffsetWY = labelWorld.y - p.displayY;

      startOffset.x =  p.renderer.labelOffsetWX;
      startOffset.y =  p.renderer.labelOffsetWY;

      break;
    }
  }
}

export function labelDrag(event) {
  if (!draggingLabel) return;
  const m = screenToWorld(getMouseCoords(event))

  const dx = m.x - dragStart.x;
  const dy = m.y - dragStart.y;

  draggingLabel.renderer.labelOffsetWX = dx + startOffset.x;
  draggingLabel.renderer.labelOffsetWY = dy + startOffset.y;
}

export function stopLabelDrag(event) {
  if (event.button !== 1) return;

  draggingLabel = null;
  dragStart = { x: null, y: null };
  startOffset = { x: null, y: null };
}