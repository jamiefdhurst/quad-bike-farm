// How she feels about driving this time: a confidence from 0 (careful) to 1
// (confident). It reshapes her driving params for one go: careful is slower,
// shakier, smaller loops, more pauses and quicker to get scared; confident is
// much quicker (up to about 29 mph at the very top), smoother, big loops out
// across the field and keeps going for far longer. Her confidence drifts with
// experience: a fright knocks it, a go she enjoyed builds it. Pure logic.

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/**
 * Multipliers on each param at confidence 0 (careful) and 1 (bold); 1 means
 * unchanged, which is where every param is at 0.5. Below 0.5 they move
 * steadily towards careful; above it they move slowly at first and then
 * quickly (BOLD_CURVE), so the really fast driving is for when she's really
 * sure of herself: at 0.7 her top cruise is about 13 mph, at 0.85 about 20,
 * at 1 about 29.
 */
const SCALE = {
  driveSpeedMin: [0.7, 5],
  driveSpeedMax: [0.7, 3.7],
  driveScareSpeed: [0.85, 2.9],
  driveMaxThrottle: [0.8, 2.7],
  driveThrottleGain: [1, 2],
  driveJerk: [1.4, 0.35],
  driveOverSteerRate: [1.3, 0.15],
  driveLoopRadiusMin: [0.8, 3.5],
  driveLoopRadiusMax: [0.8, 3.5],
  driveWaypointsMax: [1, 1.7],
  driveArriveRadius: [1, 2.2],
  drivePauseChance: [1.6, 0.15],
  driveForMin: [0.8, 2.5],
  driveForMax: [0.8, 2.5],
  driveScaredChance: [1.6, 0.1],
  driveBrakeFirm: [0.8, 1.6],
  driveCornerAccel: [0.8, 1.3],
  followDriveOnChance: [0.4, 2.4],
};
const BOLD_CURVE = 1.6;

/** Her driving params for one go at this confidence. */
export function driveMood(params, confidence) {
  const c = clamp01(confidence);
  const out = { ...params };
  for (const [key, [careful, bold]] of Object.entries(SCALE)) {
    if (typeof params[key] !== 'number') continue;
    const scale = c < 0.5 ? lerp(careful, 1, c / 0.5) : lerp(1, bold, ((c - 0.5) / 0.5) ** BOLD_CURVE);
    out[key] = params[key] * scale;
  }
  out.driveScaredChance = clamp01(out.driveScaredChance);
  out.drivePauseChance = clamp01(out.drivePauseChance);
  if (typeof out.followDriveOnChance === 'number') out.followDriveOnChance = clamp01(out.followDriveOnChance);
  out.driveMaxThrottle = Math.min(1, out.driveMaxThrottle);
  return out;
}

/** This go's confidence: her usual confidence, give or take how she feels today. */
export function pickConfidence(base, swing, random = Math.random) {
  return clamp01(base + (random() * 2 - 1) * swing);
}

/** Her usual confidence after a go that ended like this. */
export function afterDrive(base, result, { gain = 0.1, fright = 0.15 } = {}) {
  if (result === 'scared' || result === 'gaveUp') return clamp01(base - fright);
  if (result === 'bored' || result === 'asked') return clamp01(base + gain);
  return base;
}

/** 'careful', 'steady' or 'confident', for picking what she says. */
export function moodName(confidence) {
  return confidence < 0.35 ? 'careful' : confidence > 0.65 ? 'confident' : 'steady';
}
