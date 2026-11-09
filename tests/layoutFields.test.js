import { describe, it, expect } from 'vitest';
import { createFields } from '../src/world/fields.js';

// A layout that says what its fields are (#662), with nothing else of the old farm in it: no road, hill, wood, quarry, village or gate. A small
// farm with a slanting corner, three fields, a hedge that bends, a wall and two gateways.
const layout = {
  outline: [[0, 0], [100, 0], [100, 60], [60, 100], [0, 100]],
  fields: [
    { name: 'west', kind: 'grass', points: [[0, 0], [50, 0], [44, 50], [50, 100], [0, 100]] },
    { name: 'ne', kind: 'arable', points: [[50, 0], [100, 0], [100, 50], [44, 50]] },
    { name: 'se', kind: 'hay', points: [[44, 50], [100, 50], [100, 60], [60, 100], [50, 100]] },
  ],
  boundaries: [
    { points: [[50, 0], [44, 50], [50, 100]], kind: 'hedge' }, // bends at (44, 50)
    { points: [[44, 50], [100, 50]], kind: 'wall' },
  ],
  gateways: [
    { a: 'west', b: 'ne', boundary: 0, at: 20, half: 2, gate: true, id: 'top', shut: false },
    { a: 'west', b: 'se', boundary: 0, at: 80, half: 2, gate: true, id: 'bottom', shut: true },
  ],
};
const f = createFields(layout);

describe('a layout that supplies its own fields', () => {
  it('builds without the old farm round it', () => {
    expect(Object.keys(f.polygons)).toEqual(['west', 'ne', 'se']);
    expect(f.kinds).toEqual({ west: 'grass', ne: 'arable', se: 'hay' });
    expect(f.farm).toEqual({ minX: 0, maxX: 100, minZ: 0, maxZ: 100 });
  });

  it('names the field a point is in, and out beyond them', () => {
    expect(f.areaOf(10, 10)).toBe('west');
    expect(f.areaOf(47, 10)).toBe('west'); // the hedge bends in: x = 48.8 at z = 10
    expect(f.areaOf(49.5, 10)).toBe('ne');
    expect(f.areaOf(80, 20)).toBe('ne');
    expect(f.areaOf(80, 70)).toBe('se');
    expect(f.areaOf(90, 90)).toBe('out');
  });

  it('is in the farm by its outline, not its box', () => {
    expect(f.inFarm(30, 30)).toBe(true);
    expect(f.inFarm(90, 90)).toBe(false); // inside the box, past the slanting corner
    expect(f.inFarm(80, 70, 0)).toBe(true);
    expect(f.outside(30, 30)).toBe(0);
    expect(f.outside(90, 90)).toBeCloseTo(20 / Math.SQRT2); // from the slanting side
  });

  it('breaks the bent hedge into its stretches, with each gap on the stretch it falls on', () => {
    expect(f.hedges).toHaveLength(2);
    expect(f.hedges[0].gaps.map((g) => g.id)).toEqual(['top']);
    expect(f.hedges[1].gaps.map((g) => g.id)).toEqual(['bottom']);
    const top = f.hedges[0];
    expect(top.gaps[0].at).toBe(20);
    // The second gap was 80 m along the whole line, 30 m on from the bend (which is 50.2 m along).
    expect(f.hedges[1].gaps[0].at).toBeCloseTo(80 - top.length);
    expect(f.gates.top).toBe(top.gaps[0]);
    expect(f.gates.bottom.shut).toBe(true);
  });

  it('routes through the gateway, and not through a shut one', () => {
    const way = f.route({ x: 10, z: 20 }, { x: 80, z: 20 });
    expect(way).toHaveLength(3);
    const at = (e, s) => ({ x: e.x1 + e.dx * s, z: e.z1 + e.dz * s });
    const mid = at(f.hedges[0], 20);
    expect(Math.hypot((way[0].x + way[1].x) / 2 - mid.x, (way[0].z + way[1].z) / 2 - mid.z)).toBeLessThan(0.5);
    expect(way[0].x).toBeLessThan(mid.x);
    expect(way[1].x).toBeGreaterThan(mid.x);
    // The other gate is shut, so there is no way to the third field: the route is just the straight line.
    expect(f.route({ x: 10, z: 80 }, { x: 80, z: 70 })).toEqual([{ x: 80, z: 70 }]);
  });

  it('stops what looks along a hedge, and what looks at the wall', () => {
    expect(f.hedgeAhead(80, 20, 0)).toBeCloseTo(30); // south from the north-east field: the wall at z = 50
    expect(f.hedgeAhead(80, 20, Math.PI)).toBe(Infinity); // north, to the farm's edge (not a boundary here)
    expect(f.hedgeAhead(10, 20, Math.PI / 2)).toBe(Infinity); // east, through the open gap in the hedge
    expect(f.hedgeAhead(10, 10, Math.PI / 2)).toBeCloseTo(38.8, 0); // east, at z = 10: into the bent hedge
  });

  it('counts a wall as something to keep off, but not as a hedge', () => {
    expect(f.hedgeDistance(70, 40)).toBeCloseTo(10);
    expect(f.hedgedAt(70, 49.8, 0.45)).toBe(true);
    expect(f.hedges.every((h) => h.kind === 'hedge')).toBe(true);
    expect(f.boundaries.map((b) => b.kind)).toEqual(['hedge', 'hedge', 'wall']);
  });

  it('refuses a gateway to a field or a boundary that is not there', () => {
    expect(() => createFields({ ...layout, gateways: [{ a: 'west', b: 'nowhere', boundary: 0, at: 5 }] })).toThrow(/no field nowhere/);
    expect(() => createFields({ ...layout, gateways: [{ a: 'west', b: 'ne', boundary: 7, at: 5 }] })).toThrow(/no boundary 7/);
  });
});
