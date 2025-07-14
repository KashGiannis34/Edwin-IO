export const GESTURES = [
  "Open Hand",
  "Fist",
  "Two",
  "Three",
  "Four",
  "Point (up)",
  "Point (down)",
  "Point (left)",
  "Point (right)",
  "Thumb Point (up)",
  "Thumb Point (down)",
  "Thumb Point (left)",
  "Thumb Point (right)",
  "Surfer"
];

export const ACTIONS = [
  { id: "newTab",         name: "Open New Tab" },
  { id: "closeTab",       name: "Close Current Tab" },
  { id: "reloadPage",     name: "Reload Page" },
  { id: "goBack",         name: "Go Back" },
  { id: "goForward",      name: "Go Forward" },
  { id: "nextTab",        name: "Switch to Next Tab" },
  { id: "previousTab",    name: "Switch to Previous Tab" },
  { id: "reopenTab",      name: "Reopen Last Closed Tab" },
  { id: "toggleMute",     name: "Toggle Mute/Unmute Tab" },
  { id: "zoomIn",         name: "Zoom In" },
  { id: "zoomOut",        name: "Zoom Out" },
  { id: "resetZoom",      name: "Reset Zoom Level" },
  { id: "openDownloads",  name: "Open Downloads" },
  { id: "openHistory",    name: "Open History" },
  { id: "openBookmarks",  name: "Open Bookmarks" },
  { id: "scrollUp",       name: "Scroll Up" },
  { id: "scrollDown",     name: "Scroll Down" },
  { id: "scrollTop",      name: "Scroll to Top" },
  { id: "scrollBottom",   name: "Scroll to Bottom" },
  { id: "openOptions",    name: "Open Extension Options" },
  { id: "openDevTools",   name: "Open Developer Tools" }
];

export const DEFAULT_ACTION_MAP = {
  "Point (left)":    "previousTab",
  "Point (right)":   "nextTab",
  "Two":             "newTab",
  "Three":           "closeTab",
  "Four":            "reloadPage",
  "Open Hand":       "openOptions"
};