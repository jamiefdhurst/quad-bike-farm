// The log splitter's sounds. A round giving way on the wedge: a sharp crack of wood (a burst of filtered noise) over a low thump as the
// halves drop, made once and played where it happens (same shape as conkerAudio.js). And the ram itself (#338): the pump's whine while oil
// moves, a deeper strain while the ram's face is in the round, and a hiss of oil as it starts back. All procedural, made once as samples;
// ramSound() is the pure part that says which plays from the splitter's state (items/logSplitter.js).

import { DEFAULT_SOUND_PARAMS } from './audioParams.js';

/** One split as samples: noise with a fast click and a ragged tail, and a 90 Hz thump. Deterministic. */
export function crackSamples(rate) {
  const n = Math.round(rate * 0.5);
  const out = new Float32Array(n);
  let seed = 9091;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.55;
    const ragged = 0.6 + 0.4 * Math.sin(t * 310) * Math.sin(t * 77); // the splintering is uneven
    out[i] = lp * Math.exp(-t * 28) * ragged * 0.9 + Math.sin(2 * Math.PI * 90 * t) * Math.exp(-t * 18) * 0.55 + noise * Math.exp(-t * 300) * 0.5;
  }
  return out;
}

// Every frequency in the two loops is a whole number of Hz and each loop is one second long, so each ends where it began and loops
// without a click.
const TWO_PI = 2 * Math.PI;

/**
 * The pump's whine as one second to loop: a gear pump's tooth tone (420 Hz and its overtones) over the shaft's lower hum, with a slow
 * wobble as the teeth mesh and a breath of oil noise. Deterministic.
 */
export function whineSamples(rate) {
  const n = Math.round(rate);
  const out = new Float32Array(n);
  let seed = 3381;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.2;
    const wobble = 1 + 0.18 * Math.sin(TWO_PI * 7 * t) + 0.08 * Math.sin(TWO_PI * 13 * t);
    const tooth = Math.sin(TWO_PI * 420 * t) * 0.5 + Math.sin(TWO_PI * 840 * t) * 0.22 + Math.sin(TWO_PI * 1260 * t) * 0.1;
    const shaft = Math.sin(TWO_PI * 140 * t) * 0.25;
    out[i] = (tooth * wobble + shaft) * 0.7 + lp * 0.12;
  }
  return out;
}

/**
 * The ram straining against the round as one second to loop: a low rough groan (95 Hz with its overtones, pulled about unevenly as the
 * wood resists) over a rumble of noise. Deterministic.
 */
export function strainSamples(rate) {
  const n = Math.round(rate);
  const out = new Float32Array(n);
  let seed = 7717;
  let lp = 0;
  let lp2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / n;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.04;
    lp2 += (lp - lp2) * 0.04;
    let groan = 0;
    for (let k = 1; k <= 6; k++) groan += Math.sin(TWO_PI * 95 * k * t + k * 0.7) / k;
    const creak = 0.55 + 0.25 * Math.sin(TWO_PI * 3 * t) + 0.15 * Math.sin(TWO_PI * 5 * t + 1) + 0.1 * Math.sin(TWO_PI * 11 * t + 2);
    out[i] = groan * creak * 0.45 + lp2 * 6;
  }
  return out;
}

/** Oil let back through the valve as the ram starts home: a short hiss of high noise, quick to come and slower to go. Deterministic. */
export function hissSamples(rate) {
  const n = Math.round(rate * 0.7);
  const out = new Float32Array(n);
  let seed = 5150;
  let lp = 0;
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const noise = seed / 2147483648 - 1;
    lp += (noise - lp) * 0.35;
    const high = noise - lp; // what the lowpass took away: the hiss, with no rumble in it
    out[i] = high * Math.min(1, t / 0.02) * Math.exp(-t * 5.5) * 0.9;
  }
  return out;
}

// How the ram's sounds move with what it is doing. Fixed: the volumes are the tunable part (the Sound tuning).
export const RAM_SOUND = {
  returnWhine: 0.7, // the whine coming back, against going out: nothing to push
  returnRate: 1.06, // and a touch higher
  pressRate: 0.9, // the whine's pitch while the ram is in the round, the pump labouring
  gnarledRate: 0.82, // and in a gnarled one
  gnarledStrain: 1.4, // a gnarled round strains louder
  gnarledStrainRate: 0.8, // and lower
};

/**
 * What the ram sounds like this step. `state` is the splitter's: `powered` (engine running, tractor held), `dir` (1 out, -1 back, 0
 * still), `pressing` (its face in the round), `gnarled` (the round on the beam is). `wasDir` is `dir` on the step before, so the hiss is
 * played once, as the ram starts back. Silent with the engine off or the ram still. Pure.
 * @returns {{ whine: number, whineRate: number, strain: number, strainRate: number, hiss: number }}  gains, playback rates, and the hiss's
 *   gain (0 for no hiss)
 */
