import { describe, it, expect } from 'vitest';
import { createHost } from '../src/console/gameHost.js';

// `tp me to <place>` on the new farm (#949): one place per field by its key, but the wood and the pit, which are still where they were until
// #683 and #685 move them, go to the wood and the pit, not to the plan's empty fields of the same names.
const square = (x, z) => [[x, z], [x + 40, z], [x + 40, z + 40], [x, z + 40]];
const fields = [
  { name: 'wood', kind: 'wood', points: square(-300, -200) },
  { name: 'pit', kind: 'rough', points: square(200, -200) },
  { name: 'top', kind: 'arable', points: square(0, -200) },
];

const standIn = () => {
  const layout = {
    spawn: { player: { x: 1, z: 2 } },
    woods: { gate: { x: 10, z: 11 }, leadIn: [[0, 0], [0, 30]], circuit: { points: [[12, 13]] } },
    fields,
  };
  const g = {
    units: [],
    companions: [],
    world: { heightAt: () => 0, layout, fields: { polygons: Object.fromEntries(fields.map((f) => [f.name, f.points])) } },
    trafficHost: { places: { rig: { stand: { x: 0, z: 0 } } } },
    villageHost: {},
  };
  return createHost(g);
};

describe('tp places on the new farm', () => {
  it('has a place for every field by its key, in the field', () => {
    const places = standIn().places();
    expect(places.top.x).toBeGreaterThan(0);
    expect(places.top.x).toBeLessThan(40);
    expect(places.top.z).toBeGreaterThan(-200);
    expect(places.top.z).toBeLessThan(-160);
  });
  it('keeps the wood\'s place at the wood\'s gate, not in the plan\'s empty wood field', () => {
    expect(standIn().places().wood).toEqual({ x: 10, z: 30 });
  });
  it('has no pit place while there is no pit built, rather than the plan\'s empty pit field', () => {
    expect(standIn().places().pit).toBeUndefined();
  });
});
