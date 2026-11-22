import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createHill, woodTries } from '../src/world/hill.js';
import { createFields } from '../src/world/fields.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { Flock, findFlockSpot, DEFAULT_FLOCK_PARAMS } from '../src/world/flock.js';
import { createRandom } from '../src/core/random.js';

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
    expect(pasture.maxZ).toBeLessThan(LAYOUT.ground.maxZ - 5);
    expect(pasture.minX).toBeGreaterThan(LAYOUT.ground.minX + 5);
  });

  it('runs the lane through the gate, sunk between its banks', () => {
    expect(LAYOUT.gate.x).toBe(lane.x);
    for (const z of [94, 124]) {
      const bed = h(lane.x, z);
      expect(h(lane.x - lane.hedgeOff, z) - bed).toBeGreaterThan(lane.sink * 0.9);
      expect(h(lane.x + lane.hedgeOff, z) - bed).toBeGreaterThan(lane.sink * 0.9);
      // A flat enough bed to ride along.
      expect(Math.abs(h(lane.x + 1, z) - h(lane.x - 1, z))).toBeLessThan(0.2);
    }
    // About 60 m from the gate to the ford, and no step through the gateway.
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





  describe('the two fields beside the lane', () => {
    const pads = LAYOUT.hill.paddocks;
    const gw = hill.gates;




    it('keep their flock in the field, on its allowed side, even running from a quad', () => {
      const w = pads.east.wall;
      const flock = new Flock({ allowed: hill.sheepFieldOk, random: createRandom(7), params: { ...DEFAULT_FLOCK_PARAMS }, count: DEFAULT_FLOCK_PARAMS.fieldCount });
      flock.place(findFlockSpot(hill.sheepFieldOk, { minX: hill.east.minX + 8, maxX: hill.east.maxX - 6, minZ: w.z + 6, maxZ: hill.east.maxZ - 6 }, createRandom(3)));
      expect(flock.sheep).toHaveLength(DEFAULT_FLOCK_PARAMS.fieldCount);
      for (let t = 0; t < 120; t += 0.1) {
        flock.update(0.1, t < 60 ? [{ x: 6, z: 112, speed: 8 }] : []);
        for (const sh of flock.sheep) expect(hill.sheepFieldOk(sh.x, sh.z)).toBe(true);
      }
    });


    it('have the lane\'s bank eased down to each gateway, with no step and nothing steeper than a quad can climb', () => {
      for (const g of gw) {
        const from = { x: lane.x, z: g.z };
        const to = { x: lane.x + g.side * (lane.hedgeOff + pads.ramp), z: g.z };
        expect(steepest(from, to)).toBeLessThan(0.32);
        // The gateway is lower than the bank beside it, along the hedge.
        const hedgeX = g.x;
        expect(h(hedgeX, g.z + 8) - h(hedgeX, g.z)).toBeGreaterThan(0.6);
        expect(h(hedgeX, g.z - 8) - h(hedgeX, g.z)).toBeGreaterThan(0.6);
      }
    });

    it('join the farm\'s ground and the pasture\'s without a step', () => {
      for (let x = pads.west.minX + 1; x < lane.x - lane.hedgeOff - 1; x += 3) {
        expect(Math.abs(h(x, 80.1) - h(x, 79.9))).toBeLessThan(0.1);
        expect(Math.abs(h(x, 133.9) - h(x, 134.1))).toBeLessThan(0.1);
      }
      expect(steepest({ x: -90, z: 84 }, { x: -50, z: 84 })).toBeLessThan(0.4);
    });




    it('meet the pasture at the south edge with no step', () => {
      for (let x = -10; x < pads.east.maxX; x += 3) {
        expect(Math.abs(h(x, hill.east.maxZ - 0.5) - h(x, hill.east.maxZ + 0.5))).toBeLessThan(0.3);
      }
    });

  });
});

