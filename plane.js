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
  METERS_PER_PIXEL,
  RUNWAY_LENGTH,
} from "./constants.js";
import { sayReachedAltitude, sayReachedSpeed, sayReachedHeading } from "./pilotReplyAudioApi.js";
import { getFinalLegArea, getRunway, getCenterLine } from "./radarStatics.js";
import { PlaneRenderer } from "./planeRenderer.js";
import { calcMaxAngularSpeed, calcTurningRadius, turnDirection, shortestAngleDiff, planeInArea, distanceToLineAxis, timeToCrossLine, } from "./planePhysics.js";
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
    this.forcedTurnSide = null;
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

    this.landingQueue = [];
    this.sideFromCenterLine = null;
    this.backTurnCompleted = false;
    this.alignStarted === false;

    this.renderer = new PlaneRenderer(this); // подключаем новый рендерер
  }

  // ======= GETTERS =======
  get finalLegArea() { return getFinalLegArea(); }
  get runway() { return getRunway(); }
  get centerLine() { return getCenterLine(); }

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
    if (this.landing) {
      this.updateLanding(delta);
    } else {
      this.checkLanding();
    }
    this.updatePosition(delta);
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
    this.turnSide = this.forcedTurnSide !== null ? this.forcedTurnSide : turnDirection(target, heading);

    if (Math.abs(angleDiff) <= turnRateDpf) {
      this.heading = this.targetHeading;
      this.turnSide = 0;
      this.forcedTurnSide = null;
      sayReachedHeading(this);
      return;
    }

    this.heading = normalizeAngle(heading + this.turnSide * turnRateDpf);
  }

  // Check if plane enters landing zone
  checkLanding() {
    const a = this.finalLegArea;
    const r = this.runway;
    const isCorrectAlt = this.altitude <= 6000;
    const isOnFinal = planeInArea(this.x, this.y, this.finalLegArea);


    const offset = this.getCenterLineOffset();
    const side = Math.sign(offset);
    const isLineCrossed = (side !== this.sideFromCenterLine);

    const isHeadingToRw = Math.abs(this.heading - r.heading) <= 90;
    if (!this.landing && isOnFinal && isLineCrossed && isHeadingToRw) {
      this.landing = true;
      this.makeBackTurn();
    }

    this.sideFromCenterLine = side;


    const [start, end] = this.centerLine;
    const timeToCross = timeToCrossLine(this, start, end)
    const adjustH = shortestAngleDiff(r.heading, this.heading)
    const turnRate = calcMaxAngularSpeed(this.groundSpeed, this.bankAngle);
    const timeToTurn = adjustH / turnRate
    this.showLogs( this.targetHeading, offset, timeToCross, timeToTurn)

  }

  updateLanding(delta) {
    const r = this.runway;

    this.speed = kphToPxPerSec(300);
    this.groundSpeed = Math.floor(300);
    this.targetSpeed = Math.floor(300);

    const offset = this.getCenterLineOffset();
    const [start, end] = this.centerLine;
    const timeToCross = Math.abs(timeToCrossLine(this, start, end))

    const adjustH = shortestAngleDiff(r.heading, this.heading)
    const turnRate = calcMaxAngularSpeed(this.groundSpeed, this.bankAngle);
    const timeToTurn = Math.abs(adjustH / turnRate)

    const turnRadius = calcTurningRadius(this.groundSpeed, this.bankAngle) 

    if (Math.abs(adjustH) <= (turnRate * delta)) {
      this.backTurnCompleted = true;
    }

    if(Math.abs(offset) <= turnRadius && this.backTurnCompleted) {
      this.forcedTurnSide = null;
      this.targetHeading= r.heading;
      // this.alignStarted = true; 
      console.log('align')
    }

    // if(Math.abs(timeToCross - timeToTurn) < 0.1 && this.backTurnCompleted) {
    //   this.forcedTurnSide = null;
    //   this.targetHeading= r.heading;
    //   this.alignStarted = true; 
    //   console.log('align')
    // }

    if (this.alignStarted) { 
      const kLat = 0.3;
      const kHead = 0.7;
      const minBank = 0;
      const maxBank = 35;

      const lateralError = offset;
      const headingError = adjustH;

      let targetBank = lateralError * kLat + headingError * kHead;

      targetBank = Math.sign(targetBank) * Math.min(Math.abs(targetBank), maxBank);
      targetBank = Math.sign(targetBank) * Math.max(Math.abs(targetBank), minBank); 

      const rateLimit = 4;
      const maxStepThisFrame = rateLimit * delta;
      const bankDiff = targetBank - this.bankAngle;
      this.bankAngle += Math.sign(bankDiff) * Math.min(Math.abs(bankDiff), maxStepThisFrame);

      if (Math.abs(adjustH) <= (turnRate * delta)) {
        this.alignStarted = false;
        console.log('on final')
      }
    }

    this.showLogs(this.targetHeading, offset, timeToCross, timeToTurn, this.backTurnCompleted, this.bankAngle, turnRadius);
  }

  makeBackTurn() {
    const r = this.runway;
    const targetX = r.points[0].x;
    const targetY = r.center.y;

    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    this.speed = kphToPxPerSec(300);

    const adjHeading = 90;
    const factor = 1;
    const rvrsHeading = adjHeading * factor;

    this.bankAngle = 30;

    this.forcedTurnSide = turnDirection(r.heading, this.heading); // default 1, если 0

    this.targetHeading = normalizeAngle(this.heading + rvrsHeading);

    console.log('back turn started')
  }


  // updateLanding(delta) {
  //   const r = this.runway;
  //   const targetX = r.center.x;
  //   const targetY = r.center.y;
  //   const dx = targetX - this.x;
  //   const dy = targetY - this.y;
  //   const dist = Math.sqrt(dx*dx + dy*dy);

  //   this.heading = (radToDeg(Math.atan2(dy, dx)) + 90 + 360) % 360;

  //   if (dist > this.speed * delta) {
  //     this.x += (dx / dist) * this.speed * delta;
  //     this.y += (dy / dist) * this.speed * delta;
  //   } else {
  //     this.x = targetX;
  //     this.y = targetY;
  //     this.landed = true;
  //   }
  // }


  getRadarResponse() {
    this.displayX = this.x;
    this.displayY = this.y;
    this.displayHeading = this.heading;
  }

  getCenterLineOffset() {
    const [start, end] = this.centerLine;
    return distanceToLineAxis(
      this.x, 
      this.y,
      start.x, start.y,
      end.x, end.y
    );
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

  showLogs(targetHeading, offset, timeToCross, timeToTurn, isNoseToLine, bankAngle, turnRadius){
    // then remove!
    if(this.selected) {
      const offset = this.getCenterLineOffset();
      const side = Math.sign(offset);
      console.table({
        targetHeading: (`${targetHeading} deg`),
        offset: (`${(offset * METERS_PER_PIXEL).toFixed(2)} m`),
        timeToCross: (`${(timeToCross).toFixed(3)} sec`),
        timeToTurn: (`${(timeToTurn).toFixed(3)} sec`),
        isNoseToLine: isNoseToLine,
        bankAngle: bankAngle,
        turnRadius: turnRadius,
      });
    }
  }

  // ======= VISUALIZATION METHODS =======
  drawPlane() { this.renderer.drawPlane(); }
  drawLabel() { this.renderer.drawLabel(); }
  drawAll() { this.renderer.drawPlane(); this.renderer.drawLabel(); }
}
