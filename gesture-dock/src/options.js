import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

import { getFilteredHands, updateStableGesture, detectGesture, getStableGesture } from './gestureUtils.js';

const video = document.getElementById("webcam");
const canvas = document.getElementById("output-canvas");
const ctx = canvas.getContext("2d");
const output = document.getElementById("gesture-output");
const startBtn = document.getElementById("start-button");


let isRunning = false;
let model = null;

let gestureModel = null;
async function loadModel() {
  gestureModel = await tf.loadLayersModel(chrome.runtime.getURL('model/model.json'));
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

async function drawHand(predictions) {
  predictions.forEach(async (prediction) =>{
    const landmarks = prediction.landmarks;

    for (const [x, y] of landmarks) {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, 2 * Math.PI);
      ctx.fillStyle = 'lime';
      ctx.fill();
    }

    const gesture = await detectGesture(landmarks, gestureModel, tf);
    updateStableGesture(gesture);

    output.textContent = `✋ Hand Detected: ${getStableGesture()}`;

    chrome.runtime.sendMessage({ gesture });
  });
}

async function renderLoop() {
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  const predictions = await getFilteredHands(model, video);
  if (predictions.length > 0) {
    await drawHand(predictions);
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
    await loadModel();
    await initializeCamera();
    isRunning = true;
    renderLoop();
  } catch (err) {
    console.error("Camera access denied:", err);
    output.textContent = "❌ Camera access denied";
  }
}

startBtn.onclick = startGestureRecognition;