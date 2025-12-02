// Plane.js
import { degToRad, radToDeg, normalizeAngle, kphToPxPerSec } from "./utils.js";
import { 
  PLANE_SIZE,
  AIRLINES,
  FLIGHTLEVELS, 
  MIN_SPEED_KPH, 
  MAX_SPEED_KPH, 
  ACCELERATION_KPH_PER_SEC, 
  DECELERATION_KPH_PER_SEC, 
  MAX_CLIMB_RATE_FPM, 
  MAX_DESCENT_RATE_FPM, 
  STCA_RADIUS, 
  STCA_VERT_DIST_F,
  OFFSCREEN_MARGIN,
  VECTOR_WIDTH,
  VECTOR_LENGTH,
} from "./constants.js";
import { sayReachedAltitude, sayReachedSpeed, sayReachedHeading } from "./pilotReplyAudioApi.js";
import { airlinePrefixes } from "./callsignAliases.js";
import { getFinalLegArea, getRunway } from "./radarStatics.js";
import { screenToWorld, worldToScreen } from "./zoom.js";

const COLORS = {
  STCA_PLANE: 'rgba(255,0,0,1)',
  DEFAULT_PLANE: 'rgba(255,255,255,1)',
  SELECTED_PLANE: 'rgba(145,255,0,1)',
};
const OUTLINE_COLORS = Object.fromEntries(
  Object.entries(COLORS).map(([k,v]) => [k, v.replace(/[\d\.]+\)$/, '0.2)')])
);

export class Plane {
  constructor(x, y, heading, ctx) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;

    this.heading = normalizeAngle(heading);
    this.targetHeading = this.heading;
    this.displayHeading = this.heading;

    this.displayX = x;
    this.displayY = y;

    const speedKph = MIN_SPEED_KPH + Math.random() * (MAX_SPEED_KPH - MIN_SPEED_KPH);
    this.speed = kphToPxPerSec(speedKph);
    this.accelerationKphPerSec = ACCELERATION_KPH_PER_SEC;
    this.decelerationKphPerSec = DECELERATION_KPH_PER_SEC;

    this.selected = false;
    this.stca = false;
    this.landing = false;
    this.landed = false;
    this.bankAngle = 25; // degrees
    this.turnSide = 0; // 1 = clockwise, -1 = counterclockwise

    // Flight strip
    const callsignData = this.generateCallsign();
    this.callsignPrefix = callsignData.prefix;
    this.callsignNum = callsignData.number;
    this.callsign = callsignData.prefix + callsignData.number;
    this.airline = airlinePrefixes[callsignData.prefix] || callsignData.prefix; //finding alias if exists
    this.flightLevel = FLIGHTLEVELS[Math.floor(Math.random() * FLIGHTLEVELS.length)];
    this.altitude = this.flightLevel * 100; //feet

    this.groundSpeed = Math.floor(speedKph);
    this.targetSpeed = Math.floor(speedKph);
    this.targetAltitude = this.altitude;
    this.maxClimbRate = MAX_CLIMB_RATE_FPM;
    this.maxDescentRate = MAX_DESCENT_RATE_FPM;

