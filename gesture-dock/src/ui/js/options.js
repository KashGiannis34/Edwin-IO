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
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const gestureOutput = document.getElementById("gesture-output");
let localStream = null;
let frameInterval = null;
let latestLandmarks = null;

const port = chrome.runtime.connect({ name: "options-page" });

async function startLocalCamera() {
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = localStream;

    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      if (frameInterval) clearInterval(frameInterval);
      frameInterval = setInterval(sendFrameToBackground, 100);

      renderLoop();
    };

    await video.play();
  } catch (err) {
    console.error("Could not start camera on options page:", err);
    gestureOutput.textContent = "❌ Camera access denied or unavailable.";
  }
}

function sendFrameToBackground() {
  if (!video.srcObject?.active) {
    clearInterval(frameInterval);
    return;
  }
  const tempCanvas = new OffscreenCanvas(video.videoWidth, video.videoHeight);
  const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });
  tempCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  const imageData = tempCtx.getImageData(0, 0, video.videoWidth, video.videoHeight);

  chrome.runtime.sendMessage({
    type: 'videoFrame',
    frame: {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    }
  });
}

function drawHand(landmarks) {
  if (!landmarks) return;
  ctx.fillStyle = 'lime';
  for (const [x, y] of landmarks) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function renderLoop() {
  // Draw the current video frame onto the canvas
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  // Draw the latest hand landmarks on top of the video
  drawHand(latestLandmarks);
  // Continue the loop
  requestAnimationFrame(renderLoop);
}


// RUNTIME CODE
document.addEventListener('DOMContentLoaded', async () => {
  await initActionMap(DEFAULT_ACTION_MAP, handleActionMapUI);
  startLocalCamera();
});

window.addEventListener("beforeunload", () => {
  if (frameInterval) clearInterval(frameInterval);
  localStream?.getTracks().forEach(track => track.stop());
});

port.onMessage.addListener((msg) => {
  if (msg.type === "gesture-data") {
    const { gesture, landmarks } = msg.data;
    gestureOutput.textContent = `Detected Gesture: ${gesture || 'None'}`;
    latestLandmarks = landmarks; // Update the landmarks for the render loop to use
  }
});
