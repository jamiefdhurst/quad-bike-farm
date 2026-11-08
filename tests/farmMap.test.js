import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { Track } from '../src/world/track.js';
import { boundary, gap } from '../src/world/fieldPlan.js';
import { mapBounds, mapTransform, hedgeRuns, farmMapFeatures, placeMarkers, mapAngle, boxCorners, DEFAULT_MAP_PARAMS, MAP_PARAM_RANGES, MAP_KEY_STRIP } from '../src/hud/farmMap.js';

const fields = createFields(LAYOUT);
const track = new Track(LAYOUT.trackPoints);
const features = farmMapFeatures(LAYOUT, fields, track);
const inside = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

describe('the farm map', () => {
  it('covers the farm, the lane, the hill pasture and the wood, with a margin round them', () => {
    const b = mapBounds(fields, 6);
    expect(b.minX).toBe(Math.min(LAYOUT.farm.minX, LAYOUT.hill.pasture.minX) - 6);
    expect(b.maxX).toBe(LAYOUT.farm.maxX + 6);
    expect(b.minZ).toBe(LAYOUT.woods.minZ - 6);
    expect(b.maxZ).toBe(LAYOUT.hill.pasture.maxZ + 6 + MAP_KEY_STRIP); // the strip the key stands in, now the gravel pit has the north-east
  });

  it('fits the ground in its box keeping its shape, centred, and maps back again', () => {
    const b = { minX: 0, maxX: 200, minZ: 0, maxZ: 100 };
    const t = mapTransform(b, 400, 400);
    expect(t.scale).toBe(2);
    expect(t.toMap(0, 0)).toEqual([0, 100]);
    expect(t.toMap(200, 100)).toEqual([400, 300]);
    const [x, z] = t.toWorld(...t.toMap(37, 81));
    expect(x).toBeCloseTo(37);
    expect(z).toBeCloseTo(81);
  });

  it('puts north (-z) up the page and east (+x) to the right', () => {
    const t = mapTransform(features.bounds, 500, 500);
    const [u0, v0] = t.toMap(0, 0);
    const [u1] = t.toMap(10, 0);
    const [, v1] = t.toMap(0, -10);
    expect(u1).toBeGreaterThan(u0);
    expect(v1).toBeLessThan(v0);
  });

  it('leaves the gaps out of a hedge and draws a gate across a gated one', () => {
    const h = boundary(-10, 5, 30, 5, [gap(30, 3, { gate: true, shut: true }), gap(10, 2)]); // gaps at x 20 and 0
    const { runs, gates } = hedgeRuns(h);
    expect(runs.map(([a, b]) => [a.x, b.x])).toEqual([[-10, -2], [2, 17], [23, 30]]);
    expect(runs.every(([a, b]) => a.z === 5 && b.z === 5)).toBe(true);
    expect(gates).toEqual([{ from: { x: 17, z: 5 }, to: { x: 23, z: 5 }, shut: true }]);
  });

  it('draws the farm road and its hardstanding from the road network', () => {
    const farm = features.roads.find((r) => r.id === 'farm');
    expect(farm.half).toBe(LAYOUT.road.halfWidth);
    expect(farm.points[0]).toEqual([LAYOUT.road.fromX, LAYOUT.road.z]);
    expect(farm.points[farm.points.length - 1]).toEqual([LAYOUT.road.toX, LAYOUT.road.z]);
    expect(farm.pads).toEqual([{ x: LAYOUT.road.pad.x, z: LAYOUT.road.z, r: LAYOUT.road.pad.radius }]);
    expect(features.roads.map((r) => r.id)).toEqual(['farm']); // the lane and the village are off the farm's map
  });

  it('has a gap in the grass field east hedge for the road, and the road gate shut', () => {
    const east = fields.hedges.find((h) => !h.alongX && h.x1 === LAYOUT.fieldHalf);
    const { runs } = hedgeRuns(east);
    expect(runs.some(([a, b]) => a.z < LAYOUT.road.z && b.z > LAYOUT.road.z)).toBe(false);
    expect(features.gates.some((g) => g.shut && g.from.x === LAYOUT.farm.maxX)).toBe(true);
    expect(features.gates.some((g) => !g.shut && g.from.z === LAYOUT.fieldHalf)).toBe(true); // the south gate, tied open
  });

  it('draws every field, the buildings and the ground features inside the map', () => {
    const kinds = features.areas.map((a) => a.kind);
    for (const k of ['grass', 'north', 'south', 'road', 'lane', 'hill']) expect(kinds).toContain(k);
    expect(features.buildings.map((b) => b.name)).toEqual(['barn', 'dutchBarn', 'fieldShed', 'hut', 'neighbourHouse', 'neighbourBarn']);
    for (const b of [...features.buildings, ...features.small]) {
      expect(inside(features.bounds, b.rect.minX, b.rect.minZ) && inside(features.bounds, b.rect.maxX, b.rect.maxZ)).toBe(true);
    }
    expect(features.bogs).toHaveLength(LAYOUT.bogs.length);
    for (const bog of features.bogs) expect(track.distanceTo(bog.x, bog.z) < 1 || bog.x === -30).toBe(true);
    expect(features.stream.length).toBeGreaterThan(10);
    expect(features.ford.x).toBe(LAYOUT.hill.lane.x);
  });

  it('writes its names inside the map, and none on top of another', () => {
    const t = mapTransform(features.bounds, 700, 700);
    const placed = features.labels.map((l) => ({ ...l, p: t.toMap(l.x, l.z) }));
    for (const l of placed) {
      expect(l.p[0]).toBeGreaterThan(20);
      expect(l.p[0]).toBeLessThan(680);
      expect(l.p[1]).toBeGreaterThan(10);
      expect(l.p[1]).toBeLessThan(690);
    }
    // Rough text boxes, about 6 px a letter for places and 8 for fields, 14 px tall.
    const box = (l) => {
      const w = l.text.length * (l.kind === 'field' ? 8 : 6);
      return { minX: l.p[0] - w / 2, maxX: l.p[0] + w / 2, minZ: l.p[1] - 7, maxZ: l.p[1] + 7 };
    };
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const a = box(placed[i]);
        const b = box(placed[j]);
        const overlap = a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;
        expect(overlap, `${placed[i].text} and ${placed[j].text}`).toBe(false);
      }
    }
  });

  it('pins a marker that has left the map to its edge', () => {
    const t = mapTransform({ minX: 0, maxX: 100, minZ: 0, maxZ: 100 }, 200, 200);
    const [a, b] = placeMarkers([{ id: 'a', x: 50, z: 50 }, { id: 'b', x: 500, z: -20 }], t, 8);
    expect(a).toMatchObject({ u: 100, v: 100, off: false });
    expect(b).toMatchObject({ u: 192, v: 8, off: true });
  });

  it('turns a heading into the page: south is down, east is right', () => {
    // Canvas rotate(a) turns (0, -1), up the page, to (sin a, -cos a).
    const turn = (yaw) => [Math.round(Math.sin(mapAngle(yaw))) + 0, Math.round(-Math.cos(mapAngle(yaw))) + 0];
    expect(turn(0)).toEqual([0, 1]);
    expect(turn(Math.PI / 2)).toEqual([1, 0]);
    expect(turn(Math.PI)).toEqual([0, -1]);
  });

  it('lays a box along its heading', () => {
    const c = boxCorners(0, 0, Math.PI / 2, 4, 2); // 4 m along +x, 2 m across
    const xs = c.map((p) => p[0]);
    const zs = c.map((p) => p[1]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(4);
    expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(2);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_MAP_PARAMS)) {
      const [lo, hi] = MAP_PARAM_RANGES[k];
      expect(DEFAULT_MAP_PARAMS[k]).toBeGreaterThanOrEqual(lo);
      expect(DEFAULT_MAP_PARAMS[k]).toBeLessThanOrEqual(hi);
    }
  });
});