export function ramSound(state, wasDir = 0, volumes = DEFAULT_SOUND_PARAMS) {
  const quiet = { whine: 0, whineRate: 1, strain: 0, strainRate: 1, hiss: 0 };
  if (!state.powered || !state.dir) return quiet;
  const whineVol = volumes.splitterWhineVolume ?? DEFAULT_SOUND_PARAMS.splitterWhineVolume;
  const strainVol = volumes.splitterStrainVolume ?? DEFAULT_SOUND_PARAMS.splitterStrainVolume;
  const hissVol = volumes.splitterHissVolume ?? DEFAULT_SOUND_PARAMS.splitterHissVolume;
  if (state.dir < 0) return { ...quiet, whine: whineVol * RAM_SOUND.returnWhine, whineRate: RAM_SOUND.returnRate, hiss: wasDir < 0 ? 0 : hissVol };
  if (!state.pressing) return { ...quiet, whine: whineVol };
  const g = !!state.gnarled;
  return {
    whine: whineVol,
    whineRate: g ? RAM_SOUND.gnarledRate : RAM_SOUND.pressRate,
    strain: strainVol * (g ? RAM_SOUND.gnarledStrain : 1),
    strainRate: g ? RAM_SOUND.gnarledStrainRate : 1,
    hiss: 0,
  };
}

const SMOOTH = 0.06; // seconds for the loops' level and pitch to follow, so starting and stopping the ram doesn't click
const STOP_AFTER = 1; // seconds of silence before the loops are stopped, so a splitter nobody is using costs nothing

export class SplitAudio {
  constructor(hub, volume = 0.8) {
    this.hub = hub;
    this.volume = volume;
    this.panner = null;
    this.loops = null; // { whine, strain } of { src, gain } while the ram's loops are playing
    this.wasDir = 0;
    this.silentFor = 0;
  }

  attach() {
    const hub = this.hub;
    if (this.panner || !hub.ready) return !!this.panner;
    const ctx = hub.ctx;
    this.panner = ctx.createPanner();
    this.panner.panningModel = 'HRTF';
    this.panner.distanceModel = 'inverse';
    this.panner.refDistance = 4;
    this.panner.maxDistance = 300;
    this.panner.connect(hub.master);
    const buffer = (samples) => {
      const b = ctx.createBuffer(1, samples.length, ctx.sampleRate);
      b.copyToChannel(samples, 0);
      return b;
    };
    this.buffer = buffer(crackSamples(ctx.sampleRate));
    this.whineBuffer = buffer(whineSamples(ctx.sampleRate));
    this.strainBuffer = buffer(strainSamples(ctx.sampleRate));
    this.hissBuffer = buffer(hissSamples(ctx.sampleRate));
    return true;
  }

  place(at) {
    if (this.panner.positionX) {
      this.panner.positionX.value = at.x;
      this.panner.positionY.value = at.y;
      this.panner.positionZ.value = at.z;
    } else this.panner.setPosition(at.x, at.y, at.z);
  }

  /** One crack at `at` ({ x, y, z }); a gnarled round gives a lower, longer one. */
  crack(at, gnarled = false) {
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    this.place(at);
    const src = ctx.createBufferSource();
    src.buffer = this.buffer;
    src.playbackRate.value = (gnarled ? 0.8 : 1) * (0.92 + Math.random() * 0.16);
    const gain = ctx.createGain();
    gain.gain.value = this.volume;
    src.connect(gain).connect(this.panner);
    src.start();
  }

  /**
   * Every frame, from the splitter's state (see ramSound): sets the whine and strain loops going and follows them, and hisses as the ram
   * starts back. `at()` gives the beam's place in the world, asked for only while there is something to hear.
   */
  ram(dt, state, at) {
    const s = ramSound(state, this.wasDir, this.hub.params ?? DEFAULT_SOUND_PARAMS);
    this.wasDir = state.powered ? state.dir : 0;
    const heard = s.whine > 0 || s.strain > 0 || s.hiss > 0;
    this.silentFor = heard ? 0 : this.silentFor + dt;
    if (!heard && !this.loops) return;
    if (!this.attach()) return;
    const ctx = this.hub.ctx;
    if (heard) this.place(at());
    if (heard && !this.loops) this.loops = { whine: this.loop(this.whineBuffer), strain: this.loop(this.strainBuffer) };
    if (this.loops) {
      const now = ctx.currentTime;
      const follow = (l, gain, rate) => {
        l.gain.gain.setTargetAtTime(gain, now, SMOOTH);
        l.src.playbackRate.setTargetAtTime(rate, now, SMOOTH);
      };
      follow(this.loops.whine, s.whine, s.whineRate);
      follow(this.loops.strain, s.strain, s.strainRate);
      if (this.silentFor > STOP_AFTER) {
        for (const l of Object.values(this.loops)) l.src.stop();
        this.loops = null;
      }
    }
    if (s.hiss > 0) {
      const src = ctx.createBufferSource();
      src.buffer = this.hissBuffer;
      src.playbackRate.value = 0.95 + Math.random() * 0.1;
      const gain = ctx.createGain();
      gain.gain.value = s.hiss;
      src.connect(gain).connect(this.panner);
      src.start();
    }
  }

  /** A loop of `buffer` through its own gain to the panner, started silent. */
  loop(buffer) {
    const ctx = this.hub.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain).connect(this.panner);
    src.start();
    return { src, gain };
  }
}
