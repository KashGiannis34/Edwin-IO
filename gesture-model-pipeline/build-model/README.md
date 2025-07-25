# Edwin IO Gesture Model - Build and Evaluation

This directory contains scripts and resources for training, evaluating, and analyzing the custom gesture classification model used by Edwin IO.

## Contents

- **train.js**: Script for training the gesture classification neural network using TensorFlow.js (Node.js).
- **eval.js**: Script for evaluating the trained model on a test set and generating evaluation metrics.
- **merge_gesture_samples.py**: Python script to merge multiple gesture sample JSON files into a single dataset for training.
- **combined_gesture_samples.json** / **final_eval_data.json**: Large JSON files containing the training and test data.
- **gesture_model_tfjs/**: Contains the exported TensorFlow.js model files (model.json, weights.bin, label_mapping.json) for use in the Chrome extension.
- **model_analysis/**: Contains scripts and outputs for model evaluation, including:
  - `analysis.py`: Generates classification reports and plots (confusion matrix, ROC curves, etc.).
  - `evaluation_results.csv`: Model predictions and ground truth labels.
  - `evaluation_plots/`: Visualizations and summary reports.

## Usage

- Run training and evaluation scripts with Node.js:
  ```
  node train.js
  node eval.js
  ```
- Use Python for data merging and analysis:
  ```
  python merge_gesture_samples.py
  python model_analysis/analysis.py
  ```

For more details on the model and evaluation, see the [Edwin IO README](../../README.md) and the [technical report PDF](../../Edwin_IO_Custom_Gesture_Model_Report.pdf).