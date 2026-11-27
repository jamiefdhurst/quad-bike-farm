import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { polygonBounds } from '../src/world/polygons.js';
import { DEFAULT_FAR_WALK_PARAMS as FAR, wayLength } from '../src/npc/farWalk.js';

// The girls on the new farm (#690): a way from the yard to every field and waiting point and back that never goes through a hedge.
const two = LAYOUT;
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

import { spotsFor, ALL_SPOT_NAMES, nearestNamedSpot } from '../src/npc/spotNames.js';
import { AMY_CALL_THEM_LINES, JESS_CALL_THEM_LINES } from '../src/npc/callThemLines.js';
import { AMY_STRANDED_LINES, JESS_STRANDED_LINES } from '../src/npc/strandedLines.js';

describe('the places a girl can name on the new farm', () => {
  const spots = spotsFor(two);
  it('has the new farm\'s own places, each in the farm or on the common, and none at today\'s numbers', () => {
    const ids = spots.map((s) => s.id);
    for (const id of ['yard', 'ford', 'hill', 'wood', 'pit', 'drive', 'backLane', 'moor', 'cattleGrid', 'lane']) expect(ids, id).toContain(id);
    for (const s of spots) expect(Number.isFinite(s.x) && Number.isFinite(s.z), s.id).toBe(true);
    expect(spots.find((s) => s.id === 'wood')).toMatchObject({ x: two.woods.gate.x, z: two.woods.gate.z - 12 });
    expect(nearestNamedSpot(two.hill.lane.x, two.hill.stream.z, spots).id).toBe('ford');
  });
  it('names a place that is in the table, so each has a recorded line', () => {
    for (const s of spots) expect(ALL_SPOT_NAMES[s.id], s.id).toBe(s.name);
    for (const lines of [{ ...AMY_STRANDED_LINES, ...AMY_CALL_THEM_LINES }, { ...JESS_STRANDED_LINES, ...JESS_CALL_THEM_LINES }]) {
      for (const [id, name] of Object.entries(ALL_SPOT_NAMES)) {
        for (const k of ['callout_bog_', 'callout_tip_', 'called_']) expect(lines[k + id].lines[0], k + id).toContain(name);
      }
    }
  });
});

import { barnBaleSeats } from '../src/world/barn.js';

// The rest spots (#690) and the places the review found girls stuck (#668 to #680, #615): one test for each kind.
const strawSeats = (L) => L.strawBaleSpots.map(([x, z, yaw], i) => ({ id: `bale${i}`, kind: 'bale', x, z, yaw }));
const restSpots = [...two.restSpots, ...barnBaleSeats(two), ...strawSeats(two), { id: 'flask', kind: 'rock', ...two.hill.viewpoint }];

describe('where the girls sit on the new farm', () => {
  it('has Home Ground\'s rails, the barn\'s bales, the stackyard\'s bales and the flask rock, all in the farm', () => {
    const kinds = new Set(restSpots.map((s) => s.id.replace(/\d+$/, '')));
    for (const k of ['fenceNorth', 'barnBale', 'bale', 'flask']) expect(kinds.has(k), k).toBe(true);
    for (const s of restSpots) expect(fields.areaOf(s.x, s.z), s.id).toBeTruthy();
  });

  it('keeps a seat clear of a hedge (the fence seats are the rails themselves), and gives every one a way in from the yard', () => {
    for (const s of restSpots) {
      if (s.kind !== 'fence') expect(fields.hedgeDistance(s.x, s.z), `${s.id} against a hedge`).toBeGreaterThan(0.3);
      const to = { x: s.x, z: s.z };
      expect(crossings(yard, fields.route(yard, to)), `${s.id} there`).toEqual([]);
    }
  });

  it('a seat that is a long way off is a lift away, never a long walk (the flask rock is past the walking limit)', () => {
    const rock = fields.route(yard, two.hill.viewpoint);
    expect(wayLength(yard, rock)).toBeGreaterThan(FAR.liftFrom);
  });
});

