// How she feels about driving this time: a confidence from 0 (careful) to 1
// (confident). It reshapes her driving params for one go: careful is slower,
// shakier, smaller loops, more pauses and quicker to get scared; confident is
// quicker, smoother, bigger loops and keeps going for longer. Her confidence
// drifts with experience: a fright knocks it, a go she enjoyed builds it.
// Pure logic.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Multipliers on each param at confidence 0 and 1 (1 means unchanged).
 * At 0.5 most of them come out close to the base params.
 */
const SCALE = {
  driveSpeedMin: [0.7, 1.4],
  driveSpeedMax: [0.7, 1.4],
  driveScareSpeed: [0.85, 1.25],
  driveMaxThrottle: [0.8, 1.3],
  driveJerk: [1.4, 0.5],
  driveOverSteerRate: [1.3, 0.5],
  driveLoopRadiusMin: [0.8, 1.4],
  driveLoopRadiusMax: [0.8, 1.4],
  drivePauseChance: [1.6, 0.3],
  driveForMin: [0.8, 1.3],
  driveForMax: [0.8, 1.3],
  driveScaredChance: [1.6, 0.2],
  driveBrakeFirm: [0.8, 1.2],
};

/** Her driving params for one go at this confidence. */
export function driveMood(params, confidence) {
  const c = clamp01(confidence);
  const out = { ...params };
  for (const [key, [careful, confident]] of Object.entries(SCALE)) {
    if (typeof params[key] === 'number') out[key] = params[key] * lerp(careful, confident, c);
  }
  out.driveScaredChance = clamp01(out.driveScaredChance);
  out.drivePauseChance = clamp01(out.drivePauseChance);
  out.driveMaxThrottle = Math.min(1, out.driveMaxThrottle);
  return out;
}

/** This go's confidence: her usual confidence, give or take how she feels today. */
export function pickConfidence(base, swing, random = Math.random) {
  return clamp01(base + (random() * 2 - 1) * swing);
}

/** Her usual confidence after a go that ended like this. */
export function afterDrive(base, result, { gain = 0.08, fright = 0.15 } = {}) {
  if (result === 'scared' || result === 'gaveUp') return clamp01(base - fright);
  if (result === 'bored' || result === 'asked') return clamp01(base + gain);
  return base;
}

/** 'careful', 'steady' or 'confident', for picking what she says. */
export function moodName(confidence) {
  return confidence < 0.35 ? 'careful' : confidence > 0.65 ? 'confident' : 'steady';
}
