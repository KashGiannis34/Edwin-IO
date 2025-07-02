import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

import { getFilteredHands, updateStableGesture, detectGesture, getStableGesture, drawNormalizedLandmarks, normalizeLandmarks } from './gestureUtils.js';

const video = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("gesture-output");
const startBtn = document.getElementById("start-button");

const normCanvas = document.getElementById("normalized-canvas");
const normCtx = normCanvas.getContext("2d");


let isRunning = false;
let model = null;

let collectedSamples = [];
let latestLandmarks = null;

const GESTURE_KEYS = {
  '1': "Open Hand",
  '2': "Point",
  '3': "Two",
  '4': "Three",
  '5': "Four",
  '6': "Surfer",
  'd': "DOWNLOAD",
  'r': "RESET",
};

document.addEventListener('keydown', (e) => {
  console.log(`Key pressed: ${e.key}`);
  const label = GESTURE_KEYS[e.key];
  if (!label || !latestLandmarks) return;

  if (label === "DOWNLOAD") {
    downloadCollectedSamples();
  } else if (label === "RESET") {
    collectedSamples = [];
    updateSampleCountsDisplay();
  } else {
    saveGestureSample(label, latestLandmarks);
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

async function initializeModel() {
  await tf.setBackend('webgl');
  await tf.ready();
  model = await handpose.load();
}

async function initializeCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;

  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });

  await video.play();
}

function drawHand(predictions) {
  predictions.forEach(prediction => {
    const landmarks = prediction.landmarks;

    for (const [x, y] of landmarks) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'lime';
      ctx.fill();
    }

    const fingers = {
      thumb: landmarks[4],
      index: landmarks[8],
      middle: landmarks[12],
      ring: landmarks[16],
      pinky: landmarks[20]
    };

    const gesture = detectGesture(landmarks);
    updateStableGesture(gesture);

    const normalized = normalizeLandmarks(landmarks);
    latestLandmarks = normalized;
    drawNormalizedLandmarks(normCtx, normalized);

    output.textContent = `✋ Hand Detected! -- stable: ${getStableGesture()}  unstable: ${gesture}.
Thumb: ${fingers.thumb.map(n => n.toFixed(0)).join(', ')}
Index: ${fingers.index.map(n => n.toFixed(0)).join(', ')}
Middle: ${fingers.middle.map(n => n.toFixed(0)).join(', ')}
Ring: ${fingers.ring.map(n => n.toFixed(0)).join(', ')}
Pinky: ${fingers.pinky.map(n => n.toFixed(0)).join(', ')}`;

    chrome.runtime.sendMessage({ gesture });
  });
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

function saveGestureSample(label, landmarks) {
  if (landmarks.length === 42) {
    collectedSamples.push({ label, vector: landmarks });
    updateSampleCountsDisplay();  // 🔥 update UI
    console.log(`Saved sample for "${label}". Total samples: ${collectedSamples.length}`);
  }
}

async function renderLoop() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const predictions = await getFilteredHands(model, video);
  if (predictions.length > 0) {
    drawHand(predictions);
  } else {
    updateStableGesture(null);
    output.textContent = `🛑 No hand detected. Current gesture: ${getStableGesture()}`;
  }

  requestAnimationFrame(renderLoop);
}

async function startGestureRecognition() {
  if (isRunning) return;

  try {
    await initializeModel();
    await initializeCamera();
    isRunning = true;
    renderLoop();
  } catch (err) {
    console.error("Camera access denied:", err);
    output.textContent = "❌ Camera access denied";
  }
}

startBtn.onclick = startGestureRecognition;

renderGestureKeybinds();