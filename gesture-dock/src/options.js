import { GESTURES, ACTIONS, DEFAULT_ACTION_MAP } from './actionMap.js';

let actionMap = {};

function createMappingPill(gesture, action) {
  const pill = document.createElement('div');
  pill.className = 'mapping-pill';

  const gsel = document.createElement('select');
  GESTURES.forEach(g => {
    const o = document.createElement('option');
    o.value = g; o.textContent = g;
    if (g === gesture) o.selected = true;
    gsel.append(o);
  });
  pill.append(gsel);

  const arrow = document.createElement('span');
  arrow.textContent = '→';
  pill.append(arrow);

  const asel = document.createElement('select');
  ACTIONS.forEach(a => {
    const o = document.createElement('option');
    o.value = a.id; o.textContent = a.name;
    if (a.id === action) o.selected = true;
    asel.append(o);
  });
  pill.append(asel);

  const btn = document.createElement('button');
  btn.textContent = '✕';
  pill.append(btn);

  gsel.addEventListener('change', () => {
    delete actionMap[gesture];
    gesture = gsel.value;
    actionMap[gesture] = asel.value;
    updateActionMap();
  });
  asel.addEventListener('change', () => {
    actionMap[gesture] = asel.value;
    updateActionMap();
  });
  btn.addEventListener('click', () => {
    delete actionMap[gesture];
    pill.remove();
    updateActionMap();
  });

  return pill;
}

function handleActionMapUI() {
  const container = document.getElementById('action-map-container');
  container.innerHTML = '';

  Object.entries(actionMap).forEach(([gesture, action]) => {
    container.append(createMappingPill(gesture, action));
  });

  document.getElementById('add-mapping').onclick = () => {
    const used = new Set(Object.keys(actionMap));
    const free = GESTURES.find(g => !used.has(g)) || GESTURES[0];
    actionMap[free] = ACTIONS[0].id;
    updateActionMap();

    handleActionMapUI();
  };
}

async function updateActionMap() {
  await chrome.storage.sync.set({ actionMap });
}

async function initActionMap(defaultVal, extraActions) {
  const data = await chrome.storage.sync.get('actionMap');
  if (data['actionMap'] === undefined) {
    actionMap = defaultVal;
    chrome.storage.sync.set({ ['actionMap']: defaultVal });
  } else {
    actionMap = data['actionMap'];
  }
  console.log('Action map initialized:', actionMap);
  extraActions();
}

document.addEventListener('DOMContentLoaded', async () => {
  await initActionMap(DEFAULT_ACTION_MAP, handleActionMapUI);
});