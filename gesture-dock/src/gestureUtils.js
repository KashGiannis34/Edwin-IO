let lastGesture = null;
let stableGesture = null;
let lastGestureTime = 0;
const GESTURE_HOLD_TIME = 100; // milliseconds

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

function isLandmarkSpreadTooSmall(landmarks, minSpread = 50) {
  const xs = landmarks.map(p => p[0]);
  const ys = landmarks.map(p => p[1]);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  return Math.max(spreadX, spreadY) < minSpread;
}

export async function getFilteredHands(model, video, minSpread = 50) {
  const predictions = await model.estimateHands(video);
  return predictions.filter(pred => !isLandmarkSpreadTooSmall(pred.landmarks, minSpread));
}

export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== 21) return [];

  const [x0, y0] = landmarks[0]; // wrist
  const translated = landmarks.map(([x, y]) => [x - x0, y - y0]);

  // Palm direction: wrist (0) → middle MCP (9)
  const [dx, dy] = [translated[9][0], translated[9][1]];
  const angle = Math.atan2(dy, dx); // Y-up rotation only

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
  return scaled.flat(); // Flatten to single vector
}

export async function classifyGesture(normalized, model, tf) {
  const inputTensor = tf.tensor2d([normalized]);
  const prediction = model.predict(inputTensor);
  const predictedIndex = prediction.argMax(-1).dataSync()[0];

  const labelMap = await fetch(chrome.runtime.getURL('model/label_mapping.json')).then(res => res.json());
  const predictedGesture = labelMap[predictedIndex];
  return predictedGesture;
}

export async function detectGesture(landmarks, model, tf) {
  const normalized = normalizeLandmarks(landmarks);
  const res = await classifyGesture(normalized, model, tf);
  return res;
}
