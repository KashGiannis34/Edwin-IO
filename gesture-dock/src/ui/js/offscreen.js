import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';

const video = document.getElementById('webcam');
let handposeModel = null;
let localStream = null;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.target === 'offscreen' && msg.type === 'start-camera') {
    await startCamera();
  }
});

async function setupHandposeModel() {
  if (handposeModel) return;
  await tf.setBackend('webgl');
  await tf.ready();
  handposeModel = await handpose.load();
  console.log("Handpose model loaded in offscreen document.");
}

async function startCamera() {
  if (localStream) return;
  try {
    await setupHandposeModel();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localStream = stream;
    video.srcObject = stream;
    await video.play();
    sendLandmarksLoop();
  } catch (err) {
    console.error("Error starting camera in offscreen:", err);
  }
}

async function sendLandmarksLoop() {
  if (!localStream?.active || !handposeModel) {
    return;
  }

  const predictions = await handposeModel.estimateHands(video);
  const landmarks = predictions.length > 0 ? predictions[0].landmarks : null;

  chrome.runtime.sendMessage({
    type: 'landmarks',
    landmarks: landmarks
  });

  setTimeout(sendLandmarksLoop, 100);
}