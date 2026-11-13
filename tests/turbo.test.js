import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { DEFENDER_SPEC } from '../src/vehicle/quadSpecs.js';

// The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them (as engineWorkletNaN does).
function processor(params) {
  const sandbox = { sampleRate: 48000, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class { constructor() { this.port = { postMessage: () => {} }; } } };
  vm.createContext(sandbox);
  vm.runInContext(`${readFileSync('src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`, sandbox);
  const proc = new sandbox.EngineProcessor();
  proc.p = { ...DEFAULT_AUDIO_PARAMS, ...params };
  return proc;
}

/** Runs the turbo for `seconds` at a steady rpm and throttle; returns its output's RMS over the last tenth and the boost. */
function run(proc, seconds, rpm, throttle) {
  proc.state = { running: true, rpm, throttle };
  proc.rpm = rpm;
  proc.throttle = throttle;
  const n = Math.round(seconds * 48000);
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    const x = proc.turboSample();
    expect(Number.isFinite(x)).toBe(true);
    if (i > n * 0.9) {
      sum += x * x;
      count++;
    }
  }
  return { rms: Math.sqrt(sum / Math.max(1, count)), boost: proc.turboBoost };
}

describe('the turbo', () => {
  it('is silent on an engine without one', () => {
    const proc = processor({ turboVolume: 0 });
    expect(run(proc, 0.5, 4000, 1).rms).toBe(0);
  });

  it('makes no boost at tickover, and comes up to boost a moment after the throttle opens', () => {
    const proc = processor(DEFENDER_SPEC.audio);
    expect(run(proc, 1, 800, 0).boost).toBeLessThan(0.01);
    const soon = run(proc, 0.3, 3600, 1).boost;
    const later = run(proc, 3, 3600, 1).boost;
    expect(soon).toBeGreaterThan(0.1);
    expect(soon).toBeLessThan(0.5); // it lags
    expect(later).toBeGreaterThan(0.9);
  });

  it('whistles louder with more boost, and runs down when the throttle shuts', () => {
    const proc = processor(DEFENDER_SPEC.audio);
    const part = run(proc, 3, 2400, 0.4);
    const full = run(proc, 3, 3600, 1);
    expect(full.rms).toBeGreaterThan(part.rms * 2);
    const after = run(proc, 3, 900, 0);
    expect(after.boost).toBeLessThan(0.05);
  });

  it('only the 200TDi has one', async () => {
    const specs = await import('../src/vehicle/quadSpecs.js');
    const all = Object.values(specs).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.audio);
    expect(all.filter((s) => s.audio.turboVolume > 0).map((s) => s.id)).toEqual(['crag']);
  });
});
