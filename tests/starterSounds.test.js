import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as specs from '../src/vehicle/quadSpecs.js';
import { DEFAULT_AUDIO_PARAMS } from '../src/audio/audioParams.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const allSpecs = Object.values(specs).flatMap((v) => (Array.isArray(v) ? v : [v])).filter((s) => s?.id && s?.name && s?.audio);
const bankOf = (spec) => JSON.parse(readFileSync(`public/audio/${spec.audio.recBank ?? DEFAULT_AUDIO_PARAMS.recBank}.json`, 'utf8'));

describe('starter sounds', () => {
  it('every vehicle has the starter it asks for in its bank', () => {
    for (const spec of allSpecs) {
      const set = spec.audio.recStarterSet ?? '';
      const shots = bankOf(spec).oneshots;
      expect(shots[`starterEngage${set}`], `${spec.id}: starterEngage${set}`).toBeTruthy();
      expect(shots[`crankLoop${set}`], `${spec.id}: crankLoop${set}`).toBeTruthy();
    }
  });

  it('the UTV, the Series and the 200TDi have starters of their own, looping at their own cranking speed', () => {
    const byId = Object.fromEntries(allSpecs.map((s) => [s.id, s]));
    for (const id of ['utv', 'landrover', 'landrover200']) {
      const spec = byId[id];
      const loop = bankOf(spec).oneshots[`crankLoop${spec.audio.recStarterSet ?? ''}`];
      const crankRpm = spec.engine?.crankRpm ?? DEFAULT_ENGINE_PARAMS.crankRpm;
      expect(loop.crankRpm, id).toBe(crankRpm);
      expect(loop.gain, id).toBeGreaterThan(0);
    }
    // Not each other's, nor a quad's.
    const loops = ['utv', 'landrover200'].map((id) => bankOf(byId[id]).oneshots[`crankLoop${byId[id].audio.recStarterSet ?? ''}`].start);
    expect(new Set(loops).size).toBe(2);
  });
});
