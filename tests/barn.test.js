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
  barnDoors,
  floorBlend,
  offTemperature,
} from '../src/world/barn.js';

const L = LAYOUT;
const b = L.barn;
const engine = { warmFloor: 0.25, coolFactor: 2.5 };


describe('the walls', () => {
  it('are big enough to drive a quad through the door', () => {
    expect(b.door.halfWidth * 2).toBeGreaterThan(3);
    expect(b.door.height).toBeGreaterThan(2.5);
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

describe('the fittings in and round the barn', () => {
  const s = barnShape(L);
  it('keeps the fittings that moved outside the walls, and the generator and silage off the building', () => {
    expect(insideBarn(L, L.generator.x, L.generator.z, -0.5)).toBe(false);
    expect(underRoof(L, L.generator.x, L.generator.z)).toBe(false);
    expect(underRoof(L, L.bell.x, L.bell.z)).toBe(false);
    expect(underRoof(L, L.silage.x + 5, L.silage.z)).toBe(false);
    expect(insideBarn(L, L.helmetHooks.stand.x, L.helmetHooks.stand.z)).toBe(true);
    expect(insideBarn(L, L.jumperRail.stand.x, L.jumperRail.stand.z)).toBe(true);
  });
});
