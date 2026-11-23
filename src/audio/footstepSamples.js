// One step per surface as samples, made procedurally once and played with a little pitch spread: a body (a dull thud of the foot), a noise
// part that says what the ground is (a crunch of gravel, a suck of mud, a scuff on concrete, a rustle of straw) and a length. Deterministic.

// body: [Hz, decay per second, level]; noise: [decay per second, brightness 0..1 (bigger is brighter), level, grains per second for a crunch or rustle, 0 for none]
const STEPS = {
  grass: { body: [95, 30, 0.35], noise: [38, 0.12, 0.25, 0], seconds: 0.18 },
  dirt: { body: [110, 34, 0.4], noise: [30, 0.3, 0.4, 60], seconds: 0.2 },
  mud: { body: [70, 16, 0.5], noise: [14, 0.1, 0.55, 0], seconds: 0.32, suck: true },
  tarmac: { body: [150, 45, 0.45], noise: [60, 0.45, 0.3, 0], seconds: 0.14 },
  concrete: { body: [135, 50, 0.5], noise: [70, 0.55, 0.45, 0], seconds: 0.14, ring: [900, 120, 0.1] }, // a wellie slapping hard floor, with a hint of ring
  stone: { body: [105, 36, 0.35], noise: [22, 0.7, 0.6, 140], seconds: 0.26 }, // gravel: a crunch of many grains
  straw: { body: [80, 28, 0.15], noise: [16, 0.4, 0.45, 200], seconds: 0.28, rustle: true },
};

/** The surfaces that can be made. */
export const STEP_KINDS = Object.keys(STEPS);

/** One step as samples, `variant` 0 to 2 picks a different seed so three takes don't sound the same. */
export function stepSamples(kind, rate, variant = 0) {
  const c = STEPS[kind];
  if (!c) throw new Error(`No such step: ${kind}`);
  const n = Math.round(rate * c.seconds);
  const out = new Float32Array(n);
  let seed = 9001 + kind.length * 31 + variant * 977;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2147483648 - 1;
  };
  let lp = 0;
  let grain = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let noise = rand();
    if (c.noise[3]) {
      // Grains: the noise is on in short bursts, each a different size, so it crunches rather than hisses.
      if (rand() > 1 - c.noise[3] / rate * 2) grain = 0.5 + Math.abs(rand()) * 0.5;
      grain *= 0.992;
      noise *= grain;
    }
    lp += (noise - lp) * (0.05 + c.noise[1] * 0.9);
    // Mud: a wet suck at the end as the foot lifts, a rising low note.
    const suck = c.suck ? Math.sin(2 * Math.PI * (120 + 260 * t) * t) * Math.max(0, t - 0.1) * Math.exp(-(t - 0.1) * 12) * 1.4 : 0;
    const swell = c.rustle ? Math.min(1, t * 30) * (0.6 + 0.4 * Math.sin(t * 70)) : 1;
    const ring = c.ring ? Math.sin(2 * Math.PI * c.ring[0] * t) * Math.exp(-t * c.ring[1]) * c.ring[2] : 0;
    out[i] = Math.sin(2 * Math.PI * c.body[0] * t) * Math.exp(-t * c.body[1]) * c.body[2] + lp * Math.exp(-t * c.noise[0]) * c.noise[2] * swell + suck * 0.25 + ring;
  }
  return out;
}
