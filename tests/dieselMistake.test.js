import { describe, it, expect } from 'vitest';
import { DieselMistake, DEFAULT_DIESEL_MISTAKE_PARAMS as P } from '../src/npc/dieselMistake.js';

const jess = { id: 'jess', free: true, x: 0, z: 0 };
const quad = (over = {}) => ({ id: 'red', x: 5, z: 0, speed: 0, rider: false, driver: null, tipped: false, space: 6, level: 0.3, ...over });
const run = (m, seconds, ctx) => {
  const events = [];
  for (let t = 0; t < seconds; t += 1) events.push(...m.update(1, ctx));
  return events;
};
const always = () => 0;

describe('Jess and the diesel can', () => {
  it('waits until the game is a few minutes old', () => {
    const m = new DieselMistake({ ...P }, always);
    expect(run(m, P.startAfter - 5, { girls: [jess], quads: [quad()] })).toEqual([]);
    expect(run(m, 10, { girls: [jess], quads: [quad()] })[0]).toEqual({ type: 'go', girl: 'jess', spec: 'red' });
  });

  it('picks the quad that is lowest on fuel, parked, and has room for what she pours', () => {
    const m = new DieselMistake({ ...P, startAfter: 0 }, always);
    const quads = [quad({ id: 'full', level: 0.9 }), quad({ id: 'rode', rider: true, level: 0.1 }), quad({ id: 'tight', space: 1, level: 0.1 }), quad({ id: 'low', level: 0.2 }), quad({ id: 'lower', level: 0.1 })];
    expect(m.update(1, { girls: [jess], quads })[0].spec).toBe('lower');
  });

  it('does nothing if no quad is low on fuel or near enough, or Jess is busy', () => {
    const m = new DieselMistake({ ...P, startAfter: 0 }, always);
    expect(m.update(1, { girls: [jess], quads: [quad({ level: 0.9 })] })).toEqual([]);
    expect(m.update(1, { girls: [jess], quads: [quad({ x: 100 })] })).toEqual([]);
    expect(m.update(1, { girls: [{ ...jess, free: false }], quads: [quad()] })).toEqual([]);
  });

  it('never sends Amy', () => {
    const m = new DieselMistake({ ...P, startAfter: 0 }, always);
    expect(m.update(1, { girls: [{ ...jess, id: 'amy' }], quads: [quad()] })).toEqual([]);
  });

  it('is one job at a time, and forgets it if she never gets there; then there is a cooldown', () => {
    const m = new DieselMistake({ ...P, startAfter: 0 }, always);
    const ctx = { girls: [jess], quads: [quad()] };
    expect(m.update(1, ctx)).toHaveLength(1);
    expect(m.update(1, ctx)).toEqual([]);
    expect(run(m, P.jobTimeout + 2, ctx)).toEqual([]);
    expect(run(m, P.cooldown - 10, ctx)).toEqual([]);
    expect(run(m, 20, ctx)).toHaveLength(1);
  });

  it('can be forced from the debug panel at once, even for a quad that is not low', () => {
    const m = new DieselMistake({ ...P }, () => 0.99);
    m.forced = true;
    expect(m.update(1, { girls: [jess], quads: [quad({ level: 0.95 })] })).toHaveLength(1);
    expect(m.forced).toBe(false);
  });
});
