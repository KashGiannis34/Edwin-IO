import { GESTURES, ACTIONS, DEFAULT_ACTION_MAP } from './actionMap.js';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

// ACTION MAP UI CODE
let actionMap = {};

function createMappingPill(gesture, action) {
  const pill = document.createElement('div');
  pill.className = 'mapping-pill';

  const gsel = document.createElement('select');
  GESTURES.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    if (g === gesture) o.selected = true;
    gsel.append(o);
  });
  pill.append(gsel);

  const arrow = document.createElement('span');
  arrow.textContent = '→';
  pill.append(arrow);

  const asel = document.createElement('select');
  ACTIONS.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; o.textContent = a.name;
    if (a.id === action) o.selected = true;
    asel.append(o);
  });
  pill.append(asel);

  const btn = document.createElement('button');
  btn.textContent = '✕';
  pill.append(btn);

  gsel.addEventListener('change', () => {
    delete actionMap[gesture];
    gesture = gsel.value;
    actionMap[gesture] = asel.value;
    updateActionMap();
  });
  asel.addEventListener('change', () => {
    actionMap[gesture] = asel.value;
    updateActionMap();
  });
  btn.addEventListener('click', () => {
    delete actionMap[gesture];
    pill.remove();
    updateActionMap();
  });

  return pill;
}

function handleActionMapUI() {
  const container = document.getElementById('action-map-container');
  container.innerHTML = '';

  Object.entries(actionMap).forEach(([gesture, action]) => {
    container.append(createMappingPill(gesture, action));
  });

  document.getElementById('add-mapping').onclick = () => {
    const used = new Set(Object.keys(actionMap));
    const free = GESTURES.find(g => !used.has(g)) || GESTURES[0];
    actionMap[free] = ACTIONS[0].id;
    updateActionMap();

    handleActionMapUI();
  };
}

async function updateActionMap() {
  await chrome.storage.sync.set({ actionMap });
}

async function initActionMap(defaultVal, extraActions) {
  const data = await chrome.storage.sync.get('actionMap');
  if (data['actionMap'] === undefined) {
    actionMap = defaultVal;
    chrome.storage.sync.set({ ['actionMap']: defaultVal });
  } else {
    actionMap = data['actionMap'];
  }
  console.log('Action map initialized:', actionMap);
  extraActions();
}

// CAMERA FEED CODE
const video = document.getElementById("webcam");
const gestureArea = document.getElementById("gesture-area");
const gestureOutput = document.getElementById("gesture-output");

const displayCanvas = document.getElementById("output-canvas");
const displayCtx = displayCanvas.getContext("2d");

let localStream = null;
let latestLandmarks = null;
let lastFrameSendTime = 0;
let animationFrameId = null;
let handposeModel = null;

const port = chrome.runtime.connect({ name: "options-page" });

async function setupHandposeModel() {
  if (handposeModel) return;
  await tf.setBackend('webgl');
  await tf.ready();
  handposeModel = await handpose.load();
  console.log("Handpose model loaded in options page.");
}

async function startLocalCamera() {
  if (localStream) return;
  try {
    gestureArea.style.display = 'block';
    gestureOutput.textContent = "Loading model...";

    await setupHandposeModel();

    gestureOutput.textContent = "Starting camera...";
    localStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = localStream;
    video.onloadedmetadata = () => {
      displayCanvas.width = video.videoWidth;
      displayCanvas.height = video.videoHeight;
      renderLoop();
    };
    await video.play();
  } catch (err) {
    console.error("Could not start camera on options page:", err);
    gestureOutput.textContent = "❌ Camera access denied or unavailable.";
  }
}

function stopLocalCamera() {
  gestureArea.style.display = 'none';
  if (!localStream) return;
  cancelAnimationFrame(animationFrameId);
  localStream.getTracks().forEach(track => track.stop());
  localStream = null;
  video.srcObject = null;
}

function drawHand(landmarks) {
  displayCtx.clearRect(0, 0, displayCanvas.width, displayCanvas.height);
  if (!landmarks) return;

  const connections = [
    // Palm
    [0, 1], [0, 5], [0, 17], [5, 9], [9, 13], [13, 17],
    // Thumb
    [1, 2], [2, 3], [3, 4],
    // Index Finger
    [5, 6], [6, 7], [7, 8],
    // Middle Finger
    [9, 10], [10, 11], [11, 12],
    // Ring Finger
    [13, 14], [14, 15], [15, 16],
    // Pinky
    [17, 18], [18, 19], [19, 20]
  ];

  displayCtx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  displayCtx.lineWidth = 2;

  for (const connection of connections) {
    const [startIdx, endIdx] = connection;
    const startPoint = landmarks[startIdx];
    const endPoint = landmarks[endIdx];

    displayCtx.beginPath();
    displayCtx.moveTo(startPoint[0], startPoint[1]);
    displayCtx.lineTo(endPoint[0], endPoint[1]);
    displayCtx.stroke();
  }

  displayCtx.fillStyle = '#00B6FF';
  for (const landmark of landmarks) {
    displayCtx.beginPath();
    displayCtx.arc(landmark[0], landmark[1], 4, 0, 2 * Math.PI);
    displayCtx.fill();
  }
}

async function renderLoop() {
  if (!localStream?.active || !handposeModel) return;

  // Detect hands first
  const predictions = await handposeModel.estimateHands(video);
  latestLandmarks = predictions.length > 0 ? predictions[0].landmarks : null;

  // Draw video and landmarks
  displayCtx.drawImage(video, 0, 0, displayCanvas.width, displayCanvas.height);
  drawHand(latestLandmarks);

  // Send landmark data at a throttled rate
  const now = performance.now();
  if (now - lastFrameSendTime > 17) {
    lastFrameSendTime = now;
    chrome.runtime.sendMessage({
      type: 'landmarks',
      landmarks: latestLandmarks
    });
  }
  animationFrameId = requestAnimationFrame(renderLoop);
}

// LISTENERS
document.addEventListener('DOMContentLoaded', async () => {
  await initActionMap(DEFAULT_ACTION_MAP, handleActionMapUI);
  stopLocalCamera();
});

window.addEventListener("beforeunload", () => {
  stopLocalCamera();
});

port.onMessage.addListener((msg) => {
  switch (msg.type) {
    case "gesture-data":
      const { gesture } = msg.data;
      gestureOutput.textContent = `Detected Gesture: ${gesture || 'None'}`;
      break;
    case "start-camera":
      startLocalCamera();
      break;
    case "stop-camera":
      stopLocalCamera();
      break;
  }
});