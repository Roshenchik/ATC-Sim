// Plane.js
import { degToRad, radToDeg, normalizeAngle, kphToPxPerSec } from "./utils.js";
import { 
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
} from "./constants.js";
import { sayReachedAltitude, sayReachedSpeed, sayReachedHeading } from "./pilotReplyAudioApi.js";
import { airlinePrefixes } from "./callsignAliases.js";
import { getFinalLegArea, getRunway } from "./radarStatics.js";
import { PlaneRenderer } from "./planeRenderer.js";
import { calcMaxAngularSpeed, calcTurningRadius, turnDirection, shortestAngleDiff } from "./planePhysics.js";
import { Callsign } from "./planeCallsign.js";

export class Plane {
  constructor(x, y, heading, ctx) {
    this.ctx = ctx;
    
    // position in pixels
    this.x = x;
    this.y = y;
    this.displayX = x;
    this.displayY = y;

    // heading in degrees
    this.heading = normalizeAngle(heading);
    this.targetHeading = this.heading;
    this.displayHeading = this.heading;
  
    // turning
    this.bankAngle = 25; // degrees
    this.turnSide = 0; // 1 = clockwise, -1 = counterclockwise

    // speed 
    const speedKph = MIN_SPEED_KPH + Math.random() * (MAX_SPEED_KPH - MIN_SPEED_KPH);
    this.speed = kphToPxPerSec(speedKph);
    this.accelerationKphPerSec = ACCELERATION_KPH_PER_SEC;
    this.decelerationKphPerSec = DECELERATION_KPH_PER_SEC;
    this.groundSpeed = Math.floor(speedKph);
    this.targetSpeed = Math.floor(speedKph);

    // Altitude and flight level
    this.flightLevel = FLIGHTLEVELS[Math.floor(Math.random() * FLIGHTLEVELS.length)];
    this.altitude = this.flightLevel * 100; //feet
    this.targetAltitude = this.altitude;
    this.maxClimbRate = MAX_CLIMB_RATE_FPM;
    this.maxDescentRate = MAX_DESCENT_RATE_FPM;

    // callsign
    const callsign = new Callsign();
    this.callsignPrefix = callsign.prefix;
    this.callsignNum = callsign.number;
    this.callsign = callsign.full;
    this.airline = callsign.airline;

    // state flags
    this.selected = false;
    this.stca = false;
    this.landing = false;
    this.landed = false;

    this.renderer = new PlaneRenderer(this); // подключаем новый рендерер
  }

  // ======= GETTERS =======
  get finalLegArea() { return getFinalLegArea(); }
  get runway() { return getRunway(); }

  // ======= STATIC METHODS =======
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

  // ======= LOGIC METHODS =======
 update(delta = 1/60) {
    if (this.landed) return;
    if (this.targetHeading !== this.heading) this.updateHeading(delta);
    if (this.targetAltitude !== this.altitude) this.updateAltitude(delta);
    if (this.targetSpeed !== this.groundSpeed) this.updateSpeed(delta);
    if (this.landing) this.updateLanding(delta);
    else {
      this.updatePosition(delta);
      this.checkLanding();
    }
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

  updateHeading(delta) {
    const heading = normalizeAngle(this.heading);
    const target = normalizeAngle(this.targetHeading);

    const angleDiff = shortestAngleDiff(target, heading);
    const turnRate = calcMaxAngularSpeed(this.groundSpeed, this.bankAngle);
    const turnRateDpf = turnRate * delta;
    this.turnSide = turnDirection(target, heading);

    if (Math.abs(angleDiff) <= turnRateDpf) {
      this.heading = this.targetHeading;
      this.turnSide = 0;
      sayReachedHeading(this);
      return;
    }

    this.heading = normalizeAngle(heading + this.turnSide * turnRateDpf);
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

  // ======= VISUALIZATION METHODS =======
  drawPlane() { this.renderer.drawPlane(); }
  drawLabel() { this.renderer.drawLabel(); }
  drawAll() { this.renderer.drawPlane(); this.renderer.drawLabel(); }
}
