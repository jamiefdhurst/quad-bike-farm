import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as specs from '../src/vehicle/quadSpecs.js';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const allSpecs = Object.values(specs).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.name && s?.audio);
const bankOf = (spec) => JSON.parse(readFileSync(`public/audio/${spec.audio.recBank ?? DEFAULT_AUDIO_PARAMS.recBank}.json`, 'utf8'));

describe('starter sounds', () => {
  it('every vehicle has a starter in its bank', () => {
    for (const spec of allSpecs) {
      const shots = bankOf(spec).oneshots;
      expect(shots.starterEngage, `${spec.id}: starterEngage`).toBeTruthy();
      expect(shots.crankLoop, `${spec.id}: crankLoop`).toBeTruthy();
    }
  });

  it('the UTV, the Tor and the 200TDi have starters of their own, looping at their own cranking speed', () => {
    const byId = Object.fromEntries(allSpecs.map((s) => [s.id, s]));
    for (const id of ['yak', 'tor', 'crag']) {
      const spec = byId[id];
      const loop = bankOf(spec).oneshots.crankLoop;
      const crankRpm = spec.engine?.crankRpm ?? DEFAULT_ENGINE_PARAMS.crankRpm;
      expect(loop.crankRpm, id).toBe(crankRpm);
      expect(loop.gain, id).toBeGreaterThan(0);
    }
    // Each from a bank of its own.
    expect(new Set(['yak', 'tor', 'crag'].map((id) => byId[id].audio.recBank)).size).toBe(3);
  });
});