describe('the places girls got stuck on the old farm, on the new one', () => {
  it('the Dutch barn: its seats open onto ground a girl can leave by, and the way out of its back is not a dead end', () => {
    const barn = two.dutchBarn;
    for (const s of two.restSpots.filter((r) => r.id.startsWith('dutchBarn'))) {
      const door = s.door;
      expect(Math.hypot(door.x - s.x, door.z - s.z), `${s.id} is by its door`).toBeLessThan(6);
      expect(fields.hedgeDistance(door.x, door.z), `${s.id}'s door is not in a hedge`).toBeGreaterThan(1);
      expect(crossings(door, fields.route(door, yard)), `${s.id} out`).toEqual([]);
    }
    // A girl behind the barn (its far side from the door) gets out to the yard by a way no longer than three times the straight line.
    const behind = { x: barn.x, z: barn.z - barn.halfZ - 3 };
    const way = wayLength(behind, fields.route(behind, yard));
    expect(way).toBeLessThan(3 * Math.hypot(behind.x, behind.z));
  });

  it('the paddock: Home Ground\'s rails have a gate from the yard wide enough for the mower and a trailer', () => {
    const gates = two.gateways.filter((g) => ['home', 'farmstead'].includes(g.a) && ['home', 'farmstead'].includes(g.b));
    expect(gates.length).toBeGreaterThan(0);
    expect(Math.max(...gates.map((g) => g.half * 2))).toBeGreaterThanOrEqual(3);
  });

  it('a place a girl names is not on a hedge (those on the road and the common are named, never walked to)', () => {
    for (const s of spotsFor(two)) {
      if (['backLane', 'cattleGrid', 'moor'].includes(s.id)) continue; // on the road or the common: places to be named, not goals
      expect(fields.hedgeDistance(s.x, s.z), s.id).toBeGreaterThan(0.2);
    }
  });
});

import { outingSpots } from '../src/npc/outings.js';

describe('places a girl drives to on the new farm', () => {
  const spots = outingSpots(two, fields.hill.waitSpot, () => ({ x: 0, z: 0 }));
  it('includes the moor gate, inside the hill pasture, reachable from the yard', () => {
    const gate = spots.find((s) => s.name === 'the moor gate');
    expect(gate).toBeTruthy();
    expect(fields.areaOf(gate.x, gate.z)).toBe('hill');
    expect(fields.hedgeDistance(gate.x, gate.z)).toBeGreaterThan(1);
    expect(crossings(yard, fields.route(yard, gate))).toEqual([]);
  });
  it('and the foot of the hill, 250 m or more from the hut: the places she waits are places she drives to', () => {
    expect(spots.some((s) => s.name === 'the foot of the hill')).toBe(true);
  });
});

import { leaveRoute, hasGone, DEFAULT_GOING_HOME_PARAMS as HOME } from '../src/npc/goingHome.js';

describe('their cars on the new farm', () => {
  it('leave by the drive, over the cattle grid and out onto the lane, where they are counted gone (and some days by Back Lane, tests/goingHome.test.js)', () => {
    const slot = two.cars.finch;
    expect(fields.areaOf(slot.x, slot.z)).toBe('farmstead');
    const route = leaveRoute(slot, two, HOME);
    expect(route.some((pt) => pt.x >= two.road.grid.x)).toBe(true);
    const last = route[route.length - 1];
    expect(hasGone(two, HOME, { x: last.x, z: last.z })).toBe(true);
    expect(hasGone(two, HOME, { x: slot.x, z: slot.z })).toBe(false);
  });
});

describe('the next point on her way (#1118)', () => {
  // The gateway out of the yard onto the drive, on the way to the lane.
  const gw = fields.gateways.find((g) => g.a === 'farmstead' && g.b === 'drive');
  const to = { x: LAYOUT.publicLane.x, z: LAYOUT.road.z - 40 };

  it('heads for the gateway first, and skips a point she has already reached', () => {
    expect(fields.nextWaypoint({ x: gw.pa.x - 30, z: gw.pa.z - 4 }, to)).toEqual(gw.pa);
    expect(fields.nextWaypoint({ x: gw.pa.x - 0.5, z: gw.pa.z }, to)).toEqual(gw.pb); // within reach of the near point: on to the far one
    expect(fields.nextWaypoint({ x: gw.pb.x + 0.5, z: gw.pb.z }, to)).not.toEqual(gw.pb); // and through it, on to what comes after
  });

  it('does not turn her back to a gateway point she has walked on past', () => {
    // Walking on through the gap from the point before it: at every step she is heading for the point after it, never back.
    for (let x = gw.pa.x; x < gw.pb.x - 1; x += 0.25) {
      expect(fields.nextWaypoint({ x, z: gw.pa.z + 0.8 }, to).x, `at x ${x}`).toBeGreaterThanOrEqual(x > gw.pa.x + 1.5 ? gw.pb.x : gw.pa.x);
    }
    // Alongside the hedge but nowhere near the gap she still goes to the gap's point first.
    expect(fields.nextWaypoint({ x: gw.pa.x - 1, z: gw.pa.z + 12 }, to)).toEqual(gw.pa);
  });
});
