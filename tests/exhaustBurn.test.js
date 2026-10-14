import { describe, it, expect } from 'vitest';
import { exhaustSideOf, pipeHeat, dismountSideFor, burns } from '../src/npc/exhaustBurn.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const p = { exhaustSideChance: 0.3, burnFrom: 0.35, burnChance: 0.8 };

describe('exhaust burn', () => {
  it('finds the pipe on the right of a quad and nowhere on the big vehicles', () => {
    expect(exhaustSideOf({})).toBe(-1);
    expect(exhaustSideOf({ exhaustSide: 1 })).toBe(1);
    for (const k of ['tractor', 'landRover', 'utv', 'car']) expect(exhaustSideOf({ [k]: true })).toBe(0);
    expect(exhaustSideOf({ driverStand: { x: -1, z: 0 } })).toBe(0);
  });
  it('reads the pipe heat from the engine', () => {
    expect(pipeHeat({ heat: 0.2, soak: 0.7 })).toBe(0.7);
    expect(pipeHeat({})).toBe(0);
    expect(pipeHeat(null)).toBe(0);
  });
  it('only swings off the exhaust side by chance', () => {
    expect(dismountSideFor({ side: 1, exhaustSide: -1, p, random: () => 0.1 })).toBe(-1);
    expect(dismountSideFor({ side: 1, exhaustSide: -1, p, random: () => 0.9 })).toBe(1);
    expect(dismountSideFor({ side: 1, exhaustSide: 0, p, random: () => 0 })).toBe(1);
  });
  it('burns only on the pipe side and only when hot', () => {
    expect(burns({ side: 1, exhaustSide: -1, heat: 1, p, random: () => 0 })).toBe(false);
    expect(burns({ side: -1, exhaustSide: -1, heat: 0.2, p, random: () => 0 })).toBe(false);
    expect(burns({ side: -1, exhaustSide: -1, heat: 0.9, p, random: () => 0.1 })).toBe(true);
    expect(burns({ side: -1, exhaustSide: -1, heat: 0.9, p, random: () => 0.99 })).toBe(false);
    expect(burns({ side: -1, exhaustSide: -1, heat: 0, p, forced: true })).toBe(true);
  });
  it('is Jess who does it, never Amy', () => {
    const amy = { ...DEFAULT_COMPANION_PARAMS, ...CHARACTERS.find((c) => c.id === 'amy').params };
    const jess = { ...DEFAULT_COMPANION_PARAMS, ...CHARACTERS.find((c) => c.id === 'jess').params };
    expect(amy.exhaustSideChance).toBe(0);
    expect(amy.burnChance).toBe(0);
    expect(jess.exhaustSideChance).toBeGreaterThan(0);
    expect(jess.burnChance).toBeGreaterThan(0);
  });
});
