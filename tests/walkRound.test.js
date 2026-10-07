import { describe, it, expect } from 'vitest';
import { walkRound, DEFAULT_WALK_PARAMS as P, WALK_FINDINGS } from '../src/npc/walkRound.js';
import { AMY_WALK_LINES } from '../src/npc/walkLines.js';
import { VOICE_LINES as AMY_LINES } from '../src/npc/voiceLines.js';
import { Faults } from '../src/vehicle/faults.js';
import { TyreSet } from '../src/vehicle/tyres.js';

const always = () => 0;
const never = () => 0.99;
const sound = () => ({ tyres: new TyreSet(), faults: new Faults() });

describe('walkRound', () => {
  it('finds nothing on a sound quad', () => {
    expect(walkRound({ ...sound(), random: always }, P)).toEqual([]);
  });

  it('finds a slow puncture, and does not also call the tyre soft', () => {
    const q = sound();
    q.faults.leave('puncture', 0.5);
    q.tyres.psi = [2, 4, 4, 4];
    expect(walkRound({ ...q, random: always }, P)).toEqual(['walkPuncture']);
  });

  it('misses a puncture that has barely started', () => {
    const q = sound();
    q.faults.leave('puncture', 0.05);
    expect(walkRound({ ...q, random: always }, P)).toEqual([]);
  });

  it('notices a soft tyre with no puncture', () => {
    const q = sound();
    q.tyres.psi = [4, 4, 2.5, 4];
    expect(walkRound({ ...q, random: always }, P)).toEqual(['walkSoftTyre']);
  });

  it('ignores the hidden outrigger wheels of a two-wheeler', () => {
    const q = sound();
    q.tyres.useLayout([{ front: true, x: 0 }, { front: false, x: 0 }, { front: true, x: 1, outrigger: true }, { front: false, x: -1, outrigger: true }]);
    q.tyres.psi = [4, 4, 1.5, 1.5];
    expect(walkRound({ ...q, random: always }, P)).toEqual([]);
  });

  it('can miss things, by chance', () => {
    const q = sound();
    q.faults.leave('puncture', 0.5);
    q.faults.leave('belt', 0.6);
    expect(walkRound({ ...q, random: never }, P)).toEqual([]);
  });

  it('spots a developed belt, cable or carb fault but not a mild one, and says no more than the limit', () => {
    const q = sound();
    q.faults.leave('belt', 0.2);
    expect(walkRound({ ...q, random: always }, P)).toEqual([]);
    q.faults.leave('belt', 0.6);
    q.faults.leave('cable', 0.6);
    q.faults.leave('carb', 0.6);
    q.faults.leave('puncture', 0.6);
    const found = walkRound({ ...q, random: always }, P);
    expect(found).toEqual(['walkPuncture', 'walkBelt']);
    expect(found.length).toBe(P.maxSaid);
  });
});

describe('walk-round lines', () => {
  it('has a line for every finding, in Amy\'s main set', () => {
    for (const key of WALK_FINDINGS) {
      expect(AMY_WALK_LINES[key].lines.length).toBeGreaterThan(0);
      expect(AMY_LINES[key]).toBeDefined();
    }
  });
});
