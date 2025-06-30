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

    output.textContent = `✋ Hand Detected! -- stable: ${getStableGesture()}  unstable: ${gesture}.
Thumb: ${fingers.thumb.map(n => n.toFixed(0)).join(', ')}
Index: ${fingers.index.map(n => n.toFixed(0)).join(', ')}
Middle: ${fingers.middle.map(n => n.toFixed(0)).join(', ')}
Ring: ${fingers.ring.map(n => n.toFixed(0)).join(', ')}
Pinky: ${fingers.pinky.map(n => n.toFixed(0)).join(', ')}`;

    chrome.runtime.sendMessage({ gesture });
  });
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