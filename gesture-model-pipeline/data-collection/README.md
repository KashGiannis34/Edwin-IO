# Edwin IO Gesture Data Collection Tool

This directory contains a custom Chrome extension for collecting and labeling hand gesture data, used to train the Edwin IO gesture recognition model.

## How It Works

- **Webcam Capture:** The extension uses your webcam to detect hand poses in real time using TensorFlow.js.
- **Keypoint Normalization:** Detected hand keypoints are normalized for consistent gesture recognition.
- **Interactive Labeling:** Assign gesture labels by pressing keyboard shortcuts. The extension supports rapid switching between gesture classes and provides real-time feedback on sample counts.
- **Data Export:** Download collected samples as JSON files for use in model training and evaluation.

## Usage

1. Load this folder as an unpacked extension in Chrome (`chrome://extensions`).
2. Open the extension's dashboard to start capturing and labeling gesture data.
3. Export your labeled data for use in the model training pipeline.

The collected data is essential for building and evaluating the Edwin IO custom gesture model.

For more details on the model and evaluation, see the [Edwin IO README](../../README.md).

## Project Structure

```
data-collection/
├── src/
│   ├── background.js         # Background script for the extension
│   ├── gestureUtils.js       # Keypoint normalization and gesture utilities
│   ├── model/                # Model files for hand pose detection
│   │   ├── model.json
│   │   ├── weights.bin
│   │   └── label_mapping.json
│   ├── options.css           # Styles for the extension dashboard
│   ├── options.html          # Dashboard UI for data collection
│   └── options.js            # Main logic for webcam capture and labeling
├── manifest.json             # Chrome extension manifest
├── package.json              # Node.js dependencies for development
├── .parcelrc                 # Parcel bundler config
└── README.md                 # This file
```

- `src/`: Source code for the data collection extension.
  - `options.js`, `options.html`, `options.css`: Dashboard for capturing and labeling gesture data.
  - `gestureUtils.js`: Normalization and gesture utility functions.
  - `model/`: Model files for hand pose detection.
- `manifest.json`: Chrome extension configuration.
- `package.json`: Project dependencies and contains Parcel build script.
- `.parcelrc`: Parcel config file.