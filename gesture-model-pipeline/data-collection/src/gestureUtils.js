let lastGesture = null;
let stableGesture = null;
let lastGestureTime = 0;
const GESTURE_HOLD_TIME = 100; // milliseconds
const labelMapUrl = `${chrome.runtime.getURL('model/label_mapping.json')}?t=${Date.now()}`;
const labelMapPromise = fetch(labelMapUrl).then(res => res.json());

export function updateStableGesture(gesture) {
  const now = Date.now();

  if (gesture !== lastGesture) {
    lastGesture = gesture;
    lastGestureTime = now;
  } else if (now - lastGestureTime >= GESTURE_HOLD_TIME && gesture !== stableGesture) {
    stableGesture = gesture;
  }
}

export function getStableGesture() {
  return stableGesture;
}

function isKeypointSpreadTooSmall(keypoints, minSpread = 50) {
  const xs = keypoints.map(p => p[0]);
  const ys = keypoints.map(p => p[1]);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  return Math.max(spreadX, spreadY) < minSpread;
}

export async function getFilteredHands(model, canvas, minSpread = 50) {
  const predictions = await model.estimateHands(canvas);
  return predictions.filter(pred => !isKeypointSpreadTooSmall(pred.keypoints, minSpread));
}

export function normalizeKeypoints(keypoints) {
  if (!keypoints || keypoints.length !== 21) return [];

  // Use dot notation to get wrist coordinates from the object
  const wristX = keypoints[0].x;
  const wristY = keypoints[0].y;

  // Create an array of [x, y] pairs for the 2D math, discarding z
  const translated = keypoints.map(point => [
    point.x - wristX,
    point.y - wristY
  ]);

  // --- The rest of this logic is the same as the original 2D version ---

  // Palm direction: wrist (0) -> middle MCP (9)
  const [dx, dy] = [translated[9][0], translated[9][1]];
  const angle = Math.atan2(dy, dx);

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const rotated = translated.map(([x, y]) => [
    x * cosA - y * sinA,
    x * sinA + y * cosA
  ]);

  // Scale based on average MCP distances from wrist
  const mcpIndices = [5, 9, 13, 17];
  const avgDist = mcpIndices
    .map(i => Math.hypot(rotated[i][0], rotated[i][1]))
    .reduce((a, b) => a + b, 0) / mcpIndices.length || 1;

  const scaled = rotated.map(([x, y]) => [x / avgDist, y / avgDist]);

  // Exclude the wrist and flatten to a 42-element vector
  return scaled.flat();
}

export function drawNormalizedKeypoints(ctx, normalizedVector, canvasWidth, canvasHeight) {
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Updated to expect a 42-element 3D vector.
  if (!Array.isArray(normalizedVector) || normalizedVector.length !== 42) {
    return;
  }

  // Reconstruct the 21 2D points, adding the wrist back at the origin.
  const points = [];
  for (let i = 0; i < normalizedVector.length; i += 2) {
    points.push([normalizedVector[i], normalizedVector[i + 1]]);
  }

  // Find the bounds to auto-fit the drawing
  const xs = points.map(p => p[0]);
  const ys = points.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = 0.9 * Math.min(canvasWidth / rangeX, canvasHeight / rangeY);

  const offsetX = (minX + maxX) / 2;
  const offsetY = (minY + maxY) / 2;

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], [0, 5] // Palm
  ];

  // Draw the connecting lines
  ctx.strokeStyle = 'rgba(0, 0, 255, 0.8)';
  ctx.lineWidth = 2;
  for (const connection of connections) {
    const start = points[connection[0]];
    const end = points[connection[1]];
    if (start && end) {
      ctx.beginPath();
      // Apply scaling, centering, and flip the Y-axis
      ctx.moveTo(((start[0] - offsetX) * scale) + canvasWidth / 2, ((-start[1] + offsetY) * scale) + canvasHeight / 2);
      ctx.lineTo(((end[0] - offsetX) * scale) + canvasWidth / 2, ((-end[1] + offsetY) * scale) + canvasHeight / 2);
      ctx.stroke();
    }
  }

  // Draw the points with a depth effect
  for (const [x, y] of points) {
    const radius = 3;
    ctx.fillStyle = `rgba(0, 0, 255)`;

    ctx.beginPath();
    ctx.arc(
      ((x - offsetX) * scale) + canvasWidth / 2,
      ((-y + offsetY) * scale) + canvasHeight / 2,
      radius,
      0, 2 * Math.PI
    );
    ctx.fill();
  }
}

function getDirection(keypoints, tipIdx, baseIdx, mirrorEnabled) {
  const [tx, ty] = keypoints[tipIdx];
  const [bx, by] = keypoints[baseIdx];

  const dx = (tx - bx)* (mirrorEnabled ? -1 : 1);
  const dy = ty - by;

  // Compare magnitudes to pick major axis
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

export function getPointingDirection(keypoints, gesture, mirrorEnabled = false) {
  switch (gesture) {
    case 'Point':
      return getDirection(keypoints, 8, 5, mirrorEnabled);
    case 'Thumb Point':
      return getDirection(keypoints, 4, 2, mirrorEnabled);
    default:
      return null;
  }
}

async function classifyGesture(normalized, model, tf) {
  const inputTensor = tf.tensor2d([normalized]);
  const prediction = model.predict(inputTensor);
  const predictedIndex = prediction.argMax(-1).dataSync()[0];

  const labelMap = await labelMapPromise;
  const predictedGesture = labelMap[predictedIndex];

  inputTensor.dispose();
  prediction.dispose();

  return predictedGesture;
}

export async function detectGesture(keypoints, model, tf) {
  const normalized = normalizeKeypoints(keypoints);
  const res = await classifyGesture(normalized, model, tf);
  return res;
}

