import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them.
function loadWorklet(sampleRate) {
  const sandbox = {
    sampleRate,
    currentFrame: 0,
    registerProcessor: () => {},
    AudioWorkletProcessor: class {
      constructor() {
        this.posted = [];
        this.port = { postMessage: (m) => this.posted.push(m) };
      }
    },
  };
  vm.createContext(sandbox);
  const src = readFileSync('src/audio/engineWorklet.js', 'utf8');
  vm.runInContext(`${src}\n;this.RecordedEngine = RecordedEngine; this.EngineProcessor = EngineProcessor;`, sandbox);
  return sandbox;
}

describe('engine worklet', () => {
  it('never reads past the end of a bank decoded a sample short at 48 kHz', () => {
    const { RecordedEngine } = loadWorklet(48000);
    // The index says the shutdown runs to exactly the end of a 1 s recording at 44.1 kHz; decoded at 48 kHz it's a sample short.
    const data = new Float32Array(47999).fill(0.1);
    const bank = {
      data,
      sourceGain: { quad: 1 },
      crankRpm: 300,
      grains: [{ kind: 'idle', start: 0, dur: 0.1, tail: 0, rpm: 1200, src: 'quad', rms: 0.1 }],
      oneshots: { shutdown: { start: 0.5, dur: 0.5 } },
    };
    const rec = new RecordedEngine(bank);
    rec.playOneshot('shutdown', 1);
    const state = { rpm: 0, cranking: false };
    for (let i = 0; i < 24100; i++) expect(Number.isFinite(rec.sample(state)), `sample ${i}`).toBe(true);
  });

  it('clears a NaN out of its filters instead of going silent for good, and says so', () => {
    const { EngineProcessor } = loadWorklet(48000);
    const proc = new EngineProcessor();
    proc.onMessage({ params: { engineSound: 'synth', drive: 1, pipeLength: 0.5, pipeReflection: 0.5, pipeDamping: 0.5, blowdownMs: 2, gearTeeth: 10, gearWhineVolume: 0, toneBase: 800, toneRpm: 0, toneThrottle: 0, silencerBright: 0, mufflerFreqA: 400, mufflerQA: 1, mufflerFreqB: 900, mufflerQB: 1, intakeFreq: 300, fanVolume: 0, starterVolume: 0 } });
    proc.tone.y1 = NaN; // as if a bad sample had got in
    const out = new Float32Array(128);
    proc.process([], [[out]]);
    expect(out.every((x) => Number.isFinite(x))).toBe(true);
    expect(proc.posted.some((m) => m.warn)).toBe(true);
    // And it carries on making sound afterwards rather than staying stuck.
    proc.process([], [[out]]);
    expect(out.every((x) => Number.isFinite(x))).toBe(true);
  });
});
