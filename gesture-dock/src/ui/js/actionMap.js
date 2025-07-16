export const GESTURES = [
  "Open Hand",
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
  // --- Simple Actions ---
  { id: "newTab",         name: "Open New Tab" },
  { id: "closeTab",       name: "Close Current Tab" },
  { id: "reloadPage",     name: "Reload Page" },
  { id: "goBack",         name: "Go Back" },
  { id: "goForward",      name: "Go Forward" },
  { id: "nextTab",        name: "Switch to Next Tab" },
  { id: "previousTab",    name: "Switch to Previous Tab" },
  { id: "openDashboard",  name: "Open Extension Dashboard" },

  // --- Custom Actions with Predefined Values ---
  {
    id: "openPage",
    name: "Open Page...",
    hasValue: true,
    customValueLabel: "Custom URL...",
    predefinedValues: [
      { name: "Downloads", value: "chrome://downloads" },
      { name: "History", value: "chrome://history" },
      { name: "Bookmarks", value: "chrome://bookmarks" },
      { name: "Extensions", value: "chrome://extensions" },
      { name: "YouTube", value: "https://youtube.com" }
    ]
  },
  {
    id: "scrollBy",
    name: "Scroll by %...",
    hasValue: true,
    customValueLabel: "Custom %...",
    predefinedValues: [
        { name: "Page Down", value: "90" },
        { name: "Page Up", value: "-90" },
        { name: "Half Page Down", value: "50" },
        { name: "Half Page Up", value: "-50" }
    ]
  },
  {
    id: "setZoom",
    name: "Set Zoom to %...",
    hasValue: true,
    customValueLabel: "Custom %...",
    predefinedValues: [
        { name: "Zoom In (125%)", value: "125" },
        { name: "Zoom Out (75%)", value: "75" },
        { name: "Reset Zoom (100%)", value: "100" }
    ]
  },

  // --- Custom Actions with Text Input Only ---
  { id: "findTab",        name: "Switch to Tab...",      hasValue: true, placeholder: "e.g., YouTube" },
  { id: "execScript",     name: "Execute Script...",     hasValue: true, placeholder: "alert('hello')" },
];

export const DEFAULT_ACTION_MAP = {
  "Point (left)":  { id: "previousTab", value: null },
  "Point (right)": { id: "nextTab", value: null },
  "Two":           { id: "openTab", value: null },
  "Three":         { id: "closeTab", value: null },
  "Four":          { id: "reloadPage", value: null },
  "Open Hand":     { id: "openDashboard", value: null }
};