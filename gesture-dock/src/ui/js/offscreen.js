const video = document.getElementById('webcam');
let canvas;
let ctx;

chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.target === 'offscreen') {
    if (msg.type === 'start-camera') {
      await startCamera();
    } else if (msg.type === 'get-video') {
      if (video.srcObject) {
        chrome.runtime.sendMessage({
          type: "video-stream-forward",
          stream: video.srcObject
        });
      }
    }
  }
  return true;
});

async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    await video.play();

    canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx = canvas.getContext('2d', { willReadFrequently: true });

    sendFrame();
  } catch (err) {
    console.error("Error starting camera in offscreen:", err);
  }
}

function sendFrame() {
  // Ensure the video stream is still active
  if (!video.srcObject?.active) return;

  ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
  const imageData = ctx.getImageData(0, 0, video.videoWidth, video.videoHeight);

  // Send the raw data, width, and height instead of the whole object
  chrome.runtime.sendMessage({
    type: 'videoFrame',
    frame: {
      data: imageData.data,
      width: imageData.width,
      height: imageData.height,
    }
  });

  // Use a timeout to control frame rate and reduce load
  setTimeout(sendFrame, 100); // Process roughly 10 frames per second
}