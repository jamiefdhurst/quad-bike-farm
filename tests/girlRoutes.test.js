import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { polygonBounds } from '../src/world/polygons.js';
import { DEFAULT_FAR_WALK_PARAMS as FAR, wayLength } from '../src/npc/farWalk.js';

// The girls on the new farm (#690): a way from the yard to every field and waiting point and back that never goes through a hedge.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const fields = createFields(two);
const yard = { x: 0, z: 0 };

const centre = (pts) => {
  const b = polygonBounds(pts);
  return { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 };
};

/** The legs of a route from `from` that run into a hedge or shut gate before they end. */
function crossings(from, route) {
  const bad = [];
  let prev = from;
  for (const pt of route) {
    const len = Math.hypot(pt.x - prev.x, pt.z - prev.z);
    const ahead = fields.hedgeAhead(prev.x, prev.z, Math.atan2(pt.x - prev.x, pt.z - prev.z));
    if (len > 1 && ahead < len - 1.2) bad.push({ from: prev, to: pt, ahead, len });
    prev = pt;
  }
  return bad;
}

describe('girls routing on the new farm', () => {
  it('goes from the yard to the middle of every field and back without crossing a hedge', () => {
    for (const f of two.fields) {
      if (f.name === 'farmstead' || f.name === 'drive') continue;
      const to = fields.clampToArea(f.name, ...Object.values(centre(f.points)), 8);
      expect(crossings(yard, fields.route(yard, to)), `${f.name} there`).toEqual([]);
      expect(crossings(to, fields.route(to, yard)), `${f.name} back`).toEqual([]);
    }
  });

  it('has the three places the girls wait, each reachable from the yard and back', () => {
    const waits = { hill: fields.hill?.waitSpot, wood: fields.woods?.waitSpot, pit: fields.quarry?.waitSpot };
    for (const [name, spot] of Object.entries(waits)) {
      expect(spot, name).toBeTruthy();
      expect(fields.inFarm(spot.x, spot.z), `${name} is in the farm`).toBe(true);
      expect(crossings(yard, fields.route(yard, spot)), `${name} there`).toEqual([]);
      expect(crossings(spot, fields.route(spot, yard)), `${name} back`).toEqual([]);
    }
  });

  it('prefers the tracks: the way to the far end of the stone track is no longer than the straight line plus a little', () => {
    const to = fields.clampToArea('longpiece', ...Object.values(centre(two.fields.find((f) => f.name === 'longpiece').points)), 8);
    const way = wayLength(yard, fields.route(yard, to));
    expect(way).toBeLessThan(Math.hypot(to.x, to.z) * 1.6);
  });

  it('puts the far fields beyond the walking limit, so a girl going to one has to be given a lift', () => {
    const to = fields.clampToArea('south', ...Object.values(centre(two.fields.find((f) => f.name === 'south').points)), 8);
    expect(wayLength(yard, fields.route(yard, to))).toBeGreaterThan(FAR.liftFrom);
  });
});

import { spotsFor, SPOT_NAMES, nearestNamedSpot } from '../src/npc/spotNames.js';

describe('the places a girl can name on the new farm', () => {
  const spots = spotsFor(two);
  it('has the new farm\'s own places, each in the farm or on the common, and none at today\'s numbers', () => {
    const ids = spots.map((s) => s.id);
    for (const id of ['yard', 'ford', 'hill', 'wood', 'pit', 'drive', 'backLane', 'moor', 'cattleGrid', 'lane']) expect(ids, id).toContain(id);
    for (const s of spots) expect(Number.isFinite(s.x) && Number.isFinite(s.z), s.id).toBe(true);
    expect(spots.find((s) => s.id === 'wood')).toMatchObject({ x: two.woods.gate.x, z: two.woods.gate.z });
    expect(nearestNamedSpot(two.hill.lane.x, two.hill.stream.z, spots).id).toBe('ford');
  });
  it('names a place that is in the table, so each has a recorded line', () => {
    for (const s of spots) expect(SPOT_NAMES[s.id], s.id).toBe(s.name);
  });
});
