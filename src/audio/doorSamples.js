// The noises of a door, made once at load: a latch letting go, a door pushed shut, one slammed, a tailgate coming up short on its chains.
// A Tor's or Crag's are deeper and ring hollow (big flat panels with a lot of air behind them), a car's are higher, tighter and shorter. Same
// shape as bellAudio.js: pure sample makers here, the Web Audio side in rideAudio.js. Deterministic for a given seed.

export const DOOR_PROFILES = {
  landRover: { body: 70, bodyTau: 0.07, ring: 190, ringTau: 0.11, click: 1900, size: 1 }, // aluminium on a steel frame: a boom, then a hollow ring
  car: { body: 120, bodyTau: 0.045, ring: 340, ringTau: 0.06, click: 2600, size: 0.75 }, // pressed steel with a rubber seal: a short thud
};

const TWO_PI = Math.PI * 2;

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2147483648 - 1;
  };
}

/** A tick of metal: a burst of noise and a short ring at `hz`, added to `out` at `at` seconds. */
function click(out, rate, at, hz, amp, noise) {
  const start = Math.round(at * rate);
  for (let i = 0; start + i < out.length && i < rate * 0.05; i++) {
    const t = i / rate;
    out[start + i] += amp * (Math.sin(TWO_PI * hz * t) * Math.exp(-t * 160) * 0.6 + noise() * Math.exp(-t * 420) * 0.7);
  }
}

/** The panel thudding into its frame: a low body, a hollow ring, and a puff of noise through a one-pole filter. */
function thud(out, rate, at, prof, amp, noise) {
  const start = Math.round(at * rate);
  let lp = 0;
  for (let i = 0; start + i < out.length; i++) {
    const t = i / rate;
    lp += (noise() - lp) * 0.2;
    out[start + i] +=
      amp *
      (Math.sin(TWO_PI * prof.body * t) * Math.exp(-t / prof.bodyTau) * 0.8 +
        Math.sin(TWO_PI * prof.ring * t) * Math.exp(-t / prof.ringTau) * 0.3 +
        Math.sin(TWO_PI * prof.ring * 1.93 * t) * Math.exp(-t / (prof.ringTau * 0.6)) * 0.12 +
        lp * Math.exp(-t * 70) * 0.55);
  }
}

/**
 * One sound as samples. `what` is 'open' (the latch lets go and the seal peels), 'shut' (pushed to), 'slam' or 'stop' (a tailgate
 * on its chains); `prof` is an entry of DOOR_PROFILES. Peaks stay under 1.
 */
export function doorSamples(rate, what, prof, seed = 1) {
  const noise = rng(seed * 7919 + 13);
  const jitter = 1 + noise() * 0.06;
  const len = Math.round(rate * (what === 'open' ? 0.18 : what === 'slam' ? 0.7 : 0.5) * (0.7 + 0.3 * prof.size));
  const out = new Float32Array(len);
  const hz = prof.click * jitter;
  if (what === 'open') {
    click(out, rate, 0.004, hz, 0.7, noise); // the handle
    click(out, rate, 0.03, hz * 0.7, 0.35, noise); // the latch
    let lp = 0;
    for (let i = Math.round(rate * 0.02); i < len; i++) {
      lp += (noise() - lp) * 0.08;
      out[i] += lp * Math.exp(-(i / rate) * 22) * 0.18; // the seal peeling away
    }
  } else if (what === 'stop') {
    const clank = { ...prof, body: 90, ring: 620 * jitter, bodyTau: 0.05, ringTau: 0.09 };
    thud(out, rate, 0, clank, 0.7, noise);
    click(out, rate, 0.002, 1300 * jitter, 0.8, noise);
    click(out, rate, 0.045, 1700 * jitter, 0.35, noise); // the chains settling
  } else {
    const slam = what === 'slam';
    thud(out, rate, 0, prof, slam ? 0.95 : 0.6, noise);
    click(out, rate, slam ? 0.012 : 0.02, hz, slam ? 0.7 : 0.5, noise); // the latch catching
    if (slam) click(out, rate, 0.09, hz * 0.8, 0.25, noise); // and the panel rattling in its frame
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.95) for (let i = 0; i < len; i++) out[i] *= 0.95 / peak;
  const fade = Math.min(len, Math.round(rate * 0.01)); // end on silence
  for (let i = 0; i < fade; i++) out[len - 1 - i] *= i / fade;
  return out;
}
