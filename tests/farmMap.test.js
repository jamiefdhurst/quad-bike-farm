import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { Track } from '../src/world/track.js';
import { boundary, gap } from '../src/world/fieldPlan.js';
import { mapBounds, mapTransform, hedgeRuns, farmMapFeatures, placeMarkers, mapAngle, boxCorners, labelSpot, nameBox, countedName, keyStripHeight, DEFAULT_MAP_PARAMS, MAP_PARAM_RANGES, MAP_KEY_STRIP } from '../src/hud/farmMap.js';
import { pointInPolygon } from '../src/world/polygons.js';

const fields = createFields(LAYOUT);
const track = new Track(LAYOUT.trackPoints);
const features = farmMapFeatures(LAYOUT, fields, track);
// A layout that says what its fields are, with nothing of today's farm in it: three fields with their own names, a farmhouse, a woodpile, a drive.
const polygonLayout = {
  outline: [[0, 0], [100, 0], [100, 60], [60, 100], [0, 100]],
  fields: [
    { name: 'West Ley', kind: 'ley', points: [[0, 0], [50, 0], [44, 50], [50, 100], [0, 100]] },
    { name: 'Long Acre', kind: 'arable', points: [[50, 0], [100, 0], [100, 50], [44, 50]] },
    { name: 'Hay Close', kind: 'hay', points: [[44, 50], [100, 50], [100, 60], [60, 100], [50, 100]] },
  ],
  boundaries: [{ points: [[50, 0], [44, 50], [50, 100]], kind: 'hedge' }],
  gateways: [],
  farmhouse: { x: 20, z: 20, halfX: 6, halfZ: 4 },
  logYard: { stack: { x: 70, z: 90, yaw: 0 }, piles: [[62, 92, 0.2]] },
  roads: [{ id: 'drive', name: 'the drive', surface: 'tarmac', halfWidth: 2, points: [[-60, 50], [-5, 50], [20, 28]] }],
  trackPoints: [[10, 60], [40, 60], [40, 90], [10, 90]],
};
const inside = (r, x, z) => x >= r.minX && x <= r.maxX && z >= r.minZ && z <= r.maxZ;

