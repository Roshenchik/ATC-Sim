// PlaneRenderer.js
import { worldToScreen } from "./zoom.js";
import { degToRad } from "./utils.js";
import { PLANE_SIZE, VECTOR_WIDTH, VECTOR_LENGTH } from "./constants.js";

const COLORS = {
  STCA_PLANE: 'rgba(255,0,0,1)',
  DEFAULT_PLANE: 'rgba(255,255,255,1)',
  SELECTED_PLANE: 'rgba(145,255,0,1)',
};
const OUTLINE_COLORS = Object.fromEntries(
  Object.entries(COLORS).map(([k,v]) => [k, v.replace(/[\d\.]+\)$/, '0.2)')])
);

export class PlaneRenderer {
  constructor(plane) {
    this.plane = plane;
    this.ctx = plane.ctx;

    //for label dragging
    this.labelOffsetWX = null;
    this.labelOffsetWY = null;
    this.labelArea = {x1: 0, y1: 0, x2: 0, y2: 0};
  }

   drawPlane() {
    //FOR TESTING ONLY
    const { x: displayX, y: displayY, heading, selected, stca } = this.plane;
    //=================

    // const { displayX, displayY, displayHeading: heading, selected, stca } = this.plane;
    const ctx = this.ctx;

    const { x, y, vector } = worldToScreen({ 
      x: displayX,
      y: displayY,
      vector: VECTOR_LENGTH
    });

    const fillColor = stca 
      ? COLORS.STCA_PLANE 
      : (selected ? COLORS.SELECTED_PLANE : COLORS.DEFAULT_PLANE);

    const outlineColor = stca
      ? OUTLINE_COLORS.STCA_PLANE
      : (selected ? OUTLINE_COLORS.SELECTED_PLANE : OUTLINE_COLORS.DEFAULT_PLANE);

    // diamond shape
    ctx.beginPath();
    ctx.moveTo(x, y - PLANE_SIZE);
    ctx.lineTo(x + PLANE_SIZE, y);
    ctx.lineTo(x, y + PLANE_SIZE);
    ctx.lineTo(x - PLANE_SIZE, y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();

    ctx.strokeStyle = outlineColor;
    ctx.stroke();

    // heading vector (line)
    const rad = degToRad(heading - 90);
    const x2 = x + Math.cos(rad) * vector;
    const y2 = y + Math.sin(rad) * vector;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);

    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = VECTOR_WIDTH;
    ctx.stroke();
  }