describe('the map key', () => {
  it('sits on the map, clear of every field and its names', () => {
    const k = features.key;
    expect(k.maxX - k.minX).toBeGreaterThan(100);
    expect(k.maxZ - k.minZ).toBeGreaterThan(80);
    expect(k.minX >= features.bounds.minX && k.maxX <= features.bounds.maxX && k.minZ >= features.bounds.minZ && k.maxZ <= features.bounds.maxZ).toBe(true);
    for (const a of features.areas) {
      const r = a.rect;
      expect(r.minX < k.maxX && k.minX < r.maxX && r.minZ < k.maxZ && k.minZ < r.maxZ, a.kind).toBe(false);
    }
    for (const l of features.labels) expect(inside(k, l.x, l.z), l.text).toBe(false);
  });
});

describe('starts and finishes on the map', () => {
  const marks = features.marks;
  it('has a start and a finish for the drag strip, the hill climb and the pit climb, and the lap line as a start', () => {
    expect(marks.filter((m) => m.kind === 'start').length).toBe(4);
    expect(marks.filter((m) => m.kind === 'finish').length).toBe(3);
  });

  it('puts the pit climb\'s start and finish where its cones are', () => {
    const pts = fields.quarry.climb.points;
    expect(marks).toContainEqual({ kind: 'start', x: pts[0][0], z: pts[0][1] });
    expect(marks).toContainEqual({ kind: 'finish', x: pts[pts.length - 1][0], z: pts[pts.length - 1][1] });
  });
});
