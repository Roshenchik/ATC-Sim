// ruler.js
import { METERS_PER_PIXEL } from "./constants.js";
// =====================
// ====== DRAWING RULER ======
export class Ruler {
  constructor(startX, startY, endX, endY) {
    this.x1 = startX;
    this.y1 = startY;
    this.x2 = endX;
    this.y2 = endY;
  }

  // геттеры
  get midX() { return (this.x1 + this.x2) / 2; }
  get midY() { return (this.y1 + this.y2) / 2; }

  get dist() {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const pixDist = Math.sqrt(dx*dx + dy*dy);
    return (pixDist * METERS_PER_PIXEL) / 1000;
  }

  get angle() {
    const dx = this.x2 - this.x1;
    const dy = this.y2 - this.y1;
    const angleRad = Math.atan2(dx, -dy);
    return (angleRad * 180 / Math.PI + 360) % 360;
  }

  // проверка попадания ПКМ
  isNear(px, py, threshold = 5) {
    const A = px - this.x1;
    const B = py - this.y1;
    const C = this.x2 - this.x1;
    const D = this.y2 - this.y1;

    const dot = A*C + B*D;
    const lenSq = C*C + D*D;
    let param = lenSq !== 0 ? dot / lenSq : -1;

    let xx, yy;
    if (param < 0) { xx = this.x1; yy = this.y1; }
    else if (param > 1) { xx = this.x2; yy = this.y2; }
    else { xx = this.x1 + param*C; yy = this.y1 + param*D; }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx*dx + dy*dy) <= threshold;
  }

  // рисование
  draw(ctx, color="rgba(0,255,255,0.9)") {
    ctx.save();

    // линия
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(this.x1, this.y1);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();

    // подпись
    const label = `${this.dist.toFixed(2)} km | ${this.angle.toFixed(0)}°`;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(this.midX - 60, this.midY - 12, 120, 20);

    ctx.fillStyle = color;
    ctx.font = "13px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, this.midX, this.midY);

    ctx.restore();
  }
}