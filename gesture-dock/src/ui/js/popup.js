const cameraToggle = document.getElementById('recognition-toggle');
const mirrorToggle = document.getElementById('mirror-toggle');
const openDashboardBtn = document.getElementById('open-dashboard-btn');

chrome.storage.local.get('recognitionActive', (data) => {
  cameraToggle.checked = !!data.recognitionActive;
});

chrome.storage.sync.get('mirrorEnabled', (data) => {
  mirrorToggle.checked = !!data.mirrorEnabled;
});

chrome.runtime.sendMessage({ type: 'getCameraStatus' }, (response) => {
  if (chrome.runtime.lastError) {
    return;
  }

  if (response && response.isCameraActive != cameraToggle.checked) {
    chrome.runtime.sendMessage({ 'type': 'toggle-recognition', 'isActive': cameraToggle.checked });
  }
});

openDashboardBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

cameraToggle.addEventListener('change', () => {
  const isActive = cameraToggle.checked;

  chrome.storage.local.set({ recognitionActive: isActive });

  chrome.runtime.sendMessage({ type: 'toggle-recognition', isActive });
});

mirrorToggle.addEventListener('change', () => {
  const isActive = mirrorToggle.checked;

  chrome.storage.sync.set({ mirrorEnabled: isActive });
});