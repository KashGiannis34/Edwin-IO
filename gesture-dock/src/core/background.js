import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import { getFilteredHands, updateStableGesture, detectGesture, getPointingDirection, getStableGesture } from './gestureUtils.js';

let handposeModel = null;
let gestureModel = null;
let optionsPort = null;
let optionsTabId = null;
const offscreenDocumentPath = 'ui/offscreen.html';
let isRecognitionGloballyActive = false;
let currentOptions = {};
let activeCameraSource = 'none';
let isCreatingOffscreenDocument = false;
let isClosingOffscreenDocument = false;

async function initializeOptions() {
  const data = await chrome.storage.sync.get(['mirrorEnabled', 'actionMap']);
  currentOptions.mirrorEnabled = data.mirrorEnabled ?? false;
  currentOptions.actionMap = data.actionMap;
  console.log("Options initialized/updated:", currentOptions);
}

chrome.storage.onChanged.addListener(initializeOptions);
initializeOptions();

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
  if (isCreatingOffscreenDocument) return;

  isCreatingOffscreenDocument = true;

  if (!isRecognitionGloballyActive || (await hasOffscreenDocument())) {
    return;
  }

  try {
    console.log("Starting offscreen document...");
    await chrome.offscreen.createDocument({
        url: 'ui/offscreen.html',
        reasons: ['USER_MEDIA'],
        justification: 'To process hand gestures from the webcam.',
    });
    chrome.runtime.sendMessage({ type: 'start-camera', target: 'offscreen' });
  } catch (error) {
    console.error("Error creating offscreen document:", error);
  } finally {
    isCreatingOffscreenDocument = false;
  }
}

async function hasOffscreenDocument() {
  const matchedClients = await clients.matchAll();
  return matchedClients.some(client => client.url.endsWith(offscreenDocumentPath));
}

async function closeOffscreenDocument() {
  if (isClosingOffscreenDocument) return;

  try {
    isClosingOffscreenDocument = true;

    if (await chrome.offscreen.hasDocument()) {
      console.log("Closing offscreen document...");
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Error closing offscreen document:", error);
  } finally {
    isClosingOffscreenDocument = false;
  }
}

async function processFrame(frameData) {
  if (!handposeModel || !gestureModel) {
    console.log("Models not ready.");
    return;
  }

  try {
    const pixelData = new Uint8ClampedArray(Object.values(frameData.data));
    const imageData = new ImageData(pixelData, frameData.width, frameData.height);

    const predictions = await getFilteredHands(handposeModel, imageData);
    if (predictions.length > 0) {
      const landmarks = predictions[0].landmarks;
      let gesture = await detectGesture(landmarks, gestureModel, tf);

      if (gesture === 'Point' || gesture === 'Thumb Point') {
        const pointingDirection = getPointingDirection(landmarks, gesture, currentOptions.mirrorEnabled);
        gesture += ` (${pointingDirection})`;
      }
      updateStableGesture(gesture);

      if (optionsPort) {
        console.log("Sending gesture data to options page:", gesture);
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
  } catch (error) {
    console.error("Error processing frame:", error);
  }
}

async function toggleRecognition(isActive) {
  isRecognitionGloballyActive = isActive;

  if (isActive) {
    await setupModels();
  }

  await manageCameraSource();
}

async function manageCameraSource() {
  let desiredSource = 'none';
  if (isRecognitionGloballyActive) {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (optionsTabId && activeTab && activeTab.id === optionsTabId) {
      desiredSource = 'options';
    } else {
      desiredSource = 'offscreen';
    }
  }

  if (desiredSource === activeCameraSource) {
    return;
  }

  console.log(`Switching camera source from '${activeCameraSource}' to '${desiredSource}'`);

  if (activeCameraSource === 'options' && optionsPort) {
    optionsPort.postMessage({ type: 'stop-camera' });
  } else if (activeCameraSource === 'offscreen') {
    await closeOffscreenDocument();
  }

  if (desiredSource === 'options' && optionsPort) {
    optionsPort.postMessage({ type: 'start-camera' });
  } else if (desiredSource === 'offscreen') {
    await startOffscreenDocument();
  }

  activeCameraSource = desiredSource;
}

chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name === "options-page") {
    optionsPort = port;
    optionsTabId = port.sender.tab.id;
    console.log("Options page connected with tabId:", optionsTabId);

    await manageCameraSource(); // Initial check when page connects

    port.onDisconnect.addListener(async () => {
      console.log("Options page disconnected.");
      if (activeCameraSource === 'options') {
        activeCameraSource = 'none';
      }
      optionsPort = null;
      optionsTabId = null;
      await manageCameraSource(); // Switch back to offscreen if needed
    });
  }
});

chrome.tabs.onActivated.addListener(manageCameraSource);
chrome.windows.onFocusChanged.addListener(manageCameraSource);

chrome.runtime.onMessage.addListener(async (message) => {
  switch (message.type) {
    case 'videoFrame':
      await processFrame(message.frame);
      break;
    case 'toggle-recognition':
      await toggleRecognition(message.isActive);
      break;
  }
});