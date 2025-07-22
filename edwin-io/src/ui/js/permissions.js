(async () => {
  try {
    // Request permission. This will show the prompt.
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });

    stream.getTracks().forEach(track => track.stop());

    chrome.runtime.sendMessage({ type: 'toggle-recognition', isActive: true }, (response) => {
        window.close();
    });

  } catch (err) {
    // The user denied permission
    if (err.name === "NotAllowedError") {
      document.querySelector('h1').innerText = "Permission Denied";
      document.querySelector('p').innerText = "Camera access was not granted. You can change this in the browser's site settings. This tab will close shortly.";
    }
    // Automatically close the tab after a few seconds
    setTimeout(() => window.close(), 4000);
  }
})();