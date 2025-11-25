// PlaneView.js
import { PLANE_SIZE, VECTOR_LENGTH } from "./constants.js";
import { degToRad } from "./utils.js";

const COLORS = {
  STCA_PLANE: 'rgba(255,0,0,1)',
  DEFAULT_PLANE: 'rgba(255,255,255,1)',
  SELECTED_PLANE: 'rgba(145,255,0,1)',
};
const OUTLINE_COLORS = Object.fromEntries(
  Object.entries(COLORS).map(([k,v]) => [k, v.replace(/[\d\.]+\)$/, '0.2)')]) //glov effect
);


export class PlaneView {
  constructor(planeLogic, ctx) {
    this.plane = planeLogic;
    this.ctx = ctx;
  }

  drawPlane() {
    const { displayX: x, displayY: y, displayHeading: heading, selected, stca, callsign, groundSpeed, flightLevel } = this.plane;
    const ctx = this.ctx;

    const fillColor = stca ? COLORS.STCA_PLANE : (selected ? COLORS.SELECTED_PLANE : COLORS.DEFAULT_PLANE);

    // diamond shape
    ctx.beginPath();
    ctx.moveTo(x, y - PLANE_SIZE);
    ctx.lineTo(x + PLANE_SIZE, y);
    ctx.lineTo(x, y + PLANE_SIZE);
    ctx.lineTo(x - PLANE_SIZE, y);
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = stca ? OUTLINE_COLORS.STCA_PLANE : (selected ? OUTLINE_COLORS.SELECTED_PLANE : OUTLINE_COLORS.DEFAULT_PLANE);
    ctx.stroke();

    // heading vector (line)
    const rad = degToRad(heading - 90);
    const x2 = x + Math.cos(rad) * VECTOR_LENGTH;
    const y2 = y + Math.sin(rad) * VECTOR_LENGTH;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = stca ? OUTLINE_COLORS.STCA_PLANE : (selected ? OUTLINE_COLORS.SELECTED_PLANE : OUTLINE_COLORS.DEFAULT_PLANE);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawLabel() {
    const { displayX: x, displayY: y, displayHeading: heading, selected, callsign, groundSpeed, flightLevel } = this.plane;
    const ctx = this.ctx;

    const rad = degToRad(heading - 90);
    const offset = 15;
    let offsetX = -Math.sin(rad) * offset;
    let offsetY = Math.cos(rad) * offset;
    let textX = x + offsetX;
    let textY = y + offsetY;

    ctx.save();
    ctx.font = '10px monospace';
    ctx.textBaseline = 'top';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 3;

    const lines = [
      `${callsign}`,
      `HDG ${heading.toFixed(0).padStart(3,'0')}`,
      `SPD ${groundSpeed.toFixed(0)}`,
      `FL ${flightLevel}`
    ];

    let maxWidth = 0;
    for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
    const boxWidth = maxWidth + 8;
    const boxHeight = lines.length * 12 + 4;

    if (heading > 180 && heading <= 270) {
      textX = x - offsetX;
      textY = y - offsetY;
    }
    let boxClosestCorner = textX - 4;
    if (heading > 90 && heading <= 180) {
      textX = x - boxWidth + offsetX;
      boxClosestCorner = (textX - 4) + boxWidth;
    }

    ctx.fillStyle = 'rgba(100,100,100,0.5)';
    ctx.fillRect(textX - 4, textY - 2, boxWidth, boxHeight);

    ctx.beginPath();
    ctx.moveTo(boxClosestCorner, textY - 2);
    ctx.lineTo(x, y);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    ctx.fillStyle = selected ? COLORS.SELECTED_PLANE : COLORS.DEFAULT_PLANE;
    lines.forEach((line,i) => ctx.fillText(line, textX, textY + i * 12));
    ctx.restore();
  }

  drawAll() {
    this.drawPlane();
    this.drawLabel();
  }
}


