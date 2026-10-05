import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import {
  DEFAULT_BARN_PARAMS as P,
  barnShape,
  insideBarn,
  underRoof,
  indoorLevel,
  reverbSend,
  boomFor,
  rainHeard,
  wallBoxes,
  floorBlend,
  offTemperature,
} from '../src/world/barn.js';

const L = LAYOUT;
const b = L.barn;
const engine = { warmFloor: 0.25, coolFactor: 2.5 };

describe('where the barn is', () => {
  it('is inside the walls at its centre and not outside them', () => {
    expect(insideBarn(L, b.x, b.z)).toBe(true);
    expect(insideBarn(L, b.x + b.halfX + 1, b.z)).toBe(false);
    expect(insideBarn(L, b.x, b.z + b.halfZ + 0.5)).toBe(false);
  });
  it('has a roof that overhangs the walls a little', () => {
    expect(underRoof(L, b.x + b.halfX + 0.2, b.z)).toBe(true);
    expect(underRoof(L, b.x + b.halfX + 1, b.z)).toBe(false);
    expect(insideBarn(L, b.x + b.halfX + 0.2, b.z)).toBe(false);
  });
  it('fades indoors in across the threshold and is outdoors out in the yard', () => {
    const { door } = barnShape(L);
    expect(indoorLevel(L, door.x + 2, b.z, P)).toBe(0);
    expect(indoorLevel(L, door.x - 0.2, b.z, P)).toBeGreaterThan(0);
    expect(indoorLevel(L, door.x - 0.2, b.z, P)).toBeLessThan(indoorLevel(L, door.x - 2, b.z, P));
    expect(indoorLevel(L, b.x, b.z, P)).toBe(1);
  });
});

describe('the walls', () => {
  it('leave the doorway clear and the inside open', () => {
    const { door, inner } = barnShape(L);
    const hits = (x, z) => wallBoxes(L).some((w) => Math.abs(x - w.x) < w.hx && Math.abs(z - w.z) < w.hz);
    for (let z = door.minZ + 0.05; z < door.maxZ; z += 0.25) expect(hits(door.x - 0.1, z)).toBe(false);
    expect(hits(door.x - 0.1, door.minZ - 0.3)).toBe(true);
    expect(hits(door.x - 0.1, door.maxZ + 0.3)).toBe(true);
    expect(hits(b.x - b.halfX + 0.1, b.z)).toBe(true);
    expect(hits(b.x, b.z)).toBe(false);
    expect(hits(inner.minX + 1, inner.minZ + 1)).toBe(false);
  });
  it('are big enough to drive a quad through the door', () => {
    expect(b.door.halfWidth * 2).toBeGreaterThan(3);
    expect(b.door.height).toBeGreaterThan(2.5);
  });
});

describe('what is inside', () => {
  it('has the bales and the bench within the walls, with room to stand behind each bale', () => {
    for (const [x, z, yaw] of L.barnBaleSpots) {
      expect(insideBarn(L, x, z, 0.8)).toBe(true);
      expect(insideBarn(L, x - Math.sin(yaw) * 1.65, z - Math.cos(yaw) * 1.65, 0.1)).toBe(true);
    }
    const { bench, toolbox } = L;
    expect(insideBarn(L, bench.x - bench.length / 2, bench.z - bench.depth / 2)).toBe(true);
    expect(Math.abs(toolbox.x - bench.x)).toBeLessThan(bench.length / 2);
    expect(Math.abs(toolbox.z - bench.z)).toBeLessThan(bench.depth / 2);
  });
  it('keeps the middle of the barn clear of the bales and the bench', () => {
    const { door } = barnShape(L);
    const { bench } = L;
    expect(bench.z + bench.depth / 2).toBeLessThan(door.minZ);
    for (const [, z] of L.barnBaleSpots) expect(Math.abs(z - b.z)).toBeGreaterThan(2);
  });
});

describe('sound', () => {
  it('echoes most when you and the sound are both inside, a little through the doorway, not at all outside', () => {
    expect(reverbSend(true, true, P)).toBeGreaterThan(reverbSend(true, false, P));
    expect(reverbSend(false, true, P)).toBe(reverbSend(true, false, P));
    expect(reverbSend(false, false, P)).toBe(0);
  });
  it('booms an engine only for a listener inside', () => {
    expect(boomFor(true, true, P)).toBe(P.boomDb);
    expect(boomFor(true, false, P)).toBeGreaterThan(0);
    expect(boomFor(false, true, P)).toBe(0);
  });
  it('drums the rain louder under the roof and not at all when it is dry', () => {
    expect(rainHeard(0.6, 1, P).level).toBeGreaterThan(rainHeard(0.6, 0, P).level);
    expect(rainHeard(0.6, 1, P).tin).toBe(1);
    expect(rainHeard(0.6, 0, P).tin).toBe(0);
    expect(rainHeard(0, 1, P)).toEqual({ level: 0, tin: 0 });
  });
});

describe('the ground under it', () => {
  it('is flattened under the building and eases off outside', () => {
    expect(floorBlend(L, b.x, b.z)).toBe(1);
    expect(floorBlend(L, b.x + b.halfX + 10, b.z)).toBe(0);
    const mid = floorBlend(L, b.x + b.halfX + 1, b.z);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });
});

describe('an engine parked in the barn', () => {
  const cool = (t, sheltered, seconds) => {
    for (let i = 0; i < seconds; i++) t = offTemperature(t, 1, 900, sheltered, engine);
    return t;
  };
  it('cools more slowly than one left outside', () => {
    expect(cool(1, true, 600)).toBeGreaterThan(cool(1, false, 600));
  });
  it('never goes stone cold, and never warms up by itself', () => {
    expect(cool(1, true, 20000)).toBeGreaterThan(engine.warmFloor - 0.01);
    expect(cool(1, false, 20000)).toBeLessThan(0.01);
    expect(offTemperature(0, 1, 900, true, engine)).toBe(0);
    expect(offTemperature(0.1, 1, 900, true, engine)).toBe(0.1);
  });
});
