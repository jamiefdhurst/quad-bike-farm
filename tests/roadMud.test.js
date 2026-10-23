import { describe, it, expect } from 'vitest';
import { RoadMud, RoadMudSet, DEFAULT_ROAD_MUD_PARAMS as P } from '../src/world/roadMud.js';

// A road along x from 0 to 100 at z = 0, 4 m wide.
const tarmacAt = (x, z) => (x >= 0 && x <= 100 && Math.abs(z) < 2 ? 1 : 0);
const fresh = () => new RoadMud({ bounds: { minX: -5, maxX: 105, minZ: -4, maxZ: 4 }, tarmacAt });

// Rolls a tyre carrying `load` from x0 to x1 along z, a metre at a time, over ground `mud` muddy (off the road). Returns the load.
const ride = (m, load, x0, x1, z = 0, mud = 0) => {
  const step = Math.sign(x1 - x0);
  for (let x = x0; x !== x1; x += step) load = m.roll(load, x, z, 1, mud);
  return load;
};

describe('mud carried onto the road', () => {
  it('loads a tyre with mud on the track, and wipes a little off on grass', () => {
    const m = fresh();
    const loaded = ride(m, 0, -40, -30, 10, 1);
    expect(loaded).toBeGreaterThan(0.9);
    expect(ride(m, 0, -40, -30, 10, 0.2)).toBe(0); // dry grass picks up nothing
    const wiped = ride(m, loaded, -30, -10, 10, 0);
    expect(wiped).toBeLessThan(loaded);
    expect(wiped).toBeGreaterThan(loaded * 0.5);
  });

  it('sheds it over the first stretch of tarmac, thickest where it comes on', () => {
    const m = fresh();
    const left = ride(m, 1, 0, 100);
    expect(left).toBeLessThan(0.02);
    const first = m.smearAt(2.5, 0);
    expect(first).toBeGreaterThan(0.1);
    expect(m.smearAt(30, 0)).toBeLessThan(first);
    expect(m.smearAt(80, 0)).toBeLessThan(first * 0.1);
    // Most of it is down by 60 m.
    const after60 = ride(fresh(), 1, 0, 60);
    expect(after60).toBeLessThan(0.1);
    // Only on the tyre's line.
    expect(m.smearAt(2.5, 1.8)).toBe(0);
  });

  it('counts the smear as mud, and the rain washes it off', () => {
    const m = fresh();
    for (let k = 0; k < 6; k++) ride(m, 1, 0, 40);
    const smear = m.smearAt(1.5, 0);
    expect(m.mudAt(1.5, 0)).toBeCloseTo(smear * P.grip);
    const dry = fresh();
    for (let k = 0; k < 6; k++) ride(dry, 1, 0, 40);
    for (let t = 0; t < 120; t++) {
      m.update(1, 1);
      dry.update(1, 0);
    }
    expect(m.smearAt(1.5, 0)).toBeLessThan(smear - 0.4);
    expect(dry.smearAt(1.5, 0)).toBeGreaterThan(smear - 0.02);
  });

  it('packs the smears for the shader, a row per z', () => {
    const m = fresh();
    ride(m, 1, 0, 10);
    m.pack();
    const ix = Math.round((1.5 - m.minX) / m.cell - 0.5);
    const iz = Math.round((0 - m.minZ) / m.cell - 0.5);
    expect(m.data[(iz * m.nx + ix) * 4]).toBeGreaterThan(20);
    expect(m.packed).toBe(true);
  });
});

describe('mud on more than one stretch of road', () => {
  // The first road is as above; a second runs along z from 50 to 150 at x = 200.
  const lane = (x, z) => (Math.abs(x - 200) < 2 && z >= 50 && z <= 150 ? 1 : 0);
  const both = (x, z) => Math.max(tarmacAt(x, z), lane(x, z));
  const set = () =>
    new RoadMudSet([
      new RoadMud({ bounds: { minX: -5, maxX: 105, minZ: -4, maxZ: 4 }, tarmacAt: both }),
      new RoadMud({ bounds: { minX: 197, maxX: 203, minZ: 50, maxZ: 150 }, tarmacAt: both }),
    ]);

  it('sheds a loaded tyre onto the second road and reads it back there only', () => {
    const m = set();
    let load = 1;
    for (let z = 50; z < 80; z++) load = m.roll(load, 200, z, 1, 0);
    expect(load).toBeLessThan(0.3);
    expect(m.smearAt(200, 52.5)).toBeGreaterThan(0.05);
    expect(m.mudAt(200, 52.5)).toBeGreaterThan(0);
    expect(m.smearAt(50, 0)).toBe(0);
    expect(m.main.smearAt(200, 52.5)).toBe(0);
  });

  it('washes every grid in the rain', () => {
    const m = set();
    m.roll(1, 200, 51, 1, 0);
    const before = m.smearAt(200, 51);
    m.update(60, 1);
    expect(m.smearAt(200, 51)).toBeLessThan(before);
  });
});
