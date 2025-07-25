const tf = require('@tensorflow/tfjs-node');
const fs = require('fs');

const MODEL_PATH = 'file://./gesture_model_tfjs/model.json';
const LABEL_MAPPING_PATH = './gesture_model_tfjs/label_mapping.json';
const TEST_DATA_PATH = './final_eval_data.json';
const OUTPUT_CSV_PATH = './evaluation_results.csv';

async function createProbExport() {
  console.log(`Loading pre-trained model from: ${MODEL_PATH}`);
  const model = await tf.loadLayersModel(MODEL_PATH);

  model.compile({
    optimizer: 'adam',
    loss: 'categoricalCrossentropy',
    metrics: ['accuracy']
  });

  console.log(`Loading test data from: ${TEST_DATA_PATH}`);
  const testData = JSON.parse(fs.readFileSync(TEST_DATA_PATH));

  console.log(`Loading label mapping from: ${LABEL_MAPPING_PATH}`);
  const indexToLabel = JSON.parse(fs.readFileSync(LABEL_MAPPING_PATH));
  const labels = Object.values(indexToLabel);

  console.log('Preparing test data tensors...');
  const xTest = tf.tensor2d(testData.map(d => d.vector));
  const trueLabels = testData.map(d => d.label);

  console.log('Generating model predictions...');
  const predictionsTensor = model.predict(xTest);
  const probabilities = await predictionsTensor.array(); // Get probabilities as a 2D array

  console.log(`Formatting results for CSV output...`);

  // Create the header row for the CSV file
  const header = ['TrueLabel', ...labels.map(l => `Prob_${l}`)].join(',');

  // Create each data row
  const rows = trueLabels.map((trueLabel, i) => {
    const probabilityRow = probabilities[i].map(p => p.toFixed(6)); // Get probabilities for this sample
    return [trueLabel, ...probabilityRow].join(',');
  });

  // Combine header and rows
  const csvContent = [header, ...rows].join('\n');

  fs.writeFileSync(OUTPUT_CSV_PATH, csvContent);

  console.log(`Success! Evaluation results saved to: ${OUTPUT_CSV_PATH}`);
}

createProbExport().catch(console.error);