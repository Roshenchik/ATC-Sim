// PlaneLogic.js
import { degToRad, radToDeg, normalizeAngle, kphToPxPerSec } from "../utils.js";
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
} from "../constants.js";
import { sayReachedAltitude, sayReachedSpeed, sayReachedHeading } from "../pilotReplyAudioApi.js";
import { airlinePrefixes } from "../callsignAliases.js";
import { getFinalLegArea, getRunway } from "../radarStatics.js";

export class PlaneLogic {
  constructor(x, y, heading) {
    this.x = x;
    this.y = y;

    this.heading = normalizeAngle(heading);
    this.targetHeading = this.heading;
    this.displayHeading = this.heading;

    this.displayX = x;
    this.displayY = y;

    // determine speed randomly within range
    const speedKph = MIN_SPEED_KPH + Math.random() * (MAX_SPEED_KPH - MIN_SPEED_KPH);
    this.speed = kphToPxPerSec(speedKph);
    this.accelerationKphPerSec = ACCELERATION_KPH_PER_SEC;
    this.decelerationKphPerSec = DECELERATION_KPH_PER_SEC;

    this.selected = false;
    this.stca = false;
    this.landing = false;
    this.landed = false;
    this.bankAngle = 25; // degrees
    this.turnSide = 0 // 1 = clockwise, -1 = counterclockwise

    // Flight strip field
    const callsignData = this.generateCallsign();
    this.callsignPrefix = callsignData.prefix;
    this.callsignNum = callsignData.number;
    this.callsign = callsignData.prefix + callsignData.number;
    this.airline = airlinePrefixes[callsignData.prefix] || callsignData.prefix;; // заменяем на алиас, если есть
    this.flightLevel = FLIGHTLEVELS[Math.floor(Math.random() * FLIGHTLEVELS.length)];
    this.altitude = this.flightLevel * 100; // feet

    this.groundSpeed = Math.floor(speedKph);
    this.targetSpeed = Math.floor(speedKph);

    this.targetAltitude = this.altitude; // цель по высоте (в футах)
    this.maxClimbRate = MAX_CLIMB_RATE_FPM; // футов в минуту, реалистично для пассажирских лайнеров
    this.maxDescentRate = MAX_DESCENT_RATE_FPM; // футов в минуту
  }

  get finalLegArea() { return getFinalLegArea(); }
  get runway() { return getRunway(); }

  // ======== LOGIC METHODS ========

  generateCallsign() {
    const callsign = { prefix: null, number: null}
    callsign.prefix = AIRLINES[Math.floor(Math.random() * AIRLINES.length)];
    callsign.number = Math.floor(100 + Math.random() * 900).toString();
    return callsign;
  }

  // Update position for straight flight
  updatePosition(delta) {
    const rad = degToRad(this.heading - 90);
    this.x += this.speed * Math.cos(rad) * delta;
    this.y += this.speed * Math.sin(rad) * delta;
  }

  updateAltitude(delta) {
    const vertSpeedFpm = this.targetAltitude > this.altitude ? this.maxClimbRate : this.maxDescentRate;
    const vertSpeedFps = vertSpeedFpm / 60
    const vertSpeedFpf = vertSpeedFps * delta;
    const direction = Math.sign(this.targetAltitude - this.altitude)

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
    const deltaSpeed = this.targetSpeed - this.groundSpeed; // разница в скорости
    const maxDelta = this.accelerationKphPerSec * delta; // максимально возможное изменение за этот кадр

    if (Math.abs(deltaSpeed) <= maxDelta) {
      this.groundSpeed = this.targetSpeed; // достигли цели
      sayReachedSpeed(this)
    } else {
      this.groundSpeed += Math.sign(deltaSpeed) * maxDelta; // увеличиваем или уменьшаем
    }
    // пересчитываем пиксели/сек
    this.speed = kphToPxPerSec(this.groundSpeed);
    //console.log(`Plane ${this.callsign} speed updated to ${this.groundSpeed} km/h`);
  }

  turn(delta) {
    const heading = normalizeAngle(this.heading);
    const target = normalizeAngle(this.targetHeading);

    const angleDifference = this.shortestAngleDiff(target, heading);
    const turnRate = this.calcMaxAngularSpeed(); // degrees per second
    const turnRateDpf = turnRate * delta; // degrees per frame
    this.turnSide = this.turnDirection(target, heading)

    // If the angle is so small that we don't have time to "finish" it, we just set it
    if (Math.abs(angleDifference) <= turnRateDpf) {
        this.heading = this.targetHeading;
        this.turnSide = 0;
        sayReachedHeading(this)
        return;
    }
    // Выполняем поворот
    this.heading = normalizeAngle(
        heading + this.turnSide * turnRateDpf
    );
    //console.log(`this.targetHeading: ${this.targetHeading}, this.heading: ${this.heading}, angleDifference: ${angleDifference}, direction: ${this.turnSide}, turnRate: ${turnRate}`);
  }

  calcTurningRadius() {
    const g = 9.81; // ускорение свободного падения
    const V = this.groundSpeed / 3.6; // км/ч → м/с
    const phi = this.bankAngle * Math.PI / 180; // градусы → радианы
    return V * V / (g * Math.tan(phi)); // радиус в метрах
  }

  calcMaxAngularSpeed() {
    const R = this.calcTurningRadius(); // м
    const V = this.groundSpeed / 3.6; // м/с
    const maxAngularSpeed = radToDeg(V / R); // град/сек
    return maxAngularSpeed;
  }

  turnDirection(target, current) {
    const diff = this.shortestAngleDiff(target, current);
    return Math.sign(diff);
  }

  shortestAngleDiff(target, current) {
    return normalizeAngle(target - current + 180) - 180;
  }

  // Check if plane enters landing zone
  checkLanding() {
    if (!this.landing &&
        this.x >= this.finalLegArea.x1 && this.x <= this.finalLegArea.x2 &&
        this.y >= this.finalLegArea.y1 && this.y <= this.finalLegArea.y2) {
      this.landing = true;
    }
  }

  // Update plane position during landing
  updateLanding(delta) {
    const targetX = this.runway.x + this.runway.width / 2;
    const targetY = this.runway.y + this.runway.height / 2;
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

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

  // Main update method: decides which logic to run
  update(delta = 1 / 60) {
    if (this.landed) return;

    if (this.targetHeading !== this.heading) {
      this.turn(delta);
    }

    if (this.targetAltitude !== this.altitude) {
      this.updateAltitude(delta);
    }

    if (this.targetSpeed !== this.groundSpeed) {
      this.updateSpeed(delta);
    }

    if (this.landing) {
      this.updateLanding(delta);
    } else {
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
    return this.x > this.runway.x &&
           this.x < this.runway.x + this.runway.width &&
           this.y > this.runway.y &&
           this.y < this.runway.y + this.runway.height;
  }

  isOutOfRadar(azimuthalGrid) {
    const dx = this.x - azimuthalGrid.centerX;
    const dy = this.y - azimuthalGrid.centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const exitMargin = OFFSCREEN_MARGIN + 20;
    return dist > azimuthalGrid.maxRadius + exitMargin;
  }
  
}
