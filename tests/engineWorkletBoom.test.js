import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';

// The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them.
function loadWorklet(sampleRate) {
  const sandbox = {
    sampleRate,
    currentFrame: 0,
    registerProcessor: () => {},
    AudioWorkletProcessor: class {
      constructor() {
        this.port = { postMessage: () => {} };
      }
    },
  };
  vm.createContext(sandbox);
  vm.runInContext(`${readFileSync('src/audio/engineWorklet.js', 'utf8')}\n;this.EngineProcessor = EngineProcessor;`, sandbox);
  return sandbox;
}

/** Plays a recording of a pure tone through the pulse sound at idle for a second; returns the output's rms after the first 0.2 s. */
function render(freq, params) {
  const sr = 44100;
  const sandbox = loadWorklet(sr);
  const proc = new sandbox.EngineProcessor();
  const data = new Float32Array(sr * 3).map((_, i) => 0.2 * Math.sin((2 * Math.PI * freq * i) / sr));
  const grains = Array.from({ length: 20 }, (_, i) => ({ kind: 'idle', start: i * 0.12, dur: 0.12, tail: 0, rpm: 1000, src: 'g', rms: 0.14 }));
  proc.onMessage({ bank: { data, sourceGain: { g: 1 }, crankRpm: 300, grains, oneshots: {}, readThrough: true } });
  const events = Array.from({ length: 9 }, (_, i) => ({ time: i * 0.12, type: 'fire', strength: 1, period: 0.12 }));
  proc.onMessage({ params: { ...DEFAULT_AUDIO_PARAMS, ...params }, state: { rpm: 1000, throttle: 0, running: true }, events });
  const block = new Float32Array(128);
  let sum = 0;
  let n = 0;
  for (let frame = 0; frame < sr; frame += 128) {
    sandbox.currentFrame = frame;
    proc.process([], [[block]]);
    if (frame > 0.2 * sr) for (const x of block) (sum += x * x), n++;
  }
  return Math.sqrt(sum / n);
}

describe('pulseBoomCut', () => {
  const p = { engineSound: 'pulse', pulseRefRpm: 1000, pulseBoomFreq: 110 };

  it('takes a boom at its frequency out of the recording', () => {
    const ratio = render(110, { ...p, pulseBoomCut: 12 }) / render(110, { ...p, pulseBoomCut: 0 });
    expect(ratio).toBeLessThan(0.4);
  });

  it('leaves the rest of the sound alone', () => {
    const ratio = render(600, { ...p, pulseBoomCut: 12 }) / render(600, { ...p, pulseBoomCut: 0 });
    expect(ratio).toBeGreaterThan(0.85);
  });
});
