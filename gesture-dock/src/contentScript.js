// contentScript.js
import * as tf from '@tensorflow/tfjs';
import * as handpose from '@tensorflow-models/handpose';
import {
  getFilteredHands,
  updateStableGesture,
  detectGesture,
  getStableGesture,
  getPointingDirection
} from './gestureUtils.js';
import { triggerAction } from './actionMap.js';

const ui = document.createElement('div');
ui.innerHTML = `
  <style>
    #gdock {position:fixed; bottom:10px; right:10px;
      width:340px; padding:8px; background:rgba(0,0,0,0.6);
      color:#fff; font:12px sans-serif; border-radius:6px;
      z-index:999999;}
    #gdock input {vertical-align:middle;}
    #gdock .video-wrapper {margin-top:8px;
      width:320px; height:240px; overflow:hidden;
      border:1px solid #4cd964; border-radius:4px;}
    #gdock .video-wrapper.mirror {transform:scaleX(-1);}
    #gdock canvas {width:320px; height:240px;}
  </style>
  <div id="gdock">
    <label><input type="checkbox" id="gdock-enable"/> Enable Camera</label>
    <label style="margin-left:12px;">
      <input type="checkbox" id="gdock-mirror"/> Mirror
    </label>
    <div class="video-wrapper hidden" id="gdock-wrap">
      <video id="gdock-video" autoplay playsinline style="display:none"></video>
      <canvas id="gdock-canvas"></canvas>
    </div>
  </div>
`;
document.body.appendChild(ui);

const enableToggle = ui.querySelector('#gdock-enable');
const mirrorToggle = ui.querySelector('#gdock-mirror');
const wrap        = ui.querySelector('#gdock-wrap');
const video       = ui.querySelector('#gdock-video');
const canvas      = ui.querySelector('#gdock-canvas');
const ctx         = canvas.getContext('2d');

let model, gestureModel, rafId, tracks = [], isRunning = false;

async function start() {
  if (isRunning) return;
  isRunning = true;
  wrap.classList.remove('hidden');

  await tf.setBackend('webgl'); await tf.ready();
  model = await handpose.load();
  gestureModel = await tf.loadLayersModel(chrome.runtime.getURL('model/model.json'));

  const stream = await navigator.mediaDevices.getUserMedia({ video:true });
  video.srcObject = stream;
  tracks = stream.getTracks();
  await new Promise(r=> video.onloadedmetadata = r);
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  video.play();

  loop();
}

function stop() {
  if (!isRunning) return;
  isRunning = false;
  wrap.classList.add('hidden');
  cancelAnimationFrame(rafId);
  tracks.forEach(t=>t.stop());
  ctx.clearRect(0,0,canvas.width,canvas.height);
}

async function loop() {
  ctx.drawImage(video,0,0,canvas.width,canvas.height);
  const preds = await getFilteredHands(model, video);
  if (preds.length) {
    const lm = preds[0].landmarks;
    lm.forEach(([x,y])=>{
      ctx.beginPath(); ctx.arc(x,y,4,0,2*Math.PI);
      ctx.fillStyle='lime'; ctx.fill();
    });
    let g = await detectGesture(lm, gestureModel, tf);
    if (g==='Point' || g==='Thumb Point') {
      const dir = getPointingDirection(lm, g, mirrorToggle.checked);
      g += ` (${dir})`;
    }
    updateStableGesture(g);
    const sg = getStableGesture();
    if (sg) triggerAction(sg);
  }
  rafId = requestAnimationFrame(loop);
}

enableToggle.addEventListener('change', e=>{
  e.target.checked ? start() : stop();
});
mirrorToggle.addEventListener('change', ()=>{
  wrap.classList.toggle('mirror', mirrorToggle.checked);
});