  drawLabel() {
    // ===== Label settings =====
    const LABEL_FONT = '10px monospace';
    const LABEL_LINE_HEIGHT = 12;
    const LABEL_PADDING_X = 4;
    const LABEL_PADDING_Y = 2;
    const LABEL_BOX_ALPHA = 0.5;
    const LABEL_OFFSET = 13; // расстояние от самолета к началу формуляра

    //FOR TESTING ONLY====
    const { 
      x: displayX, 
      y: displayY,      
      heading, 
      selected, 
      callsign, 
      groundSpeed, 
      flightLevel 
    } = this.plane;
    //===================

    // const {
    //   displayX,
    //   displayY,
    //   displayHeading: heading, 
    //   selected, 
    //   callsign, 
    //   groundSpeed, 
    //   flightLevel 
    // } = this.plane;

    const offsetX = this.labelOffsetWX;
    const offsetY = this.labelOffsetWY; 
      
    const ctx = this.ctx;

    const { x, y, } = worldToScreen({ x: displayX, y: displayY, });
    const rad = degToRad(heading - 90);

    // ===== Текст =====
    const lines = [
      `${callsign}`,
      `HDG ${heading.toFixed(0).padStart(3,'0')}`,
      `SPD ${groundSpeed.toFixed(0)}`,
      `FL ${flightLevel}`
    ];

    ctx.save();
    ctx.font = LABEL_FONT;
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;

    // ===== Размеры текста =====
    let maxWidth = 0;
    for (const line of lines) {
      maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    }

    const boxWidth = maxWidth + LABEL_PADDING_X * 2;;
    const boxHeight = lines.length * LABEL_LINE_HEIGHT + LABEL_PADDING_Y * 2;

    // ===== ОТСТУП ФОРМУЛЯРА ОТ САМОЛЁТА =====
    // ===== Стандартный offset =====
    const baseOffsetX = -Math.sin(rad) * LABEL_OFFSET;
    const baseOffsetY =  Math.cos(rad) * LABEL_OFFSET;

    // ===== Оптимизация положения по секторам =====
    let finalOffsetX = baseOffsetX;
    let finalOffsetY = baseOffsetY;

    const normalizedHeading = heading % 360;

    if (normalizedHeading > 90 && normalizedHeading <= 180) {
      finalOffsetX -= boxWidth;
    } else if (normalizedHeading > 180 && normalizedHeading <= 270) {
      finalOffsetX = -baseOffsetX;
      finalOffsetY = -baseOffsetY;
    } else if (normalizedHeading > 270 && normalizedHeading <= 360) {
      finalOffsetX = -baseOffsetX - boxWidth;
      finalOffsetY = -baseOffsetY;
    }

    let frameX = x + finalOffsetX;
    let frameY = y + finalOffsetY;
    // ===== Если формуляр перетаскивался — добавляем дельту =====
    if (offsetX != null && offsetY != null) {
      const worldLabel = { x: displayX + offsetX, y: displayY + offsetY };
      const screenLabel = worldToScreen(worldLabel);
      frameX = screenLabel.x;
      frameY = screenLabel.y;
    }

    // ===== Фон =====
    this.labelArea = {
      x1: frameX,
      y1: frameY,
      x2: frameX + boxWidth,
      y2: frameY + boxHeight,
    };
    
    ctx.fillStyle = `rgba(100,100,100,${LABEL_BOX_ALPHA})`;
    ctx.fillRect(frameX, frameY, boxWidth, boxHeight);

   // ===== Вектор связка =====
    const labelMidX = frameX + boxWidth / 2;
    const labelMidY = frameY + boxHeight / 2;

    // Получаем точку на границе формуляра
    const clipped = this.clipLine(x, y, labelMidX, labelMidY, this.labelArea);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(clipped.x0, clipped.y0);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // ===== Текст =====
    ctx.fillStyle = selected ? COLORS.SELECTED_PLANE : COLORS.DEFAULT_PLANE;
    lines.forEach((line,i) => ctx.fillText(line, frameX + LABEL_PADDING_X, frameY + LABEL_PADDING_Y + i * LABEL_LINE_HEIGHT));
    ctx.restore();
  }

  isLabelHovered(mouse) { 
    const l = this.labelArea;
    return (
      mouse.x >= l.x1 && mouse.x <= l.x2 &&
      mouse.y >= l.y1 && mouse.y <= l.y2);
  }

  clipLine(x0, y0, x1, y1, rect) {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

    function outcode(x, y) {
      let code = INSIDE;
      if (x < rect.x1) code |= LEFT;
      else if (x > rect.x2) code |= RIGHT;
      if (y < rect.y1) code |= BOTTOM;
      else if (y > rect.y2) code |= TOP;
      return code;
    }

    let code0 = outcode(x0, y0);
    let code1 = outcode(x1, y1);

    while (true) {
      if (!(code0 | code1)) break; // обе точки внутри
      else if (code0 & code1) return {x0, y0, x1, y1}; // обе вне с одной стороны, ничего не рисуем
      else {
        let x, y;
        let out = code0 ? code0 : code1;

        if (out & TOP) {
          x = x0 + (x1 - x0) * (rect.y2 - y0) / (y1 - y0);
          y = rect.y2;
        } else if (out & BOTTOM) {
          x = x0 + (x1 - x0) * (rect.y1 - y0) / (y1 - y0);
          y = rect.y1;
        } else if (out & RIGHT) {
          y = y0 + (y1 - y0) * (rect.x2 - x0) / (x1 - x0);
          x = rect.x2;
        } else if (out & LEFT) {
          y = y0 + (y1 - y0) * (rect.x1 - x0) / (x1 - x0);
          x = rect.x1;
        }

        if (out === code0) {
          x0 = x; y0 = y;
          code0 = outcode(x0, y0);
        } else {
          x1 = x; y1 = y;
          code1 = outcode(x1, y1);
        }
      }
    }

    return {x0, y0, x1, y1};
  }
}