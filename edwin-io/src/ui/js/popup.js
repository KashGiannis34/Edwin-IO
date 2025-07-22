const cameraToggle = document.getElementById('recognition-toggle');
const mirrorToggle = document.getElementById('mirror-toggle');
const openDashboardBtn = document.getElementById('open-dashboard-btn');

chrome.storage.local.get('recognitionActive', (data) => {
  cameraToggle.checked = !!data.recognitionActive;
});

chrome.storage.sync.get('mirrorEnabled', (data) => {
  mirrorToggle.checked = !!data.mirrorEnabled;
});

chrome.runtime.sendMessage({ type: 'getCameraStatus' }, async (response) => {
  if (chrome.runtime.lastError) {
    return;
  }

  if (response && response.isCameraActive != cameraToggle.checked) {
    await handleCameraPermission(cameraToggle.checked);
  }
});

openDashboardBtn.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

cameraToggle.addEventListener('change', async () => {
  const isActive = cameraToggle.checked;

  chrome.storage.local.set({ recognitionActive: isActive });

  await handleCameraPermission(isActive);
});

mirrorToggle.addEventListener('change', () => {
  const isActive = mirrorToggle.checked;

  chrome.storage.sync.set({ mirrorEnabled: isActive });
});

async function handleCameraPermission(isActive) {
  if (isActive) {
    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' });

      if (permissionStatus.state !== 'granted') {
        const permissionsUrl = chrome.runtime.getURL('ui/permissions.html');
        chrome.tabs.create({ url: permissionsUrl });
        return;
      }
    } catch (err) {
      console.error("Could not check camera permission:", err);
      chrome.tabs.create({ url: 'permissions.html' });
      return;
    }
  }

  chrome.runtime.sendMessage({ type: 'toggle-recognition', isActive });
}