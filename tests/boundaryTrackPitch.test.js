import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { roadNetwork } from '../src/world/roads.js';
import { createFields } from '../src/world/fields.js';
import { pointInPolygon } from '../src/world/polygons.js';
import { trackPitch, stretchesOver, steepest } from '../tools/trackPitch.mjs';

// The boundary track is never steeper than 20 degrees along it or across it (#1061): the live farm's terrain, sampled every metre of the track.

const LIMIT = 20;
const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const net = roadNetwork(LAYOUT);
const fields = createFields(LAYOUT);
const samples = trackPitch(net, 'boundaryTrack', (x, z) => heights.heightAt(x, z));
const plan = (r) => [r.x + PLAN_ORIGIN[0], r.z + PLAN_ORIGIN[1]];
const where = (r) => `plan (${plan(r).map((v) => v.toFixed(0)).join(', ')}): along ${r.along.toFixed(1)}, across ${r.across.toFixed(1)}`;
const steep = (r) => r.along > LIMIT || r.across > LIMIT;

// Hill Pasture, where the track leaves the boundary: the west side's banks are 33 to 39 degrees, so it comes down the gentle east end instead.
const HILL_ROOM = 18; // the hill's stretch is held under this, not only under the limit: its last bank is 20.3 degrees straight down plan x 398
const hill = fields.polygons.hill;
const onHill = samples.filter((r) => pointInPolygon(hill, r.x, r.z));

describe('the pitch of the boundary track (#1061)', () => {
  it('is sampled every metre of its 3.1 km', () => {
    expect(samples.length).toBeGreaterThan(3000);
    expect(samples.every((r, i) => i === 0 || Math.abs(r.s - samples[i - 1].s - 1) < 1e-9)).toBe(true);
  });

  it('has no sample steeper than 20 degrees along it or across it', () => {
    expect(samples.filter(steep).map(where)).toEqual([]);
  });

  it('comes down Hill Pasture\'s gentle east end, not its west side, with room to spare under 20 degrees', () => {
    expect(onHill.length).toBeGreaterThan(400);
    // Nothing of it west of the green lane's ford (plan x 199.6): the west side and the west half of the top have no track.
    expect(onHill.filter((r) => plan(r)[0] < 195).map(where)).toEqual([]);
    // Straight down plan x 398 from the top to the last bank.
    const down = onHill.filter((r) => plan(r)[1] > 660 && plan(r)[1] < 800);
    expect(down.length).toBeGreaterThan(130);
    expect(down.every((r) => Math.abs(plan(r)[0] - 398) < 1)).toBe(true);
    const worst = steepest(onHill);
    expect(worst.along.along, where(worst.along)).toBeLessThan(HILL_ROOM);
    expect(worst.across.across, where(worst.across)).toBeLessThan(HILL_ROOM);
  });

  it('bends west above the hill\'s last bank, over 20 degrees straight down plan x 398, so it never has to cross ground steeper than 20 degrees', () => {
    const height = (x, z) => heights.heightAt(x - PLAN_ORIGIN[0], z - PLAN_ORIGIN[1]);
    const straight = [];
    for (let z = 655; z > 610; z--) straight.push((Math.atan(Math.abs(height(398, z - 1) - height(398, z))) * 180) / Math.PI);
    expect(Math.max(...straight)).toBeGreaterThan(LIMIT);
    // It leaves x 398 above the bank and is 3 m and more west of it on the bank's steepest (z 625 to 640).
    const bank = onHill.filter((r) => plan(r)[1] > 625 && plan(r)[1] < 640 && plan(r)[0] > 380);
    expect(bank.length).toBeGreaterThan(10);
    expect(Math.max(...bank.map((r) => plan(r)[0]))).toBeLessThan(395.5);
    // The ground's own slope under a sample, from the pitch along and across the track: tan(slope)² = tan(along)² + tan(across)². Nowhere on the
    // loop is it over the limit, so no slant is asked to bring a steeper bank under it (none can, past 27 degrees).
    const tan = (d) => Math.tan((d * Math.PI) / 180);
    const ground = (r) => (Math.atan(Math.hypot(tan(r.along), tan(r.across))) * 180) / Math.PI;
    expect(samples.filter((r) => ground(r) > LIMIT).map(where)).toEqual([]);
  });

  it('keeps clear of the climb\'s cones, which it runs beside and passes in front of', () => {
    const cones = LAYOUT.hill.climb.points.flatMap(([x, z]) => [[x - LAYOUT.hill.climb.gateHalf, z], [x + LAYOUT.hill.climb.gateHalf, z]]);
    const nearest = Math.min(...onHill.map((r) => Math.min(...cones.map(([x, z]) => Math.hypot(r.x - x, r.z - z)))));
    expect(nearest).toBeGreaterThan(6);
  });
});

describe('how the pitch is measured', () => {
  // A plane rising 1 in 2 to the north, and a road due north and one due east over it.
  const plane = (x, z) => -z / 2;
  const fake = (tx, tz) => ({
    road: () => ({ length: 10, halfWidth: 1.5 }),
    pointAt: (_, s) => ({ x: tx * s, z: tz * s, tx, tz }),
  });
  it('reads a climb straight up a slope as along, and none across', () => {
    const r = trackPitch(fake(0, -1), 'x', plane);
    expect(r).toHaveLength(10);
    for (const p of r) {
      expect(p.along).toBeCloseTo(26.57, 1);
      expect(p.across).toBeCloseTo(0, 6);
    }
  });
  it('reads a line along the slope as across, and none along', () => {
    for (const p of trackPitch(fake(1, 0), 'x', plane)) {
      expect(p.along).toBeCloseTo(0, 6);
      expect(p.across).toBeCloseTo(26.57, 1);
    }
  });
  it('joins the samples over the limit into stretches and finds the steepest', () => {
    const rows = [[0, 5, 0], [1, 25, 0], [2, 30, 0], [3, 5, 0], [20, 5, 22], [21, 5, 0]].map(([s, along, across]) => ({ s, along, across }));
    const runs = stretchesOver(rows, 20);
    expect(runs.map((u) => [u.from, u.to])).toEqual([[1, 2], [20, 20]]);
    expect(steepest(rows).along.s).toBe(2);
  });
});
