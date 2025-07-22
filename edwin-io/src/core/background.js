import * as tf from '@tensorflow/tfjs';
import { updateStableGesture, detectGesture, getPointingDirection, getStableGesture, addTabListeners } from './gestureUtils.js';

let gestureModel = null;
let optionsPort = null;
let optionsTabId = null;
const offscreenDocumentPath = 'ui/offscreen.html';
let isRecognitionGloballyActive = false;
let currentOptions = {};
let activeCameraSource = 'none';
let isCreatingOffscreenDocument = false;
let isClosingOffscreenDocument = false;

async function updateOptions() {
  const data = await chrome.storage.sync.get(['mirrorEnabled', 'actionMap']);
  currentOptions.mirrorEnabled = data.mirrorEnabled ?? false;
  currentOptions.actionMap = data.actionMap;
}

async function setupModels() {
  if (gestureModel) return;
  await tf.setBackend('webgl');
  await tf.ready();
  gestureModel = await tf.loadLayersModel(chrome.runtime.getURL('core/model/model.json'));
}

async function startOffscreenDocument() {
  if (isCreatingOffscreenDocument) return;

  isCreatingOffscreenDocument = true;

  if (!isRecognitionGloballyActive || (await hasOffscreenDocument())) {
    return;
  }

  try {
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
      await chrome.offscreen.closeDocument();
    }
  } catch (error) {
    console.error("Error closing offscreen document:", error);
  } finally {
    isClosingOffscreenDocument = false;
  }
}

async function processKeypoints(keypoints) {
  if (!gestureModel) {
    return;
  }
  try {
    let gesture = await detectGesture(keypoints, gestureModel, tf);
    if (gesture === 'Point' || gesture === 'Thumb Point') {
      const pointingDirection = getPointingDirection(keypoints, gesture, currentOptions.mirrorEnabled);
      gesture += ` (${pointingDirection})`;
    }
    updateStableGesture(gesture);

    if (optionsPort) {
      optionsPort.postMessage({
        type: "gesture-data",
        data: { gesture: getStableGesture(), keypoints }
      });
    }
  } catch (error) {
    console.error("Error processing keypoints:", error);
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

    await manageCameraSource(); // Initial check when page connects

    port.onDisconnect.addListener(async () => {
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

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  switch (message.type) {
    case 'keypoints':
      if (message.keypoints) {
        await processKeypoints(message.keypoints);
      } else if (optionsPort) {
        updateStableGesture('None');
        optionsPort.postMessage({
          type: "gesture-data",
          data: { gesture: 'None', keypoints: null }
        });
      }
      break;
    case 'toggle-recognition':
      sendResponse({ status: "acknowledged" });
      await toggleRecognition(message.isActive);
      break;
    case 'getCameraStatus':
      const isActive = activeCameraSource !== 'none';
      sendResponse({ isCameraActive: isActive });
      return true;
  }
});

chrome.runtime.onStartup.addListener(async () => {
  await chrome.storage.local.set({ recognitionActive: false });
});

chrome.storage.onChanged.addListener(updateOptions);
updateOptions();
addTabListeners();