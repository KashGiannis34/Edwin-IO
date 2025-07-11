// background.js

import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { getFilteredHands, updateStableGesture, detectGesture, getPointingDirection } from './gestureUtils.js';

let handposeModel = null;
let gestureModel = null;
const offscreenDocumentPath = 'offscreen.html';

async function setupModels() {
  if (handposeModel && gestureModel) return;
  await tf.setBackend('webgl');
  [handposeModel, gestureModel] = await Promise.all([
    handpose.load(),
    tf.loadLayersModel(chrome.runtime.getURL('model/model.json'))
  ]);
  console.log("Both models loaded successfully.");
}

async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(client => client.url.endsWith(offscreenDocumentPath));
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
  } else {
    updateStableGesture('None');
  }
}

async function toggleRecognition(isActive) {
  const isDocumentOpen = await hasOffscreenDocument();

  if (isActive && !isDocumentOpen) {
    await chrome.offscreen.createDocument({
        url: offscreenDocumentPath,
        reasons: ['USER_MEDIA'],
        justification: 'To process hand gestures from the webcam.',
    });
    chrome.runtime.sendMessage({ type: 'start-camera', target: 'offscreen' });
    await setupModels();
  } else if (!isActive && isDocumentOpen) {
    await chrome.offscreen.closeDocument();
  }
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  if (message.type === 'videoFrame') {
    if (await hasOffscreenDocument()) {
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