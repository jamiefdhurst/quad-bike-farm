import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { QUAD_SPECS, EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC, PLOVER_SPEC } from '../src/vehicle/quadSpecs.js';

// The pulse sound's steadiness and each cylinder's own character (#854), in the worklet run in a sandbox as
// tests/engineWorkletNaN.test.js runs it, with its random choices seeded so every run plays the same firings.
const SR = 48000;
function loadWorklet(seed = 1) {
  const sandbox = { sampleRate: SR, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class {} };
  vm.createContext(sandbox);
  vm.runInContext(`{ let s = ${seed * 7919}; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647; }`, sandbox);
  vm.runInContext(`${readFileSync('src/audio/engineWorklet.js', 'utf8')}\n;this.RecordedEngine = RecordedEngine;`, sandbox);
  return sandbox;
}

// A made-up bank: 24 idle cycles of 0.1 s (a single at about 1,200 rpm, or a four's whole cycle), each a decaying bang over a
// steady hiss so a gap between firings shows as silence, and 24 rev firings at 3,000 to 5,000 rpm for a blend.
function makeBank() {
  const data = new Float32Array(SR * 4);
  let s = 12345;
  const noise = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < data.length; i++) data[i] = 0.15 * noise();
  const grains = [];
  for (let c = 0; c < 24; c++) {
    const start = c * 0.1;
    // Four bangs a cycle, of different strengths, so a cycle cut in four has firings that differ.
    for (let k = 0; k < 4; k++) {
      const at = Math.round((start + k * 0.025) * SR);
      for (let i = 0; i < 0.02 * SR; i++) data[at + i] += (0.6 + 0.1 * k) * Math.exp(-i / (0.004 * SR)) * noise() * 2;
    }
    grains.push({ kind: 'idle', start, dur: 0.1, tail: 0.002, rpm: 1150 + c * 4, src: 'q', rms: 0.2 });
  }
  for (let c = 0; c < 24; c++) {
    const rpm = 3000 + c * 90;
    grains.push({ kind: 'accel', start: 2.5 + c * 0.04, dur: 120 / rpm, tail: 0.002, rpm, src: 'q', rms: 0.2 });
  }
  return { data, sourceGain: { q: 1 }, crankRpm: 300, grains, oneshots: {} };
}

// Plays even firings at `rpm` for `seconds`, `firings` a cycle, and returns the output and the grain each firing played.
function play(sets, rpm, { firings = 1, seconds = 0.8, seed = 1 } = {}) {
  const { RecordedEngine } = loadWorklet(seed);
  const rec = new RecordedEngine(makeBank());
  const p = { ...DEFAULT_AUDIO_PARAMS, engineSound: 'pulse', ...sets };
  const period = 120 / rpm / firings;
  const out = new Float32Array(Math.round(seconds * SR));
  const played = [];
  let next = 0;
  for (let n = 0; n < out.length; n++) {
    if (n >= next) {
      rec.trigger({ type: 'fire', strength: 1, period }, p, rpm, 1);
      played.push(rec.cursor.low);
      next += period * SR;
    }
    out[n] = rec.sample({ rpm, cranking: false });
  }
  return { out, played };
}

// What the worklet played before #854, with none of its settings: total energy and a few samples, from the code as it was.
const fingerprint = (out) => [out.reduce((a, x) => a + x * x, 0), ...[4000, 9000, 15000, 22000, 31000].map((i) => out[i])].map((v) => v.toFixed(6));
const CASES = {
  'a single idling': [{}, 1200],
  'a single revving': [{}, 4000],
  'a four cut into its firings, revving': [{ pulseSplit: 4 }, 3500, { firings: 4 }],
  'a single blending into its revs': [{ pulseRevLo: 2500, pulseRevHi: 3500 }, 3200],
};
const BEFORE = {
  'a single idling': ['217.284065', '-0.131248', '0.019396', '-0.020916', '0.039114', '-0.001260'],
  'a single revving': ['951.641475', '0.071782', '0.056203', '0.016215', '0.034571', '-0.009741'],
  'a four cut into its firings, revving': ['2043.370862', '0.172789', '-0.072771', '0.023958', '-0.167590', '0.038365'],
  'a single blending into its revs': ['63.691524', '-0.038522', '0.040362', '0.015524', '0.012936', '0.011811'],
};
const OFF = { pulseSteady: 0, pulseCylinders: 0, pulseCylGain: 0, pulseCylTime: 0, pulseFireJitter: 0, pulseStrengthJitter: 0 };