describe('the farm map', () => {
  it('covers the farm, the hill pasture, the wood, the lane and the village across it, with a margin round them', () => {
    const g = features.ground;
    expect(g.minX).toBe(Math.min(LAYOUT.farm.minX, LAYOUT.hill.pasture.minX) - 6);
    expect(g.maxX).toBeCloseTo(LAYOUT.publicLane.x + LAYOUT.publicLane.halfWidth + 6);
    expect(g.minZ).toBe(Math.min(LAYOUT.woods.minZ, LAYOUT.publicLane.minZ) - LAYOUT.publicLane.halfWidth - 6); // the lane runs out past the wood
    expect(g.maxZ).toBeGreaterThanOrEqual(LAYOUT.village.area.maxZ + 6);
    expect(g.maxZ).toBeGreaterThanOrEqual(LAYOUT.hill.pasture.maxZ + 6);
    const v = LAYOUT.village.area;
    expect(v.minX >= g.minX && v.maxX <= g.maxX && v.minZ >= g.minZ && v.maxZ <= g.maxZ).toBe(true);
  });

  it('adds the key\'s strip below the ground, a share of its height and never less than the least', () => {
    const g = features.ground;
    const strip = features.bounds.maxZ - g.maxZ;
    expect(strip).toBe(keyStripHeight(g));
    expect(strip).toBeGreaterThanOrEqual(MAP_KEY_STRIP);
    expect(keyStripHeight({ minZ: 0, maxZ: 40 })).toBe(MAP_KEY_STRIP);
    expect(keyStripHeight({ minZ: 0, maxZ: 1000 })).toBe(160);
    expect(mapBounds(fields, 6).maxZ).toBeGreaterThan(mapBounds(fields, 6).ground.maxZ);
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

  it('draws every road of the network: the lane, the farm road with its hardstanding and the village street', () => {
    const farm = features.roads.find((r) => r.id === 'farm');
    expect(farm.half).toBe(LAYOUT.road.halfWidth);
    expect(farm.points[0]).toEqual([LAYOUT.road.fromX, LAYOUT.road.z]);
    expect(farm.points[farm.points.length - 1]).toEqual([LAYOUT.road.toX, LAYOUT.road.z]);
    expect(farm.pads).toEqual([{ x: LAYOUT.road.pad.x, z: LAYOUT.road.z, r: LAYOUT.road.pad.radius }]);
    expect(features.roads.map((r) => r.id)).toEqual(['lane', 'farm', 'street']);
    const lane = features.roads.find((r) => r.id === 'lane');
    expect(lane.points[0][0]).toBe(LAYOUT.publicLane.x);
    expect(lane.half).toBe(LAYOUT.publicLane.halfWidth);
    expect(features.labels.map((l) => l.text)).toContain('The lane');
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
    const names = features.buildings.map((b) => b.name);
    expect(names).toEqual(['barn', 'dutchBarn', 'fieldShed', 'hut', 'neighbourHouse', 'neighbourBarn', 'pub', 'shop', 'garage', ...LAYOUT.village.cottages.map((c) => `cottage ${c.id}`)]);
    const pub = features.buildings.find((b) => b.name === 'pub').rect;
    expect(pub).toEqual({ minX: LAYOUT.village.pub.x - LAYOUT.village.pub.halfX, maxX: LAYOUT.village.pub.x + LAYOUT.village.pub.halfX, minZ: LAYOUT.village.pub.z - LAYOUT.village.pub.halfZ, maxZ: LAYOUT.village.pub.z + LAYOUT.village.pub.halfZ });
    const texts = features.labels.map((l) => l.text);
    for (const t of ['Nether Thornby', 'Pub', 'Shop', 'Garage', 'Barn', 'Dutch barn', 'Hut', 'Neighbour', 'Woodpile']) expect(texts, t).toContain(t);
    for (const b of [...features.buildings, ...features.small]) {
      expect(inside(features.ground, b.rect.minX, b.rect.minZ) && inside(features.ground, b.rect.maxX, b.rect.maxZ)).toBe(true);
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
      const w = (l.reserve ?? l.text).length * (l.kind === 'field' ? 8 : 6);
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

/** Every rectangle the map draws on the ground, in metres: fields, buildings, roads (with their width), the woodpile, the neighbour's yard, the names. */
function drawnRects(f, size = 700) {
  const t = mapTransform(f.bounds, size, size);
  const out = [];
  for (const a of f.areas) out.push([`field ${a.kind}`, a.rect]);
  for (const b of [...f.buildings, ...f.small]) out.push([b.name, b.rect]);
  for (const r of f.roads) {
    const xs = r.points.map((p) => p[0]);
    const zs = r.points.map((p) => p[1]);
    out.push([`road ${r.id}`, { minX: Math.min(...xs) - r.half, maxX: Math.max(...xs) + r.half, minZ: Math.min(...zs) - r.half, maxZ: Math.max(...zs) + r.half }]);
  }
  if (f.woodpile) {
    const xs = f.woodpile.stack.map((p) => p[0]);
    const zs = f.woodpile.stack.map((p) => p[1]);
    out.push(['woodpile', { minX: Math.min(...xs), maxX: Math.max(...xs), minZ: Math.min(...zs), maxZ: Math.max(...zs) }]);
  }
  if (f.neighbourYard) out.push(['neighbour yard', f.neighbourYard]);
  for (const l of f.labels) out.push([`name ${l.text}`, nameBox(l, t.scale)]);
  return out;
}
const touches = (a, b) => a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

describe('the map key', () => {
  it('has a strip of its own below the ground, clear of everything drawn on it', () => {
    const k = features.key;
    expect(k.maxX - k.minX).toBeGreaterThan(100);
    expect(k.maxZ - k.minZ).toBeGreaterThan(30);
    expect(k.minX >= features.bounds.minX && k.maxX <= features.bounds.maxX && k.minZ >= features.ground.maxZ && k.maxZ <= features.bounds.maxZ).toBe(true);
    for (const [what, r] of drawnRects(features)) expect(touches(r, k), what).toBe(false);
  });

  it('stays clear at any size of ground: a tiny farm and one ten times the size', () => {
    for (const k of [0.1, 1, 10]) {
      const big = { ...polygonLayout, outline: polygonLayout.outline.map(([x, z]) => [x * k, z * k]), fields: polygonLayout.fields.map((f) => ({ ...f, points: f.points.map(([x, z]) => [x * k, z * k]) })), farmhouse: { x: 20 * k, z: 20 * k, halfX: 6, halfZ: 4 }, logYard: { stack: { x: 70 * k, z: 90 * k, yaw: 0 }, piles: [] }, roads: [] };
      const f = farmMapFeatures(big, createFields(big), new Track(polygonLayout.trackPoints.map(([x, z]) => [x * k, z * k])));
      expect(f.key.minZ, `x${k}`).toBeGreaterThan(f.ground.maxZ);
      for (const [what, r] of drawnRects(f)) expect(touches(r, f.key), `x${k} ${what}`).toBe(false);
    }
  });
});

describe('the woodpile', () => {
  it('is drawn at the stack, with the rounds by it, and its name keeps room for a count', () => {
    const w = features.woodpile;
    const st = LAYOUT.logYard.stack;
    const xs = w.stack.map((p) => p[0]);
    expect(Math.min(...xs) < st.x && Math.max(...xs) > st.x).toBe(true);
    expect(w.rounds).toHaveLength(LAYOUT.logYard.piles.length);
    const l = features.labels.find((x) => x.id === 'woodpile');
    expect(l.text).toBe('Woodpile');
    expect(l.reserve.length).toBeGreaterThan(l.text.length);
    expect(l.dynamic).toBe(true);
  });

  it('puts the count of the stack in its name, and just the name when there is none to say', () => {
    expect(countedName('Woodpile', 12)).toBe('Woodpile (12)');
    expect(countedName('Woodpile', 0)).toBe('Woodpile (0)');
    expect(countedName('Woodpile', undefined)).toBe('Woodpile');
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

describe('a farm drawn from fields that are polygons', () => {
  const pf = createFields(polygonLayout);
  const f = farmMapFeatures(polygonLayout, pf, new Track(polygonLayout.trackPoints));

  it('colours each field by its kind and keeps its outline', () => {
    expect(f.areas.map((a) => [a.kind, a.fieldKind, a.fill])).toEqual([['West Ley', 'ley', '#bfd48e'], ['Long Acre', 'arable', '#e6d39c'], ['Hay Close', 'hay', '#cfd99a']]);
    expect(f.areas[0].points).toBe(pf.polygons['West Ley']);
  });

  it('is bounded by the outline and the roads, and draws the drive', () => {
    expect(f.ground.minX).toBe(-60 - 2 - 6); // the drive runs out of the farm to the west
    expect(f.ground.maxX).toBe(100 + 6);
    expect(f.roads.map((r) => r.id)).toEqual(['drive']);
    expect(f.labels.map((l) => l.text)).toContain('The drive');
  });

  it('draws the farmhouse and names it', () => {
    expect(f.buildings).toEqual([{ name: 'farmhouse', rect: { minX: 14, maxX: 26, minZ: 16, maxZ: 24 }, fill: expect.any(String) }]);
    expect(f.labels.map((l) => l.text)).toContain('Farmhouse');
  });

  it('writes each field\'s own name inside it', () => {
    for (const [name, pts] of Object.entries(pf.polygons)) {
      const l = f.labels.find((x) => x.text === name);
      expect(l, name).toBeDefined();
      expect(pointInPolygon(pts, l.x, l.z), name).toBe(true);
    }
  });

  it('draws with no name on another, on a building or on the woodpile', () => {
    for (const size of [500, 700, 900]) {
      const t = mapTransform(f.bounds, size, size);
      const boxes = f.labels.map((l) => [l.text, nameBox(l, t.scale)]);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) expect(touches(boxes[i][1], boxes[j][1]), `${size}: ${boxes[i][0]} and ${boxes[j][0]}`).toBe(false);
        for (const b of f.buildings) {
          if (boxes[i][0] !== 'Farmhouse') expect(touches(boxes[i][1], b.rect), `${size}: ${boxes[i][0]} on ${b.name}`).toBe(false);
        }
      }
    }
  });

  it('keeps the key clear', () => {
    for (const [what, r] of drawnRects(f)) expect(touches(r, f.key), what).toBe(false);
  });

  it('finds the roomiest spot in an L, away from the notch and from what it must avoid', () => {
    const L = [[0, 0], [40, 0], [40, 20], [20, 20], [20, 40], [0, 40]];
    const at = labelSpot(L);
    expect(pointInPolygon(L, at.x, at.z)).toBe(true);
    const away = labelSpot(L, [{ minX: at.x - 3, maxX: at.x + 3, minZ: at.z - 3, maxZ: at.z + 3 }]);
    expect(pointInPolygon(L, away.x, away.z)).toBe(true);
    expect(Math.hypot(away.x - at.x, away.z - at.z)).toBeGreaterThan(3);
  });
});

