import { ACTION_HANDLERS } from "./actionHandlers";

let lastGesture = 'None';
let stableGesture = 'None';
let lastGestureTime = 0;
const labelMapUrl = `${chrome.runtime.getURL('core/model/label_mapping.json')}?t=${Date.now()}`;
const labelMapPromise = fetch(labelMapUrl).then(res => res.json());
const GESTURE_HOLD_TIME = 500;

async function triggerAction(gesture) {
  const data = await chrome.storage.sync.get('actionMap');
  const actionMap = data.actionMap;
  if (!actionMap) return;

  const actionObj = actionMap[gesture];
  if (!actionObj || !actionObj.id) return;

  const handler = ACTION_HANDLERS[actionObj.id];
  console.log(`Performing action: ${actionObj.id}`);
  if (handler) handler(actionObj.value).catch(console.error);
  return;
}

export function updateStableGesture(gesture) {
  const now = Date.now();

  if (gesture !== lastGesture) {
    lastGesture = gesture;
    lastGestureTime = now;
  } else if (now - lastGestureTime >= GESTURE_HOLD_TIME) {
    stableGesture = gesture;
    lastGestureTime = now;
    triggerAction(stableGesture);
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

  // Palm direction: wrist (0) -> middle MCP (9)
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
  return scaled.flat();
}

function getDirection(landmarks, tipIdx, baseIdx, mirrorEnabled) {
  const [tx, ty] = landmarks[tipIdx];
  const [bx, by] = landmarks[baseIdx];

  const dx = (tx - bx)* (mirrorEnabled ? -1 : 1);
  const dy = ty - by;

  // Compare magnitudes to pick major axis
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'right' : 'left';
  } else {
    return dy > 0 ? 'down' : 'up';
  }
}

export function getPointingDirection(landmarks, gesture, mirrorEnabled = false) {
  switch (gesture) {
    case 'Point':
      return getDirection(landmarks, 8, 5, mirrorEnabled);
    case 'Thumb Point':
      return getDirection(landmarks, 4, 2, mirrorEnabled);
    default:
      return null;
  }
}

export async function classifyGesture(normalized, model, tf) {
  const inputTensor = tf.tensor2d([normalized]);
  const prediction = model.predict(inputTensor);
  const predictedIndex = prediction.argMax(-1).dataSync()[0];

  const labelMap = await labelMapPromise;
  const predictedGesture = labelMap[predictedIndex];

  inputTensor.dispose();
  prediction.dispose();

  return predictedGesture;
}

export async function detectGesture(landmarks, model, tf) {
  const normalized = normalizeLandmarks(landmarks);
  const res = await classifyGesture(normalized, model, tf);
  return res;
}
