import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';

// The pulse model (#855): firings played from a bank's bare pulses (its idle with the resonances divided out), each burst shortened
// to fit the gap once firings meet, under the resonances put back. The worklet runs with the audio thread's globals, so load it in a
// sandbox that provides them, as the other worklet tests do.
const SR = 48000;
function loadWorklet() {
  const sandbox = { sampleRate: SR, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class {} };
  vm.createContext(sandbox);
  const src = readFileSync('src/audio/engineWorklet.js', 'utf8');
  vm.runInContext(`${src}\n;Object.assign(this, { RecordedEngine, Biquad, filterChain, runChain });`, sandbox);
  return sandbox;
}

const P = { ...DEFAULT_AUDIO_PARAMS, recIdleSource: 'quad', pulseSplit: 1, pulseSteady: 0, pulseModel: true };

// An idle of 40 back-to-back firings, 60 ms each, over noise (seeded, so the test is the same every run).
function noise(n, seed = 7) {
  const out = new Float32Array(n);
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) >>> 0;
    out[i] = (s / 2 ** 32) * 2 - 1;
  }
  return out;
}
function bank(model, data = noise(SR * 3)) {
  const grains = [];
  for (let i = 0; i < 40; i++) grains.push({ kind: 'idle', start: 0.01 + i * 0.06, dur: 0.06, tail: 0.002, rpm: 2000, src: 'a', rms: 0.3 });
  return { data, sourceGain: { a: 1 }, crankRpm: 300, grains, oneshots: {}, model };
}
function ready(rec, kind = 'idle') {
  rec.modelFor(kind);
  while (rec.building.length) rec.work(1 << 20);
  return rec.modelFor(kind);
}

describe('the pulse model', () => {
  it("undoes a bank's resonances on its idle and redoing them gives the recording back", () => {
    const { RecordedEngine, Biquad, filterChain, runChain } = loadWorklet();
    const peaks = JSON.parse(readFileSync('public/audio/engine-bank.json', 'utf8')).model['idle/1'].peaks;
    expect(peaks.length).toBeGreaterThan(0);
    const b = bank({ 'idle/1': { peaks, burst: 0.04 } });
    const rec = new RecordedEngine(b);
    const m = ready(rec);
    expect(m.data.length).toBeGreaterThan(SR * 2);
    // Redone as the processor does it: the same peaks at their own gain, over the bare copy.
    const redo = filterChain(peaks.map((pk) => {
      const f = new Biquad();
      f.set('peaking', pk.f, pk.q, SR, pk.g);
      return f;
    }));
    let err = 0, sig = 0, moved = 0;
    for (let i = 0; i < m.data.length; i++) {
      const x = b.data[m.from + i];
      err += (runChain(redo, m.data[i]) - x) ** 2;
      sig += x * x;
      moved += (m.data[i] - x) ** 2;
    }
    expect(10 * Math.log10(err / sig)).toBeLessThan(-100);
    // And the bare copy is not the recording: the resonances did come out.
    expect(10 * Math.log10(moved / sig)).toBeGreaterThan(-20);
  });

  it('plays a firing at its own speed below the burst point and at the burst over the gap above it', () => {
    const { RecordedEngine } = loadWorklet();
    const rec = new RecordedEngine(bank({ 'idle/1': { peaks: [], burst: 0.02 } }));
    ready(rec);
    const rateAt = (period) => {
      rec.trigger({ type: 'fire', strength: 1, period }, P, 120 / period, 0);
      return rec.voices[rec.voices.length - 1].rate;
    };
    // Firings 40 ms apart: the 20 ms burst fits, so as recorded.
    expect(rateAt(0.04)).toBeCloseTo(1, 6);
    expect(rateAt(0.025)).toBeCloseTo(1, 6);
    // 10 ms and 5 ms apart: the burst is shortened to fit the gap.
    expect(rateAt(0.01)).toBeCloseTo(2, 6);
    expect(rateAt(0.005)).toBeCloseTo(4, 6);
    // Firings from the model are summed apart, for the resonances to go back on, and not through the rev EQ.
    const v = rec.voices[rec.voices.length - 1];
    expect(v.bare).toBe(true);
    // The model off plays as before: at its own speed, from the recording.
    rec.trigger({ type: 'fire', strength: 1, period: 0.005 }, { ...P, pulseModel: false }, 24000, 0);
    const off = rec.voices[rec.voices.length - 1];
    expect(off.rate).toBeCloseTo(1, 6);
    expect(off.bare).toBe(false);
    expect(off.lp).toBe(null);
  });

  it('a voice read 4 times faster has nothing above its own Nyquist', () => {
    const { RecordedEngine } = loadWorklet();
    // A tone it keeps (0.03 of the sample rate, played at 0.12) and one above its Nyquist once 4 times faster (0.27, which would fold
    // back down to 0.08).
    const n = SR * 2;
    const data = new Float32Array(n);
    for (let i = 0; i < n; i++) data[i] = 0.5 * Math.sin(2 * Math.PI * 0.03 * i) + 0.5 * Math.sin(2 * Math.PI * 0.27 * i);
    const level = (pulseModel) => {
      const rec = new RecordedEngine({ ...bank({}, data), grains: [] });
      const g = { start: 0, len: n - 100, tail: 0, rpm: 2000, kind: 'idle', gain: 1, rms: 0 };
      const period = 0.25;
      rec.playPulse(g, 120 / period, 1, period, 1, { ...P, pulseModel }, 'low', 0, { key: 'idle/1', burst: 4 * period, data, from: 0 });
      expect(rec.voices[0].rate).toBeCloseTo(4, 6);
      const out = [];
      for (let i = 0; i < 8192; i++) {
        rec.sample({});
        out.push(rec.bareOut);
      }
      // Each tone's level in the output (Hann-windowed, from 2,048 samples in, past the fade-in).
      const at = (f) => {
        let re = 0, im = 0;
        for (let i = 0; i < 4096; i++) {
          const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / 4096);
          re += out[2048 + i] * w * Math.cos(2 * Math.PI * f * i);
          im += out[2048 + i] * w * Math.sin(2 * Math.PI * f * i);
        }
        return Math.hypot(re, im);
      };
      return 20 * Math.log10(at(0.08) / at(0.12));
    };
    expect(level(true)).toBeLessThan(-45);
    // Without the voice's low-pass (the model off) it folds back nearly as loud as the tone it keeps.
    expect(level(false)).toBeGreaterThan(-15);
  });
});
