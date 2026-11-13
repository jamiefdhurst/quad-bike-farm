import { describe, it, expect } from 'vitest';
import { SmokeSense, smokeLevel, inPlume, DEFAULT_SMOKE_PARAMS as P } from '../src/npc/smokeSense.js';
import { AMY_SMOKE_LINES, JESS_SMOKE_LINES } from '../src/npc/smokeLines.js';

// A quad at the origin facing +z (north on the map), so its pipe is just behind it.
const quad = (o = {}) => ({ id: 'hornet', x: 0, z: 0, yaw: 0, twoStroke: true, running: true, throttle: 0.5, temperature: 0.8, ...o });
const still = { x: 0, z: 0 };
const girl = (id, o = {}) => ({ id, x: 0, z: -4, free: true, ...o });
const run = (s, c, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.25) events.push(...s.update(0.25, c));
  return events;
};

describe('two-stroke smoke', () => {
  it('only a running two-stroke smokes, more when cold or on the throttle', () => {
    expect(smokeLevel(quad({ twoStroke: false }))).toBe(0);
    expect(smokeLevel(quad({ running: false }))).toBe(0);
    expect(smokeLevel(quad({ throttle: 1 }))).toBeGreaterThan(smokeLevel(quad({ throttle: 0 })));
    expect(smokeLevel(quad({ temperature: 0 }))).toBeGreaterThan(smokeLevel(quad({ temperature: 1 })));
  });

  it('in still air the smoke hangs behind the quad, not in front of it or far off', () => {
    expect(inPlume({ x: 0, z: -4 }, quad(), still, P)).toBe(true);
    expect(inPlume({ x: 0, z: 6 }, quad(), still, P)).toBe(false);
    expect(inPlume({ x: 0, z: -40 }, quad(), still, P)).toBe(false);
    expect(inPlume({ x: 6, z: -4 }, quad(), still, P)).toBe(false);
  });

  it('with a wind it carries downwind, whichever way the quad faces', () => {
    const east = { x: 2, z: 0 };
    expect(inPlume({ x: 5, z: 0 }, quad(), east, P)).toBe(true);
    expect(inPlume({ x: -5, z: 0 }, quad(), east, P)).toBe(false); // upwind
    expect(inPlume({ x: 0, z: -4 }, quad(), east, P)).toBe(false); // behind it, but the wind's the other way
  });

  it('Amy coughs after a moment in it, and not again for a while', () => {
    const s = new SmokeSense({ ...P });
    const c = { wind: still, girls: [girl('amy')], quads: [quad()] };
    expect(run(s, c, 1)).toEqual([]);
    expect(run(s, c, 1)).toEqual([{ type: 'cough', girl: 'amy', spec: 'hornet' }]);
    expect(run(s, c, P.coughGap - 3)).toEqual([]);
  });

  it('Jess likes it instead', () => {
    const s = new SmokeSense({ ...P });
    const events = run(s, { wind: still, girls: [girl('jess')], quads: [quad()] }, 3);
    expect(events).toEqual([{ type: 'love', girl: 'jess', spec: 'hornet' }]);
  });

  it('not when she is busy, upwind, or it is a four-stroke', () => {
    const s = () => new SmokeSense({ ...P });
    expect(run(s(), { wind: still, girls: [girl('amy', { free: false })], quads: [quad()] }, 5)).toEqual([]);
    expect(run(s(), { wind: still, girls: [girl('amy', { z: 6 })], quads: [quad()] }, 5)).toEqual([]);
    expect(run(s(), { wind: still, girls: [girl('amy')], quads: [quad({ twoStroke: false })] }, 5)).toEqual([]);
  });

  it('has lines for coughing, loving it and following', () => {
    expect(AMY_SMOKE_LINES.smokeCough.lines.length).toBeGreaterThan(0);
    expect(JESS_SMOKE_LINES.smokeLove.length).toBeGreaterThan(0);
    expect(AMY_SMOKE_LINES.followSmoke.lines.length).toBeGreaterThan(0);
  });
});
