export const ACTION_HANDLERS = {
  reloadPage: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await chrome.tabs.reload(tab.id);
  },
  openDashboard: async () => {
    await chrome.runtime.openOptionsPage();
  },
  openPage: async (value) => {
    if (value && typeof value === 'string') {
      await chrome.tabs.create({ url: value });
    }
  },
  scrollBy: async (value) => {
    const percent = parseInt(value, 10);
    if (isNaN(percent)) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith('chrome')) return; // Check for protected URLs

    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (p) => window.scrollBy(0, document.body.scrollHeight * (p / 100)),
        args: [percent],
      });
    }
  },
  muteControl: async (value) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    switch (value) {
      case 'toggle':
        // Toggle the current muted state
        await chrome.tabs.update(tab.id, { muted: !tab.mutedInfo?.muted });
        break;
      case 'mute':
        // Force the tab to be muted
        await chrome.tabs.update(tab.id, { muted: true });
        break;
      case 'unmute':
        // Force the tab to be unmuted
        await chrome.tabs.update(tab.id, { muted: false });
        break;
    }
  },
  moveTab: async (value) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    let newIndex = -1; // Default to moving to the end

    switch (value) {
      case 'start':
        newIndex = 0;
        break;
      case 'end':
        newIndex = -1; // -1 signifies the end of the list
        break;
      case 'left':
        newIndex = tab.index - 1;
        break;
      case 'right':
        newIndex = tab.index + 1;
        break;
      default:
        // Handle custom numeric position
        const customIndex = parseInt(value, 10);
        if (!isNaN(customIndex)) {
          newIndex = customIndex - 1; // Convert 1-based to 0-based index
        }
        break;
    }

    if (newIndex >= 0 || newIndex === -1) {
      await chrome.tabs.move(tab.id, { index: newIndex });
    }
  },
  manageTab: async (value) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    switch (value) {
      case 'new':
        await chrome.tabs.create({});
        break;
      case 'close':
        if (tab) await chrome.tabs.remove(tab.id);
        break;
      case 'duplicate':
        if (tab) await chrome.tabs.duplicate(tab.id);
        break;
      case 'pin':
        if (tab) await chrome.tabs.update(tab.id, { pinned: !tab.pinned });
        break;
    }
  },
  switchTab: async (value) => {
    if (value === 'next' || value === 'previous') {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      if (tabs.length <= 1) return;
      const idx = tabs.findIndex(t => t.active);
      const newIndex = (value === 'next')
        ? (idx + 1) % tabs.length
        : (idx - 1 + tabs.length) % tabs.length;
      await chrome.tabs.update(tabs[newIndex].id, { active: true });
    } else if (value && typeof value === 'string') {
      // This is the "find by name" logic
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      const foundTab = allTabs.find(t =>
        t.title.toLowerCase().includes(value.toLowerCase()) ||
        t.url.toLowerCase().includes(value.toLowerCase())
      );
      if (foundTab) await chrome.tabs.update(foundTab.id, { active: true });
    }
  },
  navigateHistory: async (value) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith('chrome')) return;
    if (!tab) return;

    // Determine which function to inject into the page
    const funcToExecute = (value === 'back')
      ? () => history.back()
      : () => history.forward();

    // Execute the chosen function on the active tab
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: funcToExecute,
    });
  },
  controlZoom: async (value) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.startsWith('chrome://')) return;
    if (!tab) return;

    // Check if it's a relative change (+10, -20) or absolute set (150)
    if (value.startsWith('+') || value.startsWith('-')) {
      const percentChange = parseInt(value, 10);
      if (isNaN(percentChange)) return;
      const currentZoom = await chrome.tabs.getZoom(tab.id);
      await chrome.tabs.setZoom(tab.id, currentZoom + (percentChange / 100));
    } else {
      const percentSet = parseInt(value, 10);
      if (isNaN(percentSet)) return;
      await chrome.tabs.setZoom(tab.id, percentSet / 100);
    }
  },
};