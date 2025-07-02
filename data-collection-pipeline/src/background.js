import { gestureMap } from './gestureMap.js';

chrome.runtime.onMessage.addListener((msg, sender) => {
  const gesture = msg.gesture;
  const action = gestureMap[gesture];
  if (action) action();
});