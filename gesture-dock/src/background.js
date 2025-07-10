const ACTION_HANDLERS = {
  newTab: async () => {
    await chrome.tabs.create({});
  },
  closeTab: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await chrome.tabs.remove(tab.id);
  },
  reloadPage: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await chrome.tabs.reload(tab.id);
  },
  goBack: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => history.back()
      });
    }
  },
  goForward: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => history.forward()
      });
    }
  },
  nextTab: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const idx = tabs.findIndex(t => t.active);
    const next = tabs[(idx + 1) % tabs.length];
    await chrome.tabs.update(next.id, { active: true });
  },
  previousTab: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const idx = tabs.findIndex(t => t.active);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    await chrome.tabs.update(prev.id, { active: true });
  },
  reopenTab: async () => {
    await chrome.sessions.restore();
  },
  toggleMute: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
    }
  },
  zoomIn: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const current = await chrome.tabs.getZoom(tab.id);
      await chrome.tabs.setZoom(tab.id, current + 0.1);
    }
  },
  zoomOut: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      const current = await chrome.tabs.getZoom(tab.id);
      await chrome.tabs.setZoom(tab.id, current - 0.1);
    }
  },
  resetZoom: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.tabs.setZoom(tab.id, 1);
    }
  },
  openDownloads: async () => {
    await chrome.tabs.create({ url: "chrome://downloads" });
  },
  openHistory: async () => {
    await chrome.tabs.create({ url: "chrome://history" });
  },
  openBookmarks: async () => {
    await chrome.tabs.create({ url: "chrome://bookmarks" });
  },
  scrollUp: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy(0, -window.innerHeight * 0.9)
      });
    }
  },
  scrollDown: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollBy(0, window.innerHeight * 0.9)
      });
    }
  },
  scrollTop: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, 0)
      });
    }
  },
  scrollBottom: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => window.scrollTo(0, document.body.scrollHeight)
      });
    }
  },
  openOptions: async () => {
    await chrome.runtime.openOptionsPage();
  },
  openDevTools: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.debugger.attach({ tabId: tab.id }, "1.3", () => {
        chrome.debugger.sendCommand({ tabId: tab.id }, "Inspector.enable");
      });
    }
  }
};

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.type !== "performAction") return;
  const handler = ACTION_HANDLERS[message.actionId];
  if (!handler) return;
  // Pass sender.tab in case the handler needs it (e.g. for devtools):
  handler({ tab: sender.tab }).catch(console.error);
});