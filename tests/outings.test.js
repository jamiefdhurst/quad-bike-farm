import { describe, it, expect } from 'vitest';
import { pickOuting, pathLength, outingSpots, DEFAULT_OUTING_PARAMS as P } from '../src/npc/outings.js';
import { LAYOUT, stripPoint } from '../src/world/layout.js';

const spots = [{ name: 'near', x: 10, z: 0 }, { name: 'mid', x: 80, z: 0 }, { name: 'far', x: 300, z: 0 }];
const direct = (_from, to) => [to];
const open = () => true;

describe('pickOuting', () => {
  it('skips places too near or too far', () => {
    const o = pickOuting({ x: 0, z: 0 }, spots, direct, open, () => 0, P);
    expect(o.name).toBe('mid');
    expect(o.path).toEqual([spots[1]]);
  });

  it('skips a place with a blocked leg on the way', () => {
    const blocked = (a, b) => b.x !== 80;
    expect(pickOuting({ x: 0, z: 0 }, spots, direct, blocked, () => 0, P)).toBeNull();
  });

  it('checks every leg of a route through gateways', () => {
    const via = (_f, to) => [{ x: 40, z: 20 }, to];
    const legs = [];
    pickOuting({ x: 0, z: 0 }, [spots[1]], via, (a, b) => (legs.push([a.x, b.x]), true), () => 0, P);
    expect(legs).toEqual([[0, 40], [40, 80]]);
  });

  it('is likelier to pick a nearer place', () => {
    const two = [{ name: 'a', x: 60, z: 0 }, { name: 'b', x: 200, z: 0 }];
    let a = 0;
    for (let i = 0; i < 400; i++) if (pickOuting({ x: 0, z: 0 }, two, direct, open, () => (i + 0.5) / 400, P).name === 'a') a++;
    expect(a).toBeGreaterThan(250);
    expect(a).toBeLessThan(400);
  });

  it('has nothing to say with no places', () => {
    expect(pickOuting({ x: 0, z: 0 }, [], direct, open, Math.random, P)).toBeNull();
  });
});

describe('pathLength', () => {
  it('adds up the legs', () => {
    expect(pathLength({ x: 0, z: 0 }, [{ x: 3, z: 4 }, { x: 3, z: 14 }])).toBe(15);
  });
});

describe('outingSpots', () => {
  it('lists named places on the farm from the layout', () => {
    const list = outingSpots(LAYOUT, { x: -27, z: 142 }, stripPoint);
    const names = list.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(['the drag strip', 'the muck heap', 'the foot of the hill', 'the end of the road']));
    for (const s of list) {
      expect(Number.isFinite(s.x) && Number.isFinite(s.z)).toBe(true);
      expect(Math.abs(s.x)).toBeLessThan(250);
    }
  });
});
