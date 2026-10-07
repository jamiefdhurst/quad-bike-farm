import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// The worklet runs on the audio thread with its own globals, so load it in a sandbox that provides them.
function loadWorklet(sampleRate) {
  const sandbox = { sampleRate, currentFrame: 0, registerProcessor: () => {}, AudioWorkletProcessor: class {} };
  vm.createContext(sandbox);
  const src = readFileSync('src/audio/engineWorklet.js', 'utf8');
  vm.runInContext(`${src}\n;this.RecordedEngine = RecordedEngine;`, sandbox);
  return sandbox;
}

const PARAMS = {
  engineSound: 'pulse',
  recIdleSource: 'quad',
  pulseCleanUp: 1.3,
  pulseRefRpm: 1800,
  pulseRevLoudness: 0.4,
  pulseLoudnessCap: 2,
  pulsePitchFollow: 0,
  pulseCrossfade: 0.4,
  recVolume: 1,
  recThrottleLoudness: 0,
  recOverlap: 0.05,
  recMinGrainMs: 32,
  recLevelling: 0.5,
  recFollow: 0.08,
  recMisfireBody: 0.3,
  recMisfireAttack: 0.1,
};

// A two-stroke idle cut in lumps of two slices, as the moto's bank is: a bang slice then a quiet one, each 30 ms (4,000 by
// the bank's rpm measure, a two-stroke at 2,000 rpm), back to back in recording order.
function slicedBank() {
  const grains = [];
  for (let i = 0; i < 40; i++) {
    grains.push({ kind: 'idle', start: i * 0.03, dur: 0.03, tail: 0, rpm: 4000, src: 'der', rms: i % 2 ? 0.1 : 0.2, slice: i % 2 });
  }
  return { data: new Float32Array(44100 * 2).fill(0.1), sourceGain: { der: 1 }, crankRpm: 300, grains, oneshots: {}, readThrough: true };
}

function slicesPlayed(rec, rpm, firings) {
  const bySample = new Map(rec.byKind.idle.map((g) => [g.start, g.slice]));
  const out = [];
  for (let i = 0; i < firings; i++) {
    rec.trigger({ type: 'fire', strength: 1, period: 60 / rpm }, PARAMS, rpm, 0);
    out.push(bySample.get(rec.voices[rec.voices.length - 1].start));
  }
  return out;
}

describe('a two-stroke idle cut in slices', () => {
  it('reads through its slices in order at idle, so it bangs every other turn as recorded', () => {
    const { RecordedEngine } = loadWorklet(44100);
    const played = slicesPlayed(new RecordedEngine(slicedBank()), 2000, 12);
    // Wherever it starts, it then alternates bang and quiet.
    for (let i = 1; i < played.length; i++) expect(played[i]).toBe(1 - played[i - 1]);
  });

  it('plays only the bangs once well above the recorded idle, so it fires every turn', () => {
    const { RecordedEngine } = loadWorklet(44100);
    // The engine model's period is one turn for a two-stroke; 3,000 rpm is 6,000 by the bank's measure, past 1.3 x 4,000.
    const played = slicesPlayed(new RecordedEngine(slicedBank()), 3000, 12);
    expect(played.every((s) => s === 0)).toBe(true);
  });
});
