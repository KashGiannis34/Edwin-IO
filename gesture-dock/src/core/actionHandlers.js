export const ACTION_HANDLERS = {
  // --- Simple Actions (No custom value needed) ---
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
        func: () => history.back(),
      });
    }
  },
  goForward: async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => history.forward(),
      });
    }
  },
  nextTab: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.active);
    const next = tabs[(idx + 1) % tabs.length];
    await chrome.tabs.update(next.id, { active: true });
  },
  previousTab: async () => {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    if (tabs.length <= 1) return;
    const idx = tabs.findIndex(t => t.active);
    const prev = tabs[(idx - 1 + tabs.length) % tabs.length];
    await chrome.tabs.update(prev.id, { active: true });
  },
  openDashboard: async () => {
    await chrome.runtime.openOptionsPage();
  },

  // --- Custom Actions (Accept a 'value' parameter) ---

  /**
   * Opens a new tab with the specified URL.
   * @param {string} value The URL to open.
   */
  openPage: async (value) => {
    if (value && typeof value === 'string') {
      await chrome.tabs.create({ url: value });
    }
  },

  /**
   * Scrolls the page by a percentage of the window height.
   * @param {string} value A number as a string (e.g., "90" for down, "-90" for up).
   */
  scrollBy: async (value) => {
    const percent = parseInt(value, 10);
    if (isNaN(percent)) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (p) => window.scrollBy(0, window.innerHeight * (p / 100)),
        args: [percent],
      });
    }
  },

  /**
   * Sets the page zoom to a specific percentage.
   * @param {string} value A number as a string (e.g., "125" for 125%).
   */
  setZoom: async (value) => {
    const percent = parseInt(value, 10);
    if (isNaN(percent) || percent < 25 || percent > 500) return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) await chrome.tabs.setZoom(tab.id, percent / 100);
  },

  /**
   * Finds an open tab by title or URL and switches to it.
   * @param {string} value The text to search for.
   */
  findTab: async (value) => {
    if (!value || typeof value !== 'string') return;

    const allTabs = await chrome.tabs.query({ currentWindow: true });
    const foundTab = allTabs.find(t =>
      t.title.toLowerCase().includes(value.toLowerCase()) ||
      t.url.toLowerCase().includes(value.toLowerCase())
    );

    if (foundTab) {
      await chrome.tabs.update(foundTab.id, { active: true });
    }
  },

  /**
   * Executes a snippet of JavaScript on the page.
   * @param {string} value The JavaScript code to execute.
   */
  execScript: async (value) => {
    if (!value || typeof value !== 'string') return;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (code) => {
          try {
            new Function(code)();
          } catch (e) {
            console.error("Error executing custom script:", e);
          }
        },
        args: [value],
      });
    }
  },
};