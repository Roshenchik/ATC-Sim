const canvas = document.querySelector('[data-element="canvas"]')
const ctx = canvas.getContext('2d')


function resizeCanvas() {
  canvas.width = window.innerHeight
  canvas.height = window.innerHeight
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function getMousePosOnCanvas(mouse) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx = (mouse.clientX - rect.left) * scaleX;
  const my = (mouse.clientY - rect.top) * scaleY;

  return {x: mx, y: my};
}

function radToDeg(radians) {
  return radians * (180 / Math.PI);
}



let isMouseDown = false
let startingPoint = null;
canvas.addEventListener('mousedown', (e) => {
  isMouseDown = true;
  startingPoint = getMousePosOnCanvas(e);
});
canvas.addEventListener('mouseup', () => {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  isMouseDown = false;
  startingPoint = null;
});


export function drawRuler(event) {
  if (!isMouseDown) return; 
  const mousePos = getMousePosOnCanvas(event);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(startingPoint.x, startingPoint.y);
  ctx.lineTo(mousePos.x, mousePos.y)
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(mousePos.x, mousePos.y, 3, 0, 2 * Math.PI)
  ctx.fill();

  const midX = (mousePos.x + startingPoint.x) / 2
  const midY = (mousePos.y + startingPoint.y) / 2

  ctx.beginPath();
  //ctx.arc(midX, midY, 5, 0, 2 * Math.PI)
  //ctx.fill();




  const param = []

  const sideX = (startingPoint.x - mousePos.x)
  const sideY = (startingPoint.y - mousePos.y)
  const angleInRadians = Math.atan2(sideY, sideX) - Math.PI/2
  const angleInDegrees = Math.round(((angleInRadians * (180 / Math.PI)) + 360) % 360);

  const vectorLength = Math.round(Math.sqrt(Math.pow(sideX, 2) + Math.pow(sideY,2 )))

  ctx.font = '20px monospace';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  //ctx.lineWidth = 3;

  param.push(vectorLength)
  param.push(angleInDegrees)
  for (let i = 0; i < param.length; i++) {
    const text = param[i];
    const gap = ctx.measureText(text).width;

    ctx.fillText(text, midX + i * 35, midY)
  }


  

  // console.log(mx, my)
}
export function deleteRuler(event) {
  console.log('relesed')
}

// const rad = degToRad(heading - 90);
//     const offset = 15;
//     let offsetX = -Math.sin(rad) * offset;
//     let offsetY = Math.cos(rad) * offset;
//     let textX = x + offsetX;
//     let textY = y + offsetY;

//     ctx.save();
//     ctx.font = '10px monospace';
//     ctx.textBaseline = 'top';
//     ctx.strokeStyle = 'rgba(0,0,0,0.5)';
//     ctx.lineWidth = 3;

//     const lines = [
//       `${callsign}`,
//       `HDG ${heading.toFixed(0).padStart(3,'0')}`,
//       `SPD ${groundSpeed.toFixed(0)}`,
//       `FL ${flightLevel}`
//     ];

//     let maxWidth = 0;
//     for (const line of lines) maxWidth = Math.max(maxWidth, ctx.measureText(line).width);
//     const boxWidth = maxWidth + 8;
//     const boxHeight = lines.length * 12 + 4;

//     if (heading > 180 && heading <= 270) {
//       textX = x - offsetX;
//       textY = y - offsetY;
//     }
//     let boxClosestCorner = textX - 4;
//     if (heading > 90 && heading <= 180) {
//       textX = x - boxWidth + offsetX;
//       boxClosestCorner = (textX - 4) + boxWidth;
//     }

//     ctx.fillStyle = 'rgba(100,100,100,0.5)';
//     ctx.fillRect(textX - 4, textY - 2, boxWidth, boxHeight);

//     ctx.beginPath();
//     ctx.moveTo(boxClosestCorner, textY - 2);
//     ctx.lineTo(x, y);
//     ctx.strokeStyle = 'white';
//     ctx.lineWidth = 0.5;
//     ctx.stroke();

//     ctx.fillStyle = selected ? COLORS.SELECTED_PLANE : COLORS.DEFAULT_PLANE;
//     lines.forEach((line,i) => ctx.fillText(line, textX, textY + i * 12));
//     ctx.restore();

// =====================
// ====== EVENT LISTENERS ======
canvas.addEventListener('mousemove', e => drawRuler(e));
canvas.addEventListener('mouseup', e => deleteRuler(e));