    //for label dragging
    this.labelOffsetWX = null;
    this.labelOffsetWY = null;
    this.labelArea = {x1: 0, y1: 0, x2: 0, y2: 0};
  }

  // ======= GETTERS =======
  get finalLegArea() { return getFinalLegArea(); }
  get runway() { return getRunway(); }

  // ======= LOGIC METHODS =======
  generateCallsign() {
    const callsign = { prefix: null, number: null};
    callsign.prefix = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
    callsign.number = Math.floor(100 + Math.random() * 900).toString();
    return callsign;
  }

  updatePosition(delta) {
    const rad = degToRad(this.heading - 90);
    this.x += this.speed * Math.cos(rad) * delta;
    this.y += this.speed * Math.sin(rad) * delta;
  }

  updateAltitude(delta) {
    const vertSpeedFpm = this.targetAltitude > this.altitude ? this.maxClimbRate : this.maxDescentRate;
    const vertSpeedFpf = (vertSpeedFpm / 60) * delta;
    const direction = Math.sign(this.targetAltitude - this.altitude);

    if (Math.abs(this.targetAltitude - this.altitude) <= vertSpeedFpf) {
      this.altitude = this.targetAltitude;
      this.flightLevel = Math.round(this.altitude / 100);
      sayReachedAltitude(this);
      return;
    }

    this.altitude += direction * vertSpeedFpf;
    this.flightLevel = Math.round(this.altitude / 100);
  }

  updateSpeed(delta) {
    const deltaSpeed = this.targetSpeed - this.groundSpeed;
    const maxDelta = this.accelerationKphPerSec * delta;

    if (Math.abs(deltaSpeed) <= maxDelta) {
      this.groundSpeed = this.targetSpeed;
      sayReachedSpeed(this);
    } else {
      this.groundSpeed += Math.sign(deltaSpeed) * maxDelta;
    }
    this.speed = kphToPxPerSec(this.groundSpeed);
  }

  turn(delta) {
    const heading = normalizeAngle(this.heading);
    const target = normalizeAngle(this.targetHeading);

    const angleDiff = this.shortestAngleDiff(target, heading);
    const turnRate = this.calcMaxAngularSpeed();
    const turnRateDpf = turnRate * delta;
    this.turnSide = this.turnDirection(target, heading);

    if (Math.abs(angleDiff) <= turnRateDpf) {
      this.heading = this.targetHeading;
      this.turnSide = 0;
      sayReachedHeading(this);
      return;
    }

    this.heading = normalizeAngle(heading + this.turnSide * turnRateDpf);
  }

  calcTurningRadius() {
    const g = 9.81;
    const V = this.groundSpeed / 3.6;
    const phi = this.bankAngle * Math.PI / 180;
    return V * V / (g * Math.tan(phi));
  }

  calcMaxAngularSpeed() {
    const R = this.calcTurningRadius(); // м
    const V = this.groundSpeed / 3.6; // м/с
    const maxAngularSpeed = radToDeg(V / R); // град/сек
    return maxAngularSpeed;
  }

  turnDirection(target, current) {
    return Math.sign(this.shortestAngleDiff(target, current));
  }

  shortestAngleDiff(target, current) {
    return normalizeAngle(target - current + 180) - 180;
  }

  // Check if plane enters landing zone
  checkLanding() {
    const a = this.finalLegArea;
    if (!this.landing &&
        this.x >= a.x1 && this.x <= a.x2 &&
        this.y >= a.y1 && this.y <= a.y2) {
      this.landing = true;
    }
  }

  updateLanding(delta) {
    const r = this.runway;
    const targetX = r.x + r.width / 2;
    const targetY = r.y + r.height / 2;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    this.heading = (radToDeg(Math.atan2(dy, dx)) + 90 + 360) % 360;

    if (dist > this.speed * delta) {
      this.x += (dx / dist) * this.speed * delta;
      this.y += (dy / dist) * this.speed * delta;
    } else {
      this.x = targetX;
      this.y = targetY;
      this.landed = true;
    }
  }

  update(delta = 1/60) {
    if (this.landed) return;
    if (this.targetHeading !== this.heading) this.turn(delta);
    if (this.targetAltitude !== this.altitude) this.updateAltitude(delta);
    if (this.targetSpeed !== this.groundSpeed) this.updateSpeed(delta);
    if (this.landing) this.updateLanding(delta);
    else {
      this.updatePosition(delta);
      this.checkLanding();
    }
  }

  static checkSTCA(planes) {
    planes.forEach(p => p.stca = false);
    for (let i = 0; i < planes.length; i++) {
      for (let j = i + 1; j < planes.length; j++) {
        const a = planes[i];
        const b = planes[j];
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        if (distance < STCA_RADIUS && Math.abs(a.altitude - b.altitude) < STCA_VERT_DIST_F) {
          a.stca = true;
          b.stca = true;
        }
      }
    }
  }

  getRadarResponse() {
    this.displayX = this.x;
    this.displayY = this.y;
    this.displayHeading = this.heading;
  }

  checkRunway() {
    const r = this.runway;
    return this.x > r.x && this.x < r.x + r.width && this.y > r.y && this.y < r.y + r.height;
  }

  isOutOfRadar(grid) {
    const dx = this.x - grid.centerX;
    const dy = this.y - grid.centerY;
    const exitMargin = OFFSCREEN_MARGIN + 20;
    return Math.sqrt(dx*dx + dy*dy) > grid.maxRadius + exitMargin;
  }

  // ======= VISUAL METHODS =======
  drawPlane() {
    const { displayX, displayY, displayHeading: heading, selected, stca } = this;
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
    const LABEL_OFFSET = 15; // расстояние от самолета к началу формуляра

    const { displayX, displayY, labelOffsetWX, labelOffsetWY, displayHeading: heading, selected, callsign, groundSpeed, flightLevel } = this;
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


    let textX = x + finalOffsetX;
    let textY = y + finalOffsetY;
    // ===== Если формуляр перетаскивался — добавляем дельту =====
    if (labelOffsetWX != null && labelOffsetWY != null) {
      const worldLabel = { x: displayX + labelOffsetWX, y: displayY + labelOffsetWY };
      const screenLabel = worldToScreen(worldLabel);
      textX = screenLabel.x;
      textY = screenLabel.y;
    }

    // ===== Фон =====
    this.labelArea = {
      x1: textX - LABEL_PADDING_X,
      y1: textY - LABEL_PADDING_Y,
      x2: textX - LABEL_PADDING_X + boxWidth,
      y2: textY - LABEL_PADDING_Y + boxHeight,
    };
    
    ctx.fillStyle = `rgba(100,100,100,${LABEL_BOX_ALPHA})`;
    ctx.fillRect(this.labelArea.x1, this.labelArea.y1, boxWidth, boxHeight);

   // ===== Вектор связка =====
    const labelMidX = textX - LABEL_PADDING_X + boxWidth / 2;
    const labelMidY = textY - LABEL_PADDING_Y + boxHeight / 2;

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
    lines.forEach((line,i) => ctx.fillText(line, textX, textY + i * LABEL_LINE_HEIGHT));
    ctx.restore();
  }

  drawAll() {
    this.drawPlane();
    this.drawLabel();
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
