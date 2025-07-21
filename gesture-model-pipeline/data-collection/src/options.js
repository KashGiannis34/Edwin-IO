import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { normalizeKeypoints, drawNormalizedKeypoints, detectGesture, updateStableGesture, getStableGesture, getFilteredHands } from './gestureUtils.js';

// --- DOM Elements ---
const video = document.getElementById("webcam");
const statusText = document.getElementById("status-text");
const startBtn = document.getElementById("start-button");

const displayCanvas = document.getElementById("overlay-canvas");
const displayCtx = displayCanvas.getContext("2d");

const processingCanvas = document.getElementById("processing-canvas");
const processingCtx = processingCanvas.getContext("2d");

const normCanvas = document.getElementById("normalized-canvas");
const normCtx = normCanvas.getContext("2d");

// --- State ---
let model = null;
let gestureModel = null;
let isRunning = false;
let latestNorm = null;
let collectedSamples = [];

// --- Gesture Recording Stuff ---
const GESTURE_KEYS = {
  '1': "Point",
  '2': "Two",
  '3': "Three",
  '4': "Four",
  '5': "Open Hand",
  '6': "Surfer",
  '7': "Thumb Point",
  '8': "None",
  '9': "Rock On",
  '0': "Zero",
  'd': "DOWNLOAD",
  'r': "RESET",
};

document.addEventListener('keydown', (e) => {
  console.log(`Key pressed: ${e.key}`);
  const label = GESTURE_KEYS[e.key];

  if (label === "DOWNLOAD") {
    downloadCollectedSamples();
  } else if (label === "RESET") {
    collectedSamples = [];
    updateSampleCountsDisplay();
  } else {
    if (!label || !latestNorm) return;
    saveGestureSample(label, latestNorm);
  }
});

function renderGestureKeybinds() {
  const list = document.getElementById("gesture-keys-list");
  list.innerHTML = "";

  for (const [key, gesture] of Object.entries(GESTURE_KEYS)) {
    const li = document.createElement("li");
    li.innerHTML = `<code>"${key}"</code> → ${gesture}`;
    list.appendChild(li);
  }
}

function downloadCollectedSamples() {
  const blob = new Blob([JSON.stringify(collectedSamples, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = 'gesture_samples.json';
  a.click();

  URL.revokeObjectURL(url);
}

function updateSampleCountsDisplay() {
  const counts = {};

  for (const { label } of collectedSamples) {
    counts[label] = (counts[label] || 0) + 1;
  }

  const list = document.getElementById("sample-list");
  list.innerHTML = "";

  for (const [label, count] of Object.entries(counts)) {
    const item = document.createElement("li");
    item.textContent = `${label}: ${count}`;
    list.appendChild(item);
  }
}

function saveGestureSample(label, keypoints) {
  if (keypoints.length === 42) {
    collectedSamples.push({ label, vector: keypoints });
    updateSampleCountsDisplay();
    console.log(`Saved sample for "${label}". Total samples: ${collectedSamples.length}`);
  }
}

// --- Drawing Function ---
function drawHand(keypoints, keypoints3D) {
  // Always clear the visible overlay canvas before drawing new keypoints
  displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
  if (!keypoints) return;

  const connections = [
    [0, 1], [1, 2], [2, 3], [3, 4], // Thumb
    [0, 5], [5, 6], [6, 7], [7, 8], // Index
    [0, 9], [9, 10], [10, 11], [11, 12], // Middle
    [0, 13], [13, 14], [14, 15], [15, 16], // Ring
    [0, 17], [17, 18], [18, 19], [19, 20], // Pinky
    [5, 9], [9, 13], [13, 17], [0, 5] // Palm
  ];

  displayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  displayCtx.lineWidth = 2;
  for (const connection of connections) {
    const start = keypoints[connection[0]];
    const end = keypoints[connection[1]];
    if (start && end) {
      displayCtx.beginPath();
      displayCtx.moveTo(start.x, start.y);
      displayCtx.lineTo(end.x, end.y);
      displayCtx.stroke();
    }
  }

  displayCtx.fillStyle = '#00B6FF';
  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];
    const keypoint3D = keypoints3D[i];
    const radius = 4 + (keypoint3D.z * 60);

    displayCtx.beginPath();
    displayCtx.arc(keypoint.x, keypoint.y, Math.max(1, radius), 0, 2 * Math.PI);
    displayCtx.fill();
  }
}

// --- Main Loop ---
async function renderLoop() {
  if (!isRunning || !model) return;

  if (video.readyState < 2) {
    requestAnimationFrame(renderLoop);
    return;
  }

  processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

  const predictions = await getFilteredHands(model, processingCanvas);

  if (predictions.length > 0) {
    const gesture = await detectGesture(predictions[0].keypoints, gestureModel, tf);
    updateStableGesture(gesture);

    statusText.textContent = `✅ Hand Detected Current gesture: ${getStableGesture()}`;
    drawHand(predictions[0].keypoints, predictions[0].keypoints3D);

    latestNorm = normalizeKeypoints(predictions[0].keypoints);
    if (latestNorm) {
      drawNormalizedKeypoints(normCtx, latestNorm, 300, 300);
    }
  } else {
    statusText.textContent = `❌ No Hand Detected Current gesture: ${getStableGesture()}`;
    drawHand(null);
    updateStableGesture('None');
    latestNorm = null;
  }

  requestAnimationFrame(renderLoop);
}

// --- Startup Function ---
async function main() {
  if (isRunning) return;
  startBtn.disabled = true;

  try {
    statusText.textContent = "Initializing TensorFlow.js...";
    await tf.setBackend('webgl');
    await tf.ready();

    statusText.textContent = "Loading Hand Pose model...";
    const detectorModel = handPoseDetection.SupportedModels.MediaPipeHands;
    const detectorConfig = {
      runtime: 'tfjs',
      modelType: 'lite',
    };
    model = await handPoseDetection.createDetector(detectorModel, detectorConfig);
    gestureModel = await tf.loadLayersModel(chrome.runtime.getURL('model/model.json'));

    statusText.textContent = "";
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await new Promise(resolve => {
      video.onloadedmetadata = () => {
        displayCanvas.width = video.videoWidth;
        displayCanvas.height = video.videoHeight;
        processingCanvas.width = video.videoWidth;
        processingCanvas.height = video.videoHeight;
        resolve();
      };
    });
    await video.play();

    isRunning = true;
    statusText.textContent = "Ready!";
    startBtn.style.display = 'none';
    renderLoop();

  } catch (err) {
    console.error("Error starting session:", err);
    statusText.textContent = "❌ Error: Could not start camera.";
    startBtn.disabled = false;
  }
}

startBtn.onclick = main;
renderGestureKeybinds();