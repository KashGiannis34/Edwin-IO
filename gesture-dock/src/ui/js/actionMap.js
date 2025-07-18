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
  { id: "reloadPage",     name: "Reload Page" },
  { id: "openDashboard",  name: "Open Extension Dashboard" },
  {
    id: "manageTab",
    name: "Manage Tab...",
    hasValue: true,
    predefinedValues: [
      { name: "New Tab", value: "new" },
      { name: "Close Current Tab", value: "close" },
      { name: "Duplicate Current Tab", value: "duplicate" },
      { name: "Toggle Pin", value: "pin" }
    ]
  },
  {
    id: "switchTab",
    name: "Switch Tab...",
    hasValue: true,
    customValueLabel: "By Title/URL...",
    predefinedValues: [
      { name: "Next Tab", value: "next" },
      { name: "Previous Tab", value: "previous" }
    ],
    placeholder: "e.g., YouTube"
  },
  {
    id: "navigateHistory",
    name: "Navigate History...",
    hasValue: true,
    predefinedValues: [
      { name: "Go Back", value: "back" },
      { name: "Go Forward", value: "forward" }
    ]
  },
  {
    id: "controlZoom",
    name: "Control Zoom...",
    hasValue: true,
    customValueLabel: "Set %/Change by %...",
    predefinedValues: [
      { name: "Zoom In (+10%)", value: "+10" },
      { name: "Zoom Out (-10%)", value: "-10" },
      { name: "Reset (100%)", value: "100" }
    ],
    placeholder: "e.g., 80 (set) or +20 (change)"
  },
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
    ],
    placeholder: "e.g., -10"
  },
  {
    id: "muteControl",
    name: "Mute/Unmute Tab...",
    hasValue: true,
    // No customValueLabel, so no "Custom..." option will appear
    predefinedValues: [
      { name: "Toggle Mute/Unmute", value: "toggle" },
      { name: "Force Mute", value: "mute" },
      { name: "Force Unmute", value: "unmute" }
    ]
  },
  {
    id: "moveTab",
    name: "Move Tab...",
    hasValue: true,
    customValueLabel: "To Position...",
    predefinedValues: [
        { name: "Move to Start", value: "start" },
        { name: "Move to End", value: "end" },
        { name: "Move One Left", value: "left" },
        { name: "Move One Right", value: "right" }
    ],
    placeholder: "e.g., 3"
  }
];

export const DEFAULT_ACTION_MAP = {
  "Point (left)":  { id: "switchTab", value: "previous" },
  "Point (right)": { id: "switchTab", value: "next" },
  "Two":           { id: "manageTab", value: "new" },
  "Three":         { id: "manageTab", value: "close" },
  "Four":          { id: "reloadPage", value: null },
  "Open Hand":     { id: "openDashboard", value: null }
};