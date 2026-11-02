import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS } from '../src/vehicle/faults.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { EngineModel } from '../src/engine/engineModel.js';

describe('corroded battery terminals', () => {
  it('starts from running and the wire brush clears it fully in the yard', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0);
    f.update(1, { running: true, speed: 0, throttle: 0 });
    expect(f.has('terminals')).toBe(true);
    expect(f.fix('terminals', { rough: true })).toBe(true);
    expect(f.has('terminals')).toBe(false);
    expect(f.levels.terminals).toBe(0);
  });

  it('has nothing to corrode without a battery', () => {
    const f = new Faults({ ...DEFAULT_FAULT_PARAMS }, () => 0);
    f.hasBattery = false;
    f.begin('terminals');
    expect(f.terminalCorrosion).toBe(0);
  });

  it('starves the starter while the battery stays full', () => {
    const e = new EngineModel(DEFAULT_ENGINE_PARAMS);
    const p = e.params;
    e.terminals = p.terminalsSlowFrom + 0.1;
    expect(e.starterDead).toBe(false);
    expect(e.crankFactor).toBeLessThan(1);
    e.terminals = p.terminalsClickAt;
    expect(e.starterDead).toBe(true);
    expect(e.battery).toBe(1);
  });
});
