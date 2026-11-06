import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { dutchBarnShape, dutchBarnScreens } from '../src/world/outbuildings.js';
import { canSee, hedgeBlocks, buildingBlocks } from '../src/npc/sight.js';

const at = (x, z, y = 1.5) => ({ x, y, z });
const hedge = { x1: -50, z1: 10, x2: 50, z2: 10, alongX: true, length: 100, gaps: [{ at: 20, half: 3 }] };
const barn = { minX: 0, maxX: 10, minZ: 0, maxZ: 8, door: { x: 10, z: 4, halfWidth: 1.5 } };

describe('sight', () => {
  it('is blocked by a hedge, but not through its gap or along the same side', () => {
    expect(hedgeBlocks([hedge], at(0, 5), at(0, 15))).toBe(true);
    expect(hedgeBlocks([hedge], at(19, 5), at(21, 15))).toBe(false);
    expect(hedgeBlocks([hedge], at(0, 5), at(30, 6))).toBe(false);
  });

  it('is blocked by a building, from behind it', () => {
    expect(buildingBlocks([barn], at(-5, 4), at(15, 4))).toBe(true);
    expect(buildingBlocks([barn], at(-5, 4), at(-5, 12))).toBe(false);
  });

  it('sees into the barn only through the doorway', () => {
    expect(buildingBlocks([barn], at(5, 4), at(20, 4))).toBe(false);
    expect(buildingBlocks([barn], at(5, 4), at(20, 4.5))).toBe(false);
    expect(buildingBlocks([barn], at(5, 1), at(20, 1))).toBe(true);
    expect(buildingBlocks([barn], at(5, 4), at(5, -6))).toBe(true);
    expect(buildingBlocks([barn], at(2, 2), at(8, 6))).toBe(false); // both inside
  });

  it('asks the vehicles last', () => {
    const asked = [];
    const world = { hedges: [hedge], buildings: [barn], blockedBy: (a, b) => (asked.push(1), true) };
    expect(canSee(at(0, 5), at(0, 15), world)).toBe(false);
    expect(asked).toEqual([]);
    expect(canSee(at(-5, 20), at(-5, 25), world)).toBe(false);
    expect(asked).toEqual([1]);
    expect(canSee(at(-5, 20), at(-5, 25), { ...world, blockedBy: () => false })).toBe(true);
  });

  it('hides you behind the Dutch barn\'s back and bale stack but not in front of it', () => {
    const b = dutchBarnShape(LAYOUT);
    const screens = dutchBarnScreens(b);
    const mid = (b.outer.minX + b.outer.maxX) / 2;
    const behind = at(mid, b.outer.minZ - 5);
    const front = at(mid, b.outer.maxZ + 5);
    expect(buildingBlocks(screens, behind, front)).toBe(true);
    expect(buildingBlocks(screens, at(b.outer.minX - 3, b.outer.maxZ + 3), at(b.outer.minX - 3, b.outer.maxZ + 9))).toBe(false);
    expect(buildingBlocks(screens, at(b.outer.minX + 0.5, b.outer.maxZ + 3), at(b.outer.minX - 4, b.outer.maxZ + 3))).toBe(false); // open west end
    expect(dutchBarnScreens(null)).toEqual([]);
  });
});
