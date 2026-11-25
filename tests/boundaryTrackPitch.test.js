import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { PLAN_ORIGIN } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { roadNetwork } from '../src/world/roads.js';
import { trackPitch, stretchesOver, steepest } from '../tools/trackPitch.mjs';

// The boundary track is never steeper than 20 degrees along it or across it (#1061): the live farm's terrain, sampled every metre of the track.

const LIMIT = 20;
const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
const net = roadNetwork(LAYOUT);
const samples = trackPitch(net, 'boundaryTrack', (x, z) => heights.heightAt(x, z));
const plan = (r) => [r.x + PLAN_ORIGIN[0], r.z + PLAN_ORIGIN[1]];
const where = (r) => `plan (${plan(r).map((v) => v.toFixed(0)).join(', ')}): along ${r.along.toFixed(1)}, across ${r.across.toFixed(1)}`;
const steep = (r) => r.along > LIMIT || r.across > LIMIT;

/**
 * Stretches still steeper than the limit, each waiting on Jamie in its issue: a box in plan metres, the steepest it measured when listed (held to no
 * worse), and why it is not fixed here. Never add to this; take one off when its stretch is fixed (the test fails while it is listed and gone).
 */
const KNOWN = [
  {
    issue: 1061,
    box: [40, 600, 70, 760],
    worst: 34.6,
    why: 'Hill Pasture\'s west side: the track comes straight down the hill\'s banks, which are 33 to 39 degrees all across the pasture west of plan x 320, '
      + 'and no line crosses a bank steeper than 27 degrees under 20 both along and across: the gentle way down is at plan x 350 to 410, 350 m from the boundary',
  },
];
const inBox = ([x0, z0, x1, z1], r) => {
  const [x, z] = plan(r);
  return x >= x0 && x <= x1 && z >= z0 && z <= z1;
};

describe('the pitch of the boundary track (#1061)', () => {
  it('is sampled every metre of its 3.4 km', () => {
    expect(samples.length).toBeGreaterThan(3300);
    expect(samples.every((r, i) => i === 0 || Math.abs(r.s - samples[i - 1].s - 1) < 1e-9)).toBe(true);
  });

  it('has no sample steeper than 20 degrees along it or across it, but in the stretches listed by issue', () => {
    const over = samples.filter((r) => steep(r) && !KNOWN.some((k) => inBox(k.box, r))).map(where);
    expect(over).toEqual([]);
  });

  it('has each listed stretch still steep (or it comes off the list) and no steeper than when it was listed', () => {
    for (const k of KNOWN) {
      const inside = samples.filter((r) => inBox(k.box, r));
      expect(inside.some(steep), `#${k.issue} is fixed: take it off KNOWN`).toBe(true);
      const worst = steepest(inside);
      expect(Math.max(worst.along.along, worst.across.across), `#${k.issue}`).toBeLessThanOrEqual(k.worst + 0.1);
    }
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
