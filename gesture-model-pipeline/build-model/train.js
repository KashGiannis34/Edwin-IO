const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');

// Load dataset
const data = JSON.parse(fs.readFileSync('combined_gesture_samples.json'));
const labels = [...new Set(data.map(d => d.label))];
const labelToIndex = Object.fromEntries(labels.map((label, i) => [label, i]));

// Convert to tensors
const xs = tf.tensor2d(data.map(d => d.vector));
const ys = tf.oneHot(data.map(d => labelToIndex[d.label]), labels.length);

// Define model
const model = tf.sequential();
model.add(tf.layers.dense({ inputShape: [42], units: 64, activation: 'relu' }));
model.add(tf.layers.dropout({ rate: 0.2 }));
model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
model.add(tf.layers.dropout({ rate: 0.2 }));
model.add(tf.layers.dense({ units: labels.length, activation: 'softmax' }));

model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });

// Train and save model
(async () => {
  await model.fit(xs, ys, {
    epochs: 30,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: tf.node.tensorBoard('./logs')
  });

  await model.save('file://./gesture_model_tfjs');

  fs.writeFileSync(
    './gesture_model_tfjs/label_mapping.json',
    JSON.stringify(Object.fromEntries(Object.entries(labelToIndex).map(([label, i]) => [i, label])), null, 2)
  );

  console.log('✅ Model and label mapping saved.');
})();
