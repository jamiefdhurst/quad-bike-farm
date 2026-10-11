// How the ground under a tyre feels beyond grass and mud: the farm road's tarmac grips harder and rolls easier, the stubble fields roll
// easier than grass and go greasy in the wet. Pure; the quad takes a grip and a rolling factor from it for each wheel and for itself.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const DEFAULT_SURFACE_PARAMS = {
  tarmacGrip: 1.3, // grip on dry tarmac, times the tyre's grip on grass
  tarmacWetGrip: 1.15, // and on wet tarmac (the ground's usual wet loss comes on top)
  stubbleGrip: 1, // grip on dry stubble: firm, like dry grass
  stubbleWetGrip: 0.85, // and on wet stubble: greasier than wet grass
  tarmacRoll: 0.6, // drag rolling on tarmac (rolling resistance and the body's damping), times that on grass
  stubbleRoll: 0.75, // and on stubble: short and firm, so a quad runs on quicker than through grass
  snowGrip: 0.62, // grip on ground under full snow, as a factor on what it would be bare (tarmac too); between wet grass and mud
  snowRoll: 1.25, // and its rolling drag under full snow: tyres push it about
};

export const SURFACE_PARAM_RANGES = {
  tarmacGrip: [0.5, 2, 0.01],
  tarmacWetGrip: [0.5, 2, 0.01],
  stubbleGrip: [0.5, 1.5, 0.01],
  stubbleWetGrip: [0.5, 1.5, 0.01],
  tarmacRoll: [0.1, 1.5, 0.01],
  stubbleRoll: [0.1, 1.5, 0.01],
  snowGrip: [0.2, 1, 0.01],
  snowRoll: [0.8, 2, 0.01],
};

/**
 * Grip and rolling drag for ground that is `tarmac` and `stubble` (0..1 each, the rest grass), `wet` 0..1 and under `snow` 0..1 of
 * cover, as factors on grass.
 * @returns {{grip:number, roll:number}}
 */
export function surfaceFeel(p, tarmac, stubble, wet = 0, snow = 0) {
  const t = clamp(tarmac, 0, 1);
  const s = clamp(stubble, 0, 1 - t);
  const w = clamp(wet, 0, 1);
  const tarmacGrip = p.tarmacGrip + (p.tarmacWetGrip - p.tarmacGrip) * w;
  const stubbleGrip = p.stubbleGrip + (p.stubbleWetGrip - p.stubbleGrip) * w;
  const sn = clamp(snow, 0, 1);
  return {
    grip: (1 + (tarmacGrip - 1) * t + (stubbleGrip - 1) * s) * (1 + (p.snowGrip - 1) * sn),
    roll: (1 + (p.tarmacRoll - 1) * t + (p.stubbleRoll - 1) * s) * (1 + (p.snowRoll - 1) * sn),
  };
}
