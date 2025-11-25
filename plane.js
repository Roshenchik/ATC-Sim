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
    const { displayX: x, displayY: y, displayHeading: heading, selected, stca } = this;
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
    ctx.lineWidth = VECTOR_WIDTH;
    ctx.stroke();
  }

  drawLabel() {
    const { displayX: x, displayY: y, displayHeading: heading, selected, callsign, groundSpeed, flightLevel } = this;
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
