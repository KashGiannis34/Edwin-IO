import { DEFAULT_ACTION_MAP, REPEAT_COOLDOWN_TIMES } from "../ui/js/actionMap";
import { ACTION_HANDLERS } from "./actionHandlers";

let lastGesture = 'None';
let stableGesture = 'None';
let lastGestureTime = 0;
const labelMapUrl = `${chrome.runtime.getURL('core/model/label_mapping.json')}?t=${Date.now()}`;
const labelMapPromise = fetch(labelMapUrl).then(res => res.json());
const REPEAT_GESTURE_TIME = 1250;
const NEW_GESTURE_TIME = 500;
let cooldownTime = NEW_GESTURE_TIME;
let activeTab = null;

export function addTabListeners() {
  chrome.tabs.onActivated.addListener(updateActiveTab);
  chrome.tabs.onUpdated.addListener(updateActiveTab);
  chrome.windows.onFocusChanged.addListener(updateActiveTab);
}

async function updateActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
}

async function triggerAction(gesture) {
  const data = await chrome.storage.sync.get('actionMap');
  const actionMap = data.actionMap ?? DEFAULT_ACTION_MAP;

  const actionObj = actionMap[gesture];
  if (!actionObj || !actionObj.id) return;
  cooldownTime = REPEAT_COOLDOWN_TIMES[actionObj.id] ?? 1250;
  const handler = ACTION_HANDLERS[actionObj.id];
  if (handler) handler(actionObj.value, activeTab).catch(console.error);

  return;
}

export function updateStableGesture(gesture) {
  const now = Date.now();

  if (gesture !== lastGesture) {
    lastGesture = gesture;
    lastGestureTime = now;
    cooldownTime = NEW_GESTURE_TIME;

  } else if (now - lastGestureTime >= cooldownTime) {
    stableGesture = gesture;
    lastGestureTime = now;
    triggerAction(stableGesture);
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

  // Palm direction: wrist (0) -> middle MCP (9)
  const [dx, dy] = [translated[9][0], translated[9][1]];
  const angle = Math.atan2(dy, dx);

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const rotated = translated.map(([x, y]) => [
    x * cosA - y * sinA,
    x * sinA + y * cosA
  ]);

  const mcpIndices = [5, 9, 13, 17];
  const avgDist = mcpIndices
    .map(i => Math.hypot(rotated[i][0], rotated[i][1]))
    .reduce((a, b) => a + b, 0) / mcpIndices.length || 1;

  const scaled = rotated.map(([x, y]) => [x / avgDist, y / avgDist]);

  return scaled.flat();
}

function getDirection(keypoints, tipIdx, baseIdx, mirrorEnabled) {
  const tx = keypoints[tipIdx].x, ty = keypoints[tipIdx].y;
  const bx = keypoints[baseIdx].x, by = keypoints[baseIdx].y;

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
