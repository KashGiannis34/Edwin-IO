import * as tf from '@tensorflow/tfjs';
import * as handPoseDetection from '@tensorflow-models/hand-pose-detection';
import { getFilteredHands } from '../../core/gestureUtils';

const video = document.getElementById('webcam');
const processingCanvas = document.getElementById("processing-canvas");
const processingCtx = processingCanvas.getContext("2d");

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
  const detectorModel = handPoseDetection.SupportedModels.MediaPipeHands;
  const detectorConfig = {
    runtime: 'tfjs',
    modelType: 'lite',
  };
  handposeModel = await handPoseDetection.createDetector(detectorModel, detectorConfig);
  console.log("Handpose model loaded in offscreen page.");
}

async function startCamera() {
  if (localStream) return;
  try {
    await setupHandposeModel();

    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    localStream = stream;
    video.srcObject = stream;
    video.onloadedmetadata = () => {
      processingCanvas.width = video.videoWidth;
      processingCanvas.height = video.videoHeight;
    };
    await video.play();
    console.log("Setup offscreen detection");
    sendKeypointsLoop();
  } catch (err) {
    console.error("Error starting camera in offscreen:", err);
  }
}

async function sendKeypointsLoop() {
  if (!localStream?.active || !handposeModel) {
    return;
  }

  processingCtx.drawImage(video, 0, 0, processingCanvas.width, processingCanvas.height);

  const predictions = await getFilteredHands(handposeModel, processingCanvas);
  const keypoints = predictions.length > 0 ? predictions[0].keypoints : null;

  console.log(predictions);

  chrome.runtime.sendMessage({
    type: 'keypoints',
    keypoints: keypoints
  });

  setTimeout(sendKeypointsLoop, 17);
}