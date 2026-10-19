import { describe, it, expect } from 'vitest';
import { standOff, sightsFrom, gatesFoundOpen, pickSight, DEFAULT_SIGHT_PARAMS as P } from '../src/npc/sights.js';
import { AMY_SIGHT_LINES, JESS_SIGHT_LINES } from '../src/npc/sightLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';

describe('standing off', () => {
  it('stops short of the thing on the near side', () => {
    const at = standOff({ x: 0, z: 0 }, { x: 0, z: 30 }, 7);
    expect(at.x).toBeCloseTo(0);
    expect(at.z).toBeCloseTo(23);
  });

  it('stays put when already closer than that', () => {
    expect(standOff({ x: 0, z: 25 }, { x: 0, z: 30 }, 7)).toEqual({ x: 0, z: 25 });
  });
});

describe('what there is to see', () => {
  const gates = [{ id: 'south', x: 1, z: 1, isOpen: true }, { id: 'road', x: 50, z: 0, isOpen: true }, { id: 'grid', x: 9, z: 9, isOpen: false }];

  it('counts only a gate that is usually shut and is open now', () => {
    expect(gatesFoundOpen(gates)).toEqual([{ x: 50, z: 0 }]);
  });

  it('lists each sight with where she stops, what she points at and what she says', () => {
    const found = { gates: [{ x: 50, z: 0 }], view: { x: 5, z: 6, look: { x: 5, z: 56 } }, running: [{ x: 0, z: 40, line: 'leftRunningYou' }] };
    const list = sightsFrom({ x: 0, z: 0 }, found, P);
    expect(list.map((s) => s.kind)).toEqual(['gate', 'view', 'running']);
    expect(list[0].x).toBeCloseTo(50 - P.standOff);
    expect(list[0].look).toEqual({ x: 50, z: 0 });
    expect(list[1]).toMatchObject({ x: 5, z: 6, line: 'sightView' });
    expect(list[2].line).toBe('leftRunningYou');
  });

  it('is empty when nothing is up', () => {
    expect(sightsFrom({ x: 0, z: 0 }, { gates: [], view: null, running: [] }, P)).toEqual([]);
  });
});

describe('picking one', () => {
  const sights = [{ kind: 'gate', name: 'the open gate', x: 0, z: 60, look: { x: 0, z: 67 }, line: 'sightGate' }, { kind: 'view', name: 'the view', x: 0, z: 5, look: { x: 0, z: 50 }, line: 'sightView' }];
  const direct = (_from, to) => [to];

  it('skips one too near, and one with no way there', () => {
    expect(pickSight({ x: 0, z: 0 }, sights, direct, () => true, () => 0, P).name).toBe('the open gate');
    expect(pickSight({ x: 0, z: 0 }, sights, direct, () => false, () => 0, P)).toBeNull();
  });

  it('carries the sight with it', () => {
    expect(pickSight({ x: 0, z: 0 }, sights, direct, () => true, () => 0, P).spot).toBe(sights[0]);
  });
});

describe('lines', () => {
  it('both girls have something to say for each, and they are in the main banks', () => {
    for (const k of ['sightGo', 'sightGate', 'sightView']) {
      expect(AMY_SIGHT_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_SIGHT_LINES[k].length).toBeGreaterThan(0);
      expect(VOICE_LINES[k]).toBeDefined();
    }
  });
});