describe('engine worklet: steadiness and each cylinder its own', () => {
  it('plays what it did before with every new setting at 0', () => {
    for (const [name, [sets, rpm, opts]] of Object.entries(CASES)) expect(fingerprint(play({ ...sets, ...OFF }, rpm, opts).out), name).toEqual(BEFORE[name]);
  });

  it('with pulseSteady 1 above idle plays one firing over and over', () => {
    // Over 2.5 times the recorded idle, from the second firing on (the first is picked afresh).
    const { played } = play({ pulseSteady: 1 }, 4000);
    expect(new Set(played.slice(1)).size).toBe(1);
    // A cycle cut into its firings replays its whole cycle, in order.
    const four = play({ pulseSplit: 4, pulseSteady: 1 }, 4000, { firings: 4 }).played.slice(4);
    expect(new Set(four).size).toBe(4);
    for (let i = 4; i < four.length; i++) expect(four[i]).toBe(four[i - 4]);
    // And at idle it still picks a fresh one, as the recording does.
    expect(new Set(play({ pulseSteady: 1 }, 1200).played).size).toBeGreaterThan(1);
  });

  it('never leaves a gap where a firing starts late', () => {
    // A four with its cylinders spread wide in time and every firing late at random, at twice its idle (all of the spread), with
    // short crossfades: released at once, the firing before a late one would be gone up to 7 ms before it starts.
    const sets = { pulseSplit: 4, pulseCylGain: 4, pulseCylTime: 0.5, pulseFireJitter: 0.3, pulseStrengthJitter: 0.3, pulseCrossfade: 0.1 };
    for (const seed of [1, 2, 3]) {
      const { out } = play(sets, 2500, { firings: 4, seed });
      const w = Math.round(0.005 * SR);
      const levels = [];
      for (let i = Math.round(0.1 * SR); i + w <= out.length; i += w >> 1) {
        let e = 0;
        for (let k = 0; k < w; k++) e += out[i + k] * out[i + k];
        levels.push(10 * Math.log10(e / w + 1e-20));
      }
      const median = [...levels].sort((a, b) => a - b)[levels.length >> 1];
      expect(Math.min(...levels), `seed ${seed}`).toBeGreaterThan(median - 20);
    }
  });

  it('gives every engine the values fitted to real rev recordings', () => {
    const specs = [...QUAD_SPECS, ...EXTRA_SPECS, HARTLEY_SPEC, YAK_SPEC, TOR_SPEC, CRAG_SPEC, FINCH_SPEC, GRIFFIN_SPEC, VAUCLAIR_SPEC, PLOVER_SPEC];
    const single = { pulseSteady: 0.2 };
    const twoStroke = { pulseSteady: 0.4 };
    const want = {
      farm300: single, bruin: single, rb300: single, ursa: single, shepherd: single, clipper: single,
      hornet: twoStroke, adder: twoStroke, asp: twoStroke, tz65: twoStroke, t185: twoStroke, plover: twoStroke,
      finch: { pulseSteady: 0.3 },
      griffin: { pulseCylGain: 4, pulseCylTime: 0.2, pulseFireJitter: 0.1, pulseStrengthJitter: 0.3 },
      tor: { pulseSteady: 0.3 },
      yak: {}, crag: {}, vauclair: {}, hartley: {},
    };
    expect(specs.map((s) => s.id).sort()).toEqual(Object.keys(want).sort());
    for (const s of specs) {
      const p = { ...DEFAULT_AUDIO_PARAMS, ...s.audio };
      const got = Object.fromEntries(Object.keys(OFF).map((k) => [k, p[k]]));
      expect(got, s.id).toEqual({ ...OFF, ...want[s.id] });
    }
    // The Griffin's spread is over its four cylinders, as its idle is cut (pulseCylinders 0 takes pulseSplit).
    expect(GRIFFIN_SPEC.audio.pulseSplit).toBe(4);
  });
});
