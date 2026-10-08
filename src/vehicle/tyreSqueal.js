// Tyres squealing on the tarmac: sliding sideways through a corner, braking hard, or spinning up. Pure; the ride sounds play it.

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const DEFAULT_SQUEAL_PARAMS = {
  slipFrom: 0.08, // radians the tyres are sliding sideways (the slip angle) before they start to squeal ...
  slipTo: 0.3, // ... and at which they're squealing flat out
  speedFrom: 2, // m/s below which nothing squeals ...
  speedTo: 7, // ... and above which a slide squeals fully
  brakeFrom: 0.6, // brake lever (0..1) at which the tyres start to squeal under braking ...
  brakeTo: 1, // ... and at which they squeal as loud as braking makes them
  brakeLevel: 0.7, // how loud a hard stop squeals, against a full slide
  spinFrom: 0.2, // wheelspin (0..1) at which spinning up squeals ...
  spinTo: 0.7,
};

export const SQUEAL_PARAM_RANGES = {
  slipFrom: [0, 0.5, 0.01],
  slipTo: [0.05, 1, 0.01],
  speedFrom: [0, 10, 0.1],
  speedTo: [0.5, 20, 0.1],
  brakeFrom: [0, 1, 0.01],
  brakeTo: [0, 1, 0.01],
  brakeLevel: [0, 1, 0.01],
  spinFrom: [0, 1, 0.01],
  spinTo: [0, 1, 0.01],
};

/** The slip angle, radians: how far the way it's going is from the way it's pointing, from its forward and sideways speed (m/s). */
export function slipAngle(forward, sideways) {
  return Math.atan2(Math.abs(sideways), Math.abs(forward));
}

/**
 * 0..1 how hard the tyres are squealing.
 * @param {object} s
 * @param {number} s.tarmac  0..1 how much of the ground under the wheels is tarmac.
 * @param {number} s.slip    Slip angle, radians.
 * @param {number} s.speed   Ground speed, m/s.
 * @param {number} s.brake   Brake lever, 0..1.
 * @param {number} s.spin    Wheelspin, 0..1.
 */
export function squealLevel(p, { tarmac, slip, speed, brake, spin }) {
  if (tarmac <= 0) return 0;
  const moving = smoothstep(p.speedFrom, p.speedTo, Math.abs(speed));
  const slide = smoothstep(p.slipFrom, p.slipTo, slip) * moving;
  const stop = smoothstep(p.brakeFrom, p.brakeTo, brake) * p.brakeLevel * moving;
  const spinning = smoothstep(p.spinFrom, p.spinTo, spin);
  return Math.min(1, Math.max(slide, stop, spinning)) * Math.min(1, tarmac);
}
