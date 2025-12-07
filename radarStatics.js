import { RUNWAY_WIDTH, RUNWAY_LENGTH, SIDEBAR_WIDTH, FINAL_LENGTH, FINAL_BUFFER, RADAR_RADIUS } from "./constants.js";
import { degToRad } from "./utils.js";
import { camera, worldToScreen } from "./zoom.js";

// ========================
// INTERNAL STATE
// ========================
let runway = null;          // { points: [p1,p2,p3,p4], center:{x,y}, heading }
let finalLegArea = null;    // [p1,p2,p3,p4]
let centerLine = null;      // [{x,y},{x,y}]
let azimuthalGrid = null;   // {centerX,centerY,maxRadius}

// ======================================================
// INIT ENTRY POINT
// ======================================================
export function initStatics(headingDeg = 130) {
    runway = initRunway(headingDeg);
    finalLegArea = initFinalLegArea(runway);
    azimuthalGrid = initAzimuthalGrid(runway);
}

// ======================================================
// BUILD RUNWAY AS ROTATED RECTANGLE (4 POINTS)
// ======================================================
export function initRunway(headingDeg = 130) {

    // 1. Compute center in world coords (no rotation)
    const radarFieldWidth = window.innerWidth - SIDEBAR_WIDTH;
    const radarFieldHeight = window.innerHeight;

    const cx = radarFieldWidth / 2;
    const cy = radarFieldHeight / 2;

    // 2. Local coordinates around center BEFORE rotation
    const L = RUNWAY_LENGTH; 
    const W = RUNWAY_WIDTH;
    
    const halfL = L / 2;
    const halfW = W / 2;

    const local = [
        { x: -halfL, y: -halfW },  // p1
        { x: +halfL, y: -halfW },  // p2
        { x: +halfL, y: +halfW },  // p3
        { x: -halfL, y: +halfW },  // p4
    ];

    // 3. Rotate local points around center
    const angle = degToRad(headingDeg - 90);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const points = local.map(p => ({
        x: cx + p.x * cos - p.y * sin,
        y: cy + p.x * sin + p.y * cos
    }));

    return {
        points,
        center: { x: cx, y: cy },
        heading: headingDeg
    };
}

// ======================================================
// FINAL LEG AREA (ALSO A 4-POINT POLYGON)
// ======================================================
export function initFinalLegArea(rw) {
    const { center, heading } = rw;

    const L = FINAL_LENGTH;
    const B = FINAL_BUFFER;
    const W = RUNWAY_WIDTH;
    const RL = RUNWAY_LENGTH;

    // Local rectangle (before rotation)
    const local = [
        { x: -L, y: -W/2 - B },   // p1
        { x:  -RL/2, y: -W/2 - B },   // p2
        { x:  -RL/2, y:  W/2 + B },   // p3
        { x: -L, y:  W/2 + B },   // p4
    ];

    // Center line (local)
    const clLocal = [
        { x: -L, y: 0 },
        { x: -RL/2, y: 0 }
    ];

    // Rotate around runway center
    const angle = degToRad(heading - 90);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const area = local.map(p => ({
        x: center.x + p.x * cos - p.y * sin,
        y: center.y + p.x * sin + p.y * cos
    }));

    const cl = clLocal.map(p => ({
        x: center.x + p.x * cos - p.y * sin,
        y: center.y + p.x * sin + p.y * cos
    }));

    centerLine = cl;

    return area;
}

// ======================================================
// GRID
// ======================================================
export function initAzimuthalGrid(rw) {
    azimuthalGrid = {
        centerX: rw.center.x,
        centerY: rw.center.y,
        maxRadius: RADAR_RADIUS
    };
    return azimuthalGrid;
}

// ======================================================
// GETTERS
// ======================================================
export const getRunway = () => runway;
export const getFinalLegArea = () => finalLegArea;
export const getCenterLine = () => centerLine;
export const getAzimuthalGrid = () => azimuthalGrid;

// ======================================================
// DRAW FUNCTIONS
// ======================================================
export function drawStatics(ctx) {
    drawRunway(ctx, runway);
    drawFinalLegLine(ctx, finalLegArea, centerLine);
    drawAzimuthalGrid(ctx, azimuthalGrid);
}

// ----------------------
// RUNWAY
// ----------------------
export function drawRunway(ctx, rw) {
    const pts = rw.points.map(worldToScreen);

    ctx.save();
    ctx.fillStyle = "gray";
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}

// ----------------------
// FINAL LEG + CENTERLINE
// ----------------------
export function drawFinalLegLine(ctx, fa, cl) {
    const scaledFa = fa.map(worldToScreen);
    const scaledCl = cl.map(worldToScreen);

    // centerline
    ctx.save();
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scaledCl[0].x, scaledCl[0].y);
    ctx.lineTo(scaledCl[1].x, scaledCl[1].y);
    ctx.stroke();
    ctx.restore();

    // final sector
    ctx.save();
    ctx.strokeStyle = 'red';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(scaledFa[0].x, scaledFa[0].y);
    for (let i = 1; i < scaledFa.length; i++) {
        ctx.lineTo(scaledFa[i].x, scaledFa[i].y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
}

// ----------------------
// GRID
// ----------------------
export function drawAzimuthalGrid(ctx, grid) {
    const center = worldToScreen({ x: grid.centerX, y: grid.centerY });
    const maxR = grid.maxRadius * camera.zoom;

    const ringStep = 100 * camera.zoom;
    const angleStep = 15;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;

    // rings
    for (let r = ringStep; r < maxR; r += ringStep) {
        ctx.beginPath();
        ctx.arc(center.x, center.y, r, 0, Math.PI * 2);
        ctx.stroke();
    }

    // radials
    for (let a = 0; a < 360; a += angleStep) {
        const rad = degToRad(a);
        const x2 = center.x + Math.cos(rad) * maxR;
        const y2 = center.y + Math.sin(rad) * maxR;

        ctx.beginPath();
        ctx.moveTo(center.x, center.y);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    ctx.restore();
}
