export const gestureDatabase = {
  "Open Hand": [
    0,
    0,
    0.16918850777734643,
    0.13426800449964346,
    0.3679592929618111,
    0.21753868339937013,
    0.5358790763021243,
    0.26163552666072065,
    0.662152052021387,
    0.30473727583828275,
    0.5473039117974609,
    4.996144954757677e-17,
    0.74825132503041,
    -0.048037952885489975,
    0.8775305989145872,
    -0.0887096566308454,
    0.9857947989582443,
    -0.12746793961879935,
    0.5120798024014958,
    -0.12753281259655405,
    0.7361289919240995,
    -0.19524999677640822,
    0.8833857489644744,
    -0.25089059180077117,
    1,
    -0.296957789371262,
    0.4459086900212617,
    -0.23205033763485491,
    0.6348941505460928,
    -0.3136460845723891,
    0.764516310159082,
    -0.37496730677218715,
    0.8719863354675064,
    -0.42217976002207414,
    0.34886762331803606,
    -0.318410420732362,
    0.4697816814055912,
    -0.43133639242974026,
    0.5477280110454492,
    -0.5090584297391035,
    0.6307217215138118,
    -0.5755910464276183
  ],
  "Fist": [
    0,
    0,
    0.29209677491978986,
    0.2523375511527461,
    0.6549858214059782,
    0.2872932852895472,
    0.9053861869811998,
    0.035770537738414876,
    0.790689931333884,
    -0.2145529797966576,
    0.8016557885361989,
    4.869632430560089e-17,
    1,
    0.00031139439979168917,
    0.7201690063149524,
    0.12278923396253492,
    0.62685781017117,
    0.10929733126576893,
    0.7434829219771159,
    -0.15613627334121175,
    0.9392042793542422,
    -0.13764309845887376,
    0.6621190076062271,
    0.011829757558692625,
    0.6077586745967892,
    -0.03905352550451069,
    0.6506229057615623,
    -0.32277001629468677,
    0.8584360799261902,
    -0.30461952636959544,
    0.594122436037792,
    -0.1353496964679925,
    0.5043345440528764,
    -0.17829647555910816,
    0.5169322993086418,
    -0.49932023172757856,
    0.7187835488733882,
    -0.4389746909534052,
    0.546930710904688,
    -0.29249515330398823,
    0.4207975206209297,
    -0.3287564684851846
  ],
  "Point": [
    0,
    0,
    0.24321558991441955,
    -0.07926069769034019,
    0.45220394808778974,
    -0.02767282385958201,
    0.5993183412931852,
    0.08273779710278374,
    0.676525354215957,
    0.18780247650717896,
    0.5868836532850825,
    6.999803743657032e-17,
    0.8235349275009293,
    0.2525444977122448,
    0.9346458491727999,
    0.4288180984261496,
    1,
    0.5528384366765623,
    0.49063478438345914,
    0.13181102276064247,
    0.714450257198066,
    0.3375619548288821,
    0.7157471475835044,
    0.3435850905414475,
    0.6926396886793389,
    0.32687793969823226,
    0.37156519900186413,
    0.2632829131622259,
    0.5745942230485912,
    0.40755575493545126,
    0.5232549247117881,
    0.3440449100117324,
    0.45213302204773337,
    0.2871003459311427,
    0.2496546048509765,
    0.38982009427422626,
    0.4340262403966127,
    0.45933051660692326,
    0.3984075208619285,
    0.3902376845531742,
    0.32626561050112696,
    0.33929370988266083
  ]
};

let lastGesture = null;
let stableGesture = null;
let lastGestureTime = 0;
const GESTURE_HOLD_TIME = 100; // milliseconds

export function updateStableGesture(gesture) {
  const now = Date.now();

  if (gesture !== lastGesture) {
    lastGesture = gesture;
    lastGestureTime = now;
  } else if (now - lastGestureTime >= GESTURE_HOLD_TIME && gesture !== stableGesture) {
    stableGesture = gesture;
  }
}

export function getStableGesture() {
  return stableGesture;
}

function isLandmarkSpreadTooSmall(landmarks, minSpread = 50) {
  const xs = landmarks.map(p => p[0]);
  const ys = landmarks.map(p => p[1]);
  const spreadX = Math.max(...xs) - Math.min(...xs);
  const spreadY = Math.max(...ys) - Math.min(...ys);
  console.log(`Spread X: ${spreadX}, Spread Y: ${spreadY}, Min Spread: ${minSpread}`);
  return Math.max(spreadX, spreadY) < minSpread;
}

export async function getFilteredHands(model, video, minSpread = 50) {
  const predictions = await model.estimateHands(video);
  return predictions.filter(pred => !isLandmarkSpreadTooSmall(pred.landmarks, minSpread));
}

export function normalizeLandmarks(landmarks) {
  if (!landmarks || landmarks.length !== 21) return [];

  // Step 1: Translate so wrist (point 0) is at origin
  const [x0, y0] = landmarks[0];
  const translated = landmarks.map(([x, y]) => [x - x0, y - y0]);

  // Step 2: Rotate so that index MCP (point 5) lies horizontally
  const [ix, iy] = translated[5];
  const angle = Math.atan2(iy, ix); // Angle to x-axis

  const cosA = Math.cos(-angle);
  const sinA = Math.sin(-angle);
  const rotated = translated.map(([x, y]) => [
    x * cosA - y * sinA,
    x * sinA + y * cosA
  ]);

  // Step 3: Normalize scale (optional but improves generalization)
  const flat = rotated.flat();
  const maxAbs = Math.max(...flat.map(Math.abs)) || 1;
  const normalized = flat.map(val => val / maxAbs);

  return normalized;
}

export function euclideanDistance(v1, v2) {
  return Math.sqrt(v1.reduce((sum, val, i) => sum + (val - v2[i]) ** 2, 0));
}

export function classifyGesture(normalizedLandmarkVec, threshold = 2.0) {
  let bestMatch = null;
  let minDist = Infinity;

  for (const [name, refVec] of Object.entries(gestureDatabase)) {
    const dist = euclideanDistance(normalizedLandmarkVec, refVec);
    if (dist < minDist) {
      minDist = dist;
      bestMatch = name;
    }
  }

  return minDist < threshold ? bestMatch : null;
}

export function detectGesture(landmarks) {
  const normalized = normalizeLandmarks(landmarks);
  console.log('Normalized:', normalized);
  return classifyGesture(normalized);
}
