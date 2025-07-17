import { GESTURES, ACTIONS, DEFAULT_ACTION_MAP } from './actionMap.js';
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { getFilteredHands } from '../../core/gestureUtils.js';

// ACTION MAP UI CODE
let actionMap = {};

function createMappingPill(gesture, actionObj) {
  const pill = document.createElement('div');
  pill.className = 'mapping-pill';

  const gsel = document.createElement('select');
  gsel.classList.add('dropdown-arrow');
  GESTURES.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    if (g === gesture) o.selected = true;
    gsel.append(o);
  });

  const asel = document.createElement('select');
  asel.classList.add('dropdown-arrow');
  ACTIONS.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id;
    o.textContent = a.name;
    if (a.id === actionObj.id) o.selected = true;
    asel.append(o);
  });

  const valueContainer = document.createElement('span');
  valueContainer.className = 'value-container';

  const btn = document.createElement('button');
  btn.textContent = '✕';
  btn.className = 'remove-btn';

  const updateValueControls = () => {
    valueContainer.innerHTML = '';
    const selectedAction = ACTIONS.find(a => a.id === asel.value);

    if (!selectedAction?.hasValue) {
      actionMap[gesture].value = null;
      updateActionMap();
      return;
    }

    const isCustom = !selectedAction.predefinedValues ||
                     !selectedAction.predefinedValues.some(pv => pv.value === actionObj.value);
    const vInput = document.createElement('input');

    vInput.type = 'text';
    vInput.className = 'value-input';
    vInput.placeholder = selectedAction.placeholder || '...';
    vInput.addEventListener('input', () => {
      actionMap[gesture].value = vInput.value;
      updateActionMap();
    });

    if (selectedAction.predefinedValues) {
      vInput.classList.add('dropdown-arrow');

      const psel = document.createElement('select');
      psel.className = 'predefined-select';
      psel.classList.add('dropdown-arrow');

      selectedAction.predefinedValues.forEach(pv => {
        const o = document.createElement('option');
        o.value = pv.value;
        o.textContent = pv.name;
        psel.append(o);
      });

      if (selectedAction.customValueLabel) {
        const customOption = document.createElement('option');
        customOption.value = 'custom';
        customOption.textContent = selectedAction.customValueLabel;
        psel.append(customOption);
      }

      valueContainer.append(psel);

      psel.addEventListener('change', () => {
        if (psel.value === 'custom') {
          vInput.style.display = 'inline-block';
          if (actionObj.id == 'openPage') {
            vInput.value = 'https://';
          } else {
            vInput.value = '';
          }
          actionMap[gesture].value = vInput.value;
          vInput.focus();
        } else {
          vInput.classList.toggle('focus-outline', false);
          vInput.style.display = 'none';
          actionMap[gesture].value = psel.value;
        }
        updateActionMap().then(handleActionMapUI);
      });

      if (isCustom) {
        const vInputButton = document.createElement('button');

        vInputButton.className = 'value-select-overlay';
        vInputButton.addEventListener('click', () => {
          psel.showPicker();
          vInput.classList.toggle('focus-outline', true);
        });
        valueContainer.append(vInputButton);
      }
    }

    valueContainer.append(vInput);

    if (selectedAction.predefinedValues) {
      const psel = valueContainer.querySelector('.predefined-select');
      if(psel) psel.value = isCustom ? 'custom' : actionObj.value;
    }

    vInput.style.display = isCustom ? 'inline-block' : 'none';
    if(actionObj.value) vInput.value = actionObj.value;
  };

  gsel.addEventListener('change', () => {
    delete actionMap[gesture];
    gesture = gsel.value;
    actionMap[gesture] = actionObj;
    updateActionMap().then(handleActionMapUI);
  });

  asel.addEventListener('change', () => {
    actionObj.id = asel.value;
    const newAction = ACTIONS.find(a => a.id === asel.value);
    actionObj.value = newAction.predefinedValues ? newAction.predefinedValues[0].value : null;
    updateValueControls();
    updateActionMap();
  });

  btn.addEventListener('click', () => {
    delete actionMap[gesture];
    pill.remove();
    updateActionMap();
  });

  pill.append(gsel);
  pill.append(document.createTextNode(' → '));
  pill.append(asel);
  pill.append(valueContainer);
  pill.append(btn);

  updateValueControls();
  return pill;
}

function handleActionMapUI() {
  const container = document.getElementById('action-map-container');
  container.innerHTML = '';

  Object.entries(actionMap).forEach(([gesture, actionObj]) => {
    const validActionObj = (typeof actionObj === 'string')
      ? { id: actionObj, value: null }
      : actionObj;
    container.append(createMappingPill(gesture, validActionObj));
  });

  document.getElementById('add-mapping').onclick = () => {
    const used = new Set(Object.keys(actionMap));
    const free = GESTURES.find(g => !used.has(g)) || GESTURES[0];

    actionMap[free] = { id: ACTIONS[0].id, value: null };
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
const videoWrapper = document.getElementById("video-wrapper");

const displayCanvas = document.getElementById("output-canvas");
const displayCtx = displayCanvas.getContext("2d");

let localStream = null;
let latestLandmarks = null;
let lastFrameSendTime = 0;
let animationFrameId = null;
let handposeModel = null;

const port = chrome.runtime.connect({ name: "options-page" });

async function updateMirror() {
  const data = await chrome.storage.sync.get(['mirrorEnabled']);
  const mirrorEnabled = data.mirrorEnabled ?? false;

  console.log("Mirror setting updated:", mirrorEnabled);

  if (gestureArea.style.display === 'none') return;

  videoWrapper.classList.toggle('mirror', mirrorEnabled);
}

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

    await updateMirror();
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
  const predictions = await getFilteredHands(handposeModel, video);
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
chrome.storage.onChanged.addListener(updateMirror);

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