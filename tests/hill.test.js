import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createHill } from '../src/world/hill.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

const track = new Track(LAYOUT.trackPoints);
const heights = createTerrainHeight(LAYOUT, track);
const h = heights.heightAt;
const hill = createHill(LAYOUT);
const fields = createFields(LAYOUT);
const { lane, pasture } = LAYOUT.hill;

/** Steepest slope (rise over run) along a line of 1 m steps from a to b. */
function steepest(a, b) {
  const n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z));
  let best = 0;
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const x0 = a.x + (b.x - a.x) * t0;
    const z0 = a.z + (b.z - a.z) * t0;
    const x1 = a.x + (b.x - a.x) * t1;
    const z1 = a.z + (b.z - a.z) * t1;
    best = Math.max(best, Math.abs(h(x1, z1) - h(x0, z0)) / Math.hypot(x1 - x0, z1 - z0));
  }
  return best;
}

describe('the hill through the south gate', () => {
  it('leaves the farm exactly as it was', () => {
    const flat = createTerrainHeight({ ...LAYOUT, hill: undefined }, track).heightAt;
    for (let x = -80; x <= 200; x += 7) for (let z = -80; z <= 80; z += 7) expect(h(x, z)).toBe(flat(x, z));
    for (let x = -80; x <= 80; x += 2) expect(h(x, 79.9)).toBe(flat(x, 79.9));
  });

  it('fits on the detailed terrain', () => {
    expect(pasture.maxZ).toBeLessThan(LAYOUT.terrainSize / 2 - 5);
    expect(pasture.minX).toBeGreaterThan(-LAYOUT.terrainSize / 2 + 5);
  });

  it('runs the lane through the gate, sunk between its banks', () => {
    expect(LAYOUT.gate.x).toBe(lane.x);
    for (const z of [100, 115]) {
      const bed = h(lane.x, z);
      expect(h(lane.x - lane.hedgeOff, z) - bed).toBeGreaterThan(lane.sink * 0.9);
      expect(h(lane.x + lane.hedgeOff, z) - bed).toBeGreaterThan(lane.sink * 0.9);
      // A flat enough bed to ride along.
      expect(Math.abs(h(lane.x + 1, z) - h(lane.x - 1, z))).toBeLessThan(0.2);
    }
    // About 60 m from the gate to the ford, and no step through the gateway.
    expect(hill.streamZ(lane.x) - LAYOUT.fieldHalf).toBeGreaterThan(50);
    expect(steepest({ x: lane.x, z: LAYOUT.fieldHalf - 3 }, { x: lane.x, z: lane.toZ })).toBeLessThan(0.25);
  });

  it('climbs 15 to 20 m from the ford to the top', () => {
    const ford = h(lane.x, hill.farEdge(lane.x) + 1);
    let top = -Infinity;
    for (let x = pasture.minX + 3; x < pasture.maxX - 3; x += 4) top = Math.max(top, h(x, pasture.maxZ - 3));
    expect(top - ford).toBeGreaterThan(15);
    expect(top - ford).toBeLessThan(21);
    // And from the top you look down on the farm.
    expect(top - h(0, 60)).toBeGreaterThan(12);
  });

  it('has banks far steeper than anything on the farm, and a gentler way up at the east end', () => {
    let farm = 0;
    for (let x = -76; x <= 196; x += 8) farm = Math.max(farm, steepest({ x, z: -76 }, { x, z: 76 }));
    let bank = 0;
    for (let x = -60; x <= -20; x += 5) bank = Math.max(bank, steepest({ x, z: hill.farEdge(x) + 2 }, { x, z: pasture.maxZ - 2 }));
    expect(bank).toBeGreaterThan(0.6); // over 31 degrees
    expect(bank).toBeLessThan(0.85); // under 40: steep, not a cliff
    expect(bank).toBeGreaterThan(farm + 0.3);
    const east = steepest({ x: 28, z: hill.farEdge(28) + 2 }, { x: 28, z: pasture.maxZ - 2 });
    expect(east).toBeLessThan(0.5); // under 27 degrees: 18 m in under 60 m can't be much gentler
    expect(bank - east).toBeGreaterThan(0.25);
  });

  it('has no step across its hedges', () => {
    for (const hd of fields.hedges.slice(-6)) {
      for (let t = 0.05; t < 1; t += 0.1) {
        const x = hd.x1 + (hd.x2 - hd.x1) * t;
        const z = hd.z1 + (hd.z2 - hd.z1) * t;
        const a = hd.alongX ? h(x, z - 1) : h(x - 1, z);
        const b = hd.alongX ? h(x, z + 1) : h(x + 1, z);
        expect(Math.abs(a - b)).toBeLessThan(0.9);
      }
    }
  });

  it('puts water in the stream and not beside it, shallower at the ford', () => {
    for (const x of [-80, -50, lane.x, 0, 25]) {
      const sz = hill.streamZ(x);
      expect(heights.puddleAt(x, sz)).toBe(1);
      expect(heights.puddleAt(x, sz - hill.halfAt(x) - 1)).toBe(0);
      expect(heights.puddleAt(x, sz + hill.halfAt(x) + 1)).toBe(0);
      // The banks stand above the water.
      const surface = h(x, sz) + hill.waterDepthAt(x);
      expect(h(x, sz - hill.halfAt(x) - 1.5)).toBeGreaterThan(surface);
    }
    expect(hill.depthAt(lane.x)).toBeLessThan(hill.depthAt(-70));
    expect(hill.halfAt(lane.x)).toBeGreaterThan(hill.halfAt(-70));
    // Mud on the ford's approaches, none out in the pasture.
    expect(heights.mudAt(lane.x, hill.farEdge(lane.x) + 1)).toBeGreaterThan(0.3);
    expect(heights.mudAt(0, 170)).toBe(0);
  });

  it('finds the way up from the yard by the gate and the lane', () => {
    const top = { x: 0, z: 195 };
    const path = fields.route({ x: -50, z: 50 }, top);
    expect(path.map((p) => fields.areaOf(p.x, p.z))).toEqual(['grass', 'lane', 'lane', 'hill', 'hill']);
    expect(fields.route(top, { x: -50, z: 50 }).length).toBe(5);
  });

  it('knows where the foot of the hill is, and keeps a girl wandering there dry and at the bottom', () => {
    expect(hill.pastFoot(0, 190)).toBe(true);
    expect(hill.pastFoot(hill.waitSpot.x, hill.waitSpot.z)).toBe(false);
    expect(hill.pastFoot(lane.x, 120)).toBe(false); // the lane
    expect(heights.puddleAt(hill.waitSpot.x, hill.waitSpot.z)).toBe(0);
    for (const [x, z] of [[-90, 200], [30, 136], [lane.x, 140], [0, 170]]) {
      const c = fields.clampToArea('hill', x, z, 6);
      expect(heights.puddleAt(c.x, c.z)).toBe(0);
      expect(hill.pastFoot(c.x, c.z)).toBe(false);
      expect(fields.areaOf(c.x, c.z)).toBe('hill');
    }
  });

  it('counts the lane and the pasture as the farm\'s own, not the neighbours\'', () => {
    expect(fields.outside(lane.x, 110)).toBe(0);
    expect(fields.outside(0, 170)).toBe(0);
    expect(fields.outside(0, 100)).toBeGreaterThan(10);
  });
});
