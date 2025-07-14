import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { getFilteredHands, updateStableGesture, detectGesture, getPointingDirection, getStableGesture } from './gestureUtils.js';

let handposeModel = null;
let gestureModel = null;
let optionsPort = null;
const offscreenDocumentPath = 'ui/offscreen.html';
let isRecognitionGloballyActive = false;

async function setupModels() {
  if (handposeModel && gestureModel) return;
  await tf.setBackend('webgl');
  await tf.ready();
  [handposeModel, gestureModel] = await Promise.all([
    handpose.load(),
    tf.loadLayersModel(chrome.runtime.getURL('core/model/model.json'))
  ]);
  console.log("Both models loaded successfully.");
}

async function startOffscreenDocument() {
  if (!(await hasOffscreenDocument())) {
    await chrome.offscreen.createDocument({
        url: 'ui/offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'To process hand gestures from the webcam.',
    });
    chrome.runtime.sendMessage({ type: 'start-camera', target: 'offscreen' });
  }
}

async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(client => client.url.endsWith(offscreenDocumentPath));
}

async function closeOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        await chrome.offscreen.closeDocument();
    }
}

async function processFrame(frameData) {
  if (!handposeModel || !gestureModel) {
    console.log("Models not ready.");
    return;
  }

  const pixelData = new Uint8ClampedArray(Object.values(frameData.data));
  const imageData = new ImageData(
    pixelData,
    frameData.width,
    frameData.height
  );

  const predictions = await getFilteredHands(handposeModel, imageData);
  if (predictions.length > 0) {
    const landmarks = predictions[0].landmarks;
    let gesture = await detectGesture(landmarks, gestureModel, tf);
    if (gesture === 'Point' || gesture === 'Thumb Point') {
      const data = await chrome.storage.sync.get('mirrorEnabled');

      const pointingDirection = getPointingDirection(landmarks, gesture, data.mirrorEnabled);
      gesture += ` (${pointingDirection})`;
    }

    updateStableGesture(gesture);

    if (optionsPort) {
      optionsPort.postMessage({
        type: "gesture-data",
        data: { gesture: getStableGesture(), landmarks }
      });
    }
  } else {
    updateStableGesture('None');

    if (optionsPort) {
      optionsPort.postMessage({
        type: "gesture-data",
        data: { gesture: 'None', landmarks: null }
      });
    }
  }
}

async function toggleRecognition(isActive) {
  isRecognitionGloballyActive = isActive;
  if (isActive) {
    await setupModels();

    if (!optionsPort) {
      await startOffscreenDocument();
    }
  } else {
    await closeOffscreenDocument();
  }
}

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name === "options-page") {
    optionsPort = port;
    console.log("Options page connected. Shutting down offscreen document.");
    await closeOffscreenDocument(); // Free up the camera for the options page
    await setupModels();

    port.onDisconnect.addListener(async () => {
      optionsPort = null;
      console.log("Options page disconnected.");
      // If recognition is supposed to be on, restart the offscreen document
      if (isRecognitionGloballyActive) {
        console.log("Restarting offscreen document for background processing.");
        await startOffscreenDocument();
      }
    });
  }
});

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === "video-stream-forward") {
    if (optionsPort) {
      optionsPort.postMessage({
        type: "video-stream",
        stream: message.stream
      });
    }
    return;
  }

  if (message.type === 'videoFrame') {
    if (await hasOffscreenDocument()) {
      console.log("2: Background received frame");
      await processFrame(message.frame);
    }
    return;
  }

  if (message.type === 'toggle-recognition') {
    await toggleRecognition(message.isActive);
    await sendResponse({ success: true });
    return true;
  }
});