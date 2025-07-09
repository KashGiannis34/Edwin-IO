import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

import { getFilteredHands, updateStableGesture, detectGesture, getStableGesture, getPointingDirection } from './gestureUtils.js';

let options = {};
const video = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("gesture-output");
const camToggle    = document.getElementById('camera-toggle');
const mirrorToggle = document.getElementById('mirror-toggle');
const wrapper = document.querySelector('.video-wrapper');

let isRunning = false;
let model = null;
let rafId = null;
let streamTracks = [];

let gestureModel = null;
async function loadModel() {
  gestureModel = await tf.loadLayersModel(chrome.runtime.getURL('model/model.json'));
}

function setUIVisible(on) {
  document.getElementById('mirror-row')
          .classList.toggle('hidden', !on);
  document.getElementById('gesture-area')
          .classList.toggle('hidden', !on);
}

function handleMirrorToggle() {
  mirrorToggle.checked = options['mirrorEnabled'];
  wrapper.classList.toggle('mirrored', options['mirrorEnabled']);
  mirrorToggle.classList.toggle('mirrored', options['mirrorEnabled']);

  mirrorToggle.addEventListener('change', async () => {
    options['mirrorEnabled'] = mirrorToggle.checked;
    wrapper.classList.toggle('mirrored', options['mirrorEnabled']);
    mirrorToggle.classList.toggle('mirrored', options['mirrorEnabled']);
    chrome.storage.sync.set(options);
  });
}

async function initializeOptions() {
  await initOption('mirrorEnabled', handleMirrorToggle);
}

async function initOption(key, extraActions) {
  const data = await chrome.storage.sync.get(key);
  options[key] = data[key];
  extraActions();
}

async function initializeModel() {
  await tf.setBackend('webgl');
  await tf.ready();
  model = await handpose.load();
}

async function initializeCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  streamTracks = stream.getTracks();

  await new Promise(resolve => {
    video.onloadedmetadata = () => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      resolve();
    };
  });

  await video.play();
}

function drawHand(landmarks) {
  for (const [x, y] of landmarks) {
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = 'lime';
    ctx.fill();
  }
}

async function handleGesture(landmarks) {
  let gesture = await detectGesture(landmarks, gestureModel, tf);

  if (gesture === 'Point' || gesture === 'Thumb Point') {
    const pointingDirection = getPointingDirection(landmarks, gesture, options['mirrorEnabled']);
    gesture += ` (${pointingDirection})`;
  }

  updateStableGesture(gesture);

  output.textContent = `✋ Hand Detected: ${getStableGesture()}`;

  chrome.runtime.sendMessage({ gesture });
}

async function renderLoop() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const predictions = await getFilteredHands(model, video);
  if (predictions.length > 0) {
    const landmarks = predictions[0].landmarks;
    await drawHand(landmarks);

    await handleGesture(landmarks);
  } else {
    updateStableGesture(null);
    output.textContent = `🛑 No hand detected. Current gesture: ${getStableGesture()}`;
  }

  rafId = requestAnimationFrame(renderLoop);
}

async function startGestureRecognition() {
  if (isRunning || !camToggle.checked) return;

  try {
    isRunning = true;
    setUIVisible(true);
    await initializeModel();
    if (!camToggle.checked) throw 'aborted';
    await loadModel();
    if (!camToggle.checked) throw 'aborted';
    await initializeCamera();
    if (!camToggle.checked) throw 'aborted';
    renderLoop();
  } catch (err) {
    console.error("Camera access denied:", err);
    output.textContent = "❌ Camera access denied";
  }
}

function stopGestureRecognition() {
  if (!isRunning) return;
  setUIVisible(false);
  cancelAnimationFrame(rafId);
  streamTracks.forEach(t => t.stop());
  ctx.clearRect(0,0,canvas.width,canvas.height);
  output.textContent = '';
  isRunning = false;
}

camToggle.addEventListener('change', async () => {
  if (camToggle.checked) {
    await startGestureRecognition();
  } else {
    stopGestureRecognition();
  }
});

await initializeOptions();
setUIVisible(false);