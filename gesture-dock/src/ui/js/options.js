import { GESTURES, ACTIONS, DEFAULT_ACTION_MAP } from './actionMap.js';

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
const processingCanvas = document.getElementById("processing-canvas");
const processingCtx = processingCanvas.getContext("2d", { willReadFrequently: true });

let localStream = null;
let latestLandmarks = null;
let lastFrameSendTime = 0;
let animationFrameId = null;

const port = chrome.runtime.connect({ name: "options-page" });

async function startLocalCamera() {
  if (localStream) return;
  try {
    gestureArea.style.display = 'block';
    localStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = localStream;

    video.onloadedmetadata = () => {
      displayCanvas.width = video.videoWidth;
      displayCanvas.height = video.videoHeight;
      processingCanvas.width = video.videoWidth;
      processingCanvas.height = video.videoHeight;
      renderLoop();
    };

    await video.play();
  } catch (err) {
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
  displayCtx.fillStyle = 'lime';
  for (const [x, y] of landmarks) {
    displayCtx.beginPath();
    displayCtx.arc(x, y, 5, 0, 2 * Math.PI);
    displayCtx.fill();
  }
}

function renderLoop() {
  if (!localStream?.active) return;

  drawHand(latestLandmarks);

  const now = performance.now();
  if (now - lastFrameSendTime > 100) {
    lastFrameSendTime = now;

    processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);
    const imageData = processingCtx.getImageData(0, 0, processingCanvas.width, processingCanvas.height);

    chrome.runtime.sendMessage({
      type: 'videoFrame',
      frame: { data: imageData.data, width: imageData.width, height: imageData.height }
    });
  }
  animationFrameId = requestAnimationFrame(renderLoop);
}

// RUNTIME CODE
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
      const { gesture, landmarks } = msg.data;
      gestureOutput.textContent = `Detected Gesture: ${gesture || 'None'}`;
      latestLandmarks = landmarks;
      break;
    case "start-camera":
      startLocalCamera();
      break;
    case "stop-camera":
      stopLocalCamera();
      break;
  }
});