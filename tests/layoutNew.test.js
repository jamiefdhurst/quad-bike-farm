import { describe, it, expect } from 'vitest';
import { LAYOUT, LAYOUT_CHOSEN } from '../src/world/layout.js';
import {
  layoutNew, fromPlan, layoutFromSearch, searchForLayout, describeLayout, clippedFields, boundariesOf, placeGateways, areasOf,
  OUTLINE_PLAN, CORNERS_PLAN, FIELDS_PLAN, GATEWAYS_PLAN, NOT_MOVED_YET, SETTINGS, REPLACED,
} from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { pointInPolygon, polygonArea, polygonBounds } from '../src/world/polygons.js';
import { openFarm, describeFarm } from '../src/farm/farmSave.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';
import { Track } from '../src/world/track.js';

// The new farm behind ?layout=2 (#681): its ground, outline and sixteen fields with the farmstead and the drive, their boundaries and
// gateways, as the issue gives them in the plan's metres.
const two = layoutNew(LAYOUT);
const fields = createFields(two);
const plan = clippedFields();
const byName = Object.fromEntries(plan.map((f) => [f.name, f]));
const outlineGame = two.outline;

describe('which farm loads', () => {
  it('is today\'s unless the address asks for layout 2', () => {
    expect(LAYOUT_CHOSEN).toBe(1);
    expect(LAYOUT.fields).toBeUndefined();
    expect(layoutFromSearch('')).toBe(1);
    expect(layoutFromSearch('?seed=3&layout=2')).toBe(2);
    expect(layoutFromSearch('?layout=1')).toBe(1);
  });
  it('reloads with ?layout=2 added or taken out, keeping the rest', () => {
    expect(searchForLayout('?seed=3', 2)).toBe('?seed=3&layout=2');
    expect(searchForLayout('?seed=3&layout=2', 1)).toBe('?seed=3');
    expect(searchForLayout('?layout=2', 1)).toBe('');
  });
  it('says which it is', () => {
    expect(describeLayout(1)).toMatch(/^today's farm \(layout 1\)/);
    expect(describeLayout(2)).toMatch(/^the new farm \(layout 2, not saved\): \d+ places still at today's numbers/);
  });
  it('never saves the new farm, and leaves the kept one alone', () => {
    const store = { getItem: () => JSON.stringify({ version: 1, day: 6, farmSeed: 9 }), setItem: () => { throw new Error('wrote'); } };
    const f = openFarm({ search: '?layout=2', storage: store });
    expect(f).toMatchObject({ seeded: true, newFarm: true, continuing: false, day: 1 });
    expect(describeFarm({ day: 1, seeded: true, newFarm: true })).toBe('the new farm (?layout=2): not saved');
    expect(openFarm({ search: '?seed=4', storage: store }).newFarm).toBe(false);
  });
});

describe('the ground and the outline', () => {
  it('has the ground the issue gives: plan x -70 to 1350, z -70 to 970', () => {
    expect(two.ground).toEqual({ minX: -590, maxX: 830, minZ: -435, maxZ: 605 });
  });
  it('has the issue\'s outline, clockwise from the north-west, moved to the yard\'s origin', () => {
    expect(OUTLINE_PLAN).toEqual([
      [50, 70], [120, 42], [215, 38], [310, 18], [412, 30], [500, 12], [600, 24], [720, 26], [800, 14], [885, 20], [885, 806], [800, 826],
      [700, 810], [600, 840], [500, 824], [420, 846], [330, 828], [230, 852], [140, 830], [60, 842], [34, 760], [46, 660], [28, 560],
      [42, 470], [30, 365], [44, 300], [30, 215], [42, 150],
    ]);
    expect(polygonArea(OUTLINE_PLAN)).toBeGreaterThan(0); // clockwise on the map
    expect(outlineGame[0]).toEqual([-470, -295]);
    expect(fromPlan([520, 365])).toEqual([0, 0]);
  });
  it('runs straight along the lane on its east side', () => {
    const east = OUTLINE_PLAN.filter(([x]) => x === 885);
    expect(east).toEqual([[885, 20], [885, 806]]);
    expect(OUTLINE_PLAN.indexOf(east[1]) - OUTLINE_PLAN.indexOf(east[0])).toBe(1);
  });
  it('is about 870 by 830 m and 68 ha', () => {
    const b = polygonBounds(OUTLINE_PLAN);
    expect(b.maxX - b.minX).toBe(857);
    expect(b.maxZ - b.minZ).toBe(840);
    expect(areasOf().outline / 1e4).toBeCloseTo(68, 0);
  });
});

describe('the fields', () => {
  it('share the issue\'s corners', () => {
    expect(CORNERS_PLAN).toEqual({
      o0: [-10, -10], o1: [215, -10], o2: [412, -10], o3: [720, -10], o4: [885, -10],
      m0: [-10, 215], m1: [200, 225], m2: [412, 235], m3: [618, 228], m4: [720, 195], m5: [885, 200],
      s0: [618, 335], e1: [885, 335], s1: [618, 355], e2: [885, 355], q0: [-10, 365], q1: [195, 370],
      p1: [195, 440], p2: [412, 440], p3: [618, 440],
      r0: [-10, 565], r1: [200, 565], r2: [420, 545], r3: [640, 525], e3: [885, 520], l4: [640, 660], e4: [885, 650],
      b0: [-10, 880], b2: [420, 880], b3: [640, 880], b4: [885, 880],
    });
  });
  it('are the issue\'s fields, each with its kind and corners', () => {
    const table = Object.fromEntries(FIELDS_PLAN.map((f) => [f.label, `${f.kind}: ${f.corners}`]));
    expect(table).toEqual({
      'Hollow Wood': 'wood: o0 o1 m1 m0', 'North Field': 'arable: o1 o2 m2 m1', 'Top Field': 'arable: o2 o3 m4 m3 m2', 'The Old Pit': 'rough: o3 o4 m5 m4',
      'Wet Meadow': 'pasture: m0 m1 q1 q0', 'Home Ground': 'grass: m1 m2 p2 p1 q1', 'The farmstead': 'yard: m2 m3 s0 s1 p3 p2',
      'Lane Field': 'arable: m3 m4 m5 e1 s0', 'The drive': 'lane: s0 e1 e2 s1', 'Long Piece': 'arable: s1 e2 e3 r3 p3',
      'Far Field': 'arable: q0 q1 p1 r1 r0', 'Sheep Field': 'pasture: p1 p2 r2 r1', 'Hay Meadow': 'hay: p2 p3 r3 r2',
      'Hill Pasture': 'rough: r0 r1 r2 b2 b0', 'Brook Meadow': 'pasture: r2 r3 l4 b3 b2', 'Low Ley': 'ley: r3 e3 e4 l4', 'South Field': 'arable: l4 e4 b4 b3',
    });
    expect(FIELDS_PLAN.filter((f) => f.kind === 'arable')).toHaveLength(6);
  });
  it('are cut back to the outline: no corner of any field is outside it', () => {
    for (const f of plan) for (const [x, z] of f.points) expect(pointInPolygon(OUTLINE_PLAN, x, z, -1e-6), `${f.name} ${x},${z}`).toBe(true);
  });
  it('keep each inside corner where the issue puts it', () => {
    for (const k of ['m1', 'm2', 'm3', 'm4', 'q1', 'p1', 'p2', 'p3', 'r1', 'r2', 'r3', 'l4']) {
      const [x, z] = CORNERS_PLAN[k];
      expect(plan.some((f) => f.points.some(([px, pz]) => Math.hypot(px - x, pz - z) < 1e-6)), k).toBe(true);
    }
  });
  it('tile the outline: their areas add up to its own within 1%', () => {
    const { outline, fields: a } = areasOf(plan);
    const total = Object.values(a).reduce((s, v) => s + v, 0);
    expect(Math.abs(total - outline) / outline).toBeLessThan(0.01);
    expect(a.pit / 1e4).toBeGreaterThan(2.5); // the smallest of the sixteen, about 165 by 170 m
  });
  it('leave no gap and no overlap: every 5 m point inside the outline is in one field, and none outside is in any', () => {
    const b = polygonBounds(outlineGame);
    let inside = 0;
    for (let x = b.minX - 20 + 0.37; x < b.maxX + 20; x += 5) {
      for (let z = b.minZ - 20 + 0.41; z < b.maxZ + 20; z += 5) {
        const holders = two.fields.filter((f) => pointInPolygon(f.points, x, z));
        const inFarm = pointInPolygon(outlineGame, x, z);
        expect(holders.length, `${x},${z}`).toBe(inFarm ? 1 : 0);
        expect(fields.areaOf(x, z) === 'out').toBe(!inFarm);
        if (inFarm) inside++;
      }
    }
    expect(inside).toBeGreaterThan(27000);
  });
});

describe('the boundaries', () => {
  const runs = boundariesOf(plan);
  it('are each field\'s sides, one line between two fields, and the outline round the outside', () => {
    const between = new Set(runs.map((r) => [r.a, r.b].sort().join('|')));
    expect(between.size).toBe(runs.length); // no pair's line written twice
    let outside = 0;
    for (const r of runs.filter((x) => x.b === 'out')) for (let i = 0; i + 1 < r.points.length; i++) outside += Math.hypot(r.points[i + 1][0] - r.points[i][0], r.points[i + 1][1] - r.points[i][1]);
    let perimeter = 0;
    for (let i = 0; i < OUTLINE_PLAN.length; i++) {
      const [a, b] = [OUTLINE_PLAN[i], OUTLINE_PLAN[(i + 1) % OUTLINE_PLAN.length]];
      perimeter += Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    expect(outside).toBeCloseTo(perimeter, 6);
  });
  it('are drystone walls round the sheep field and the hill, and hedges everywhere else', () => {
    for (const r of runs) expect(r.kind, `${r.a}|${r.b}`).toBe(['sheep', 'hill'].includes(r.a) || ['sheep', 'hill'].includes(r.b) ? 'wall' : 'hedge');
    expect(runs.filter((r) => r.kind === 'wall').map((r) => [r.a, r.b].sort().join('|')).sort()).toEqual(
      ['brook|hill', 'far|hill', 'far|sheep', 'hay|sheep', 'hill|out', 'hill|sheep', 'home|sheep'].sort(),
    );
    expect(fields.hedges.length + fields.boundaries.filter((b) => b.kind === 'wall').length).toBe(fields.boundaries.length);
  });
});

describe('the gateways', () => {
  const runs = boundariesOf(plan);
  const placed = placeGateways(runs);
  it('are each on the line between its two fields, where the issue puts it', () => {
    GATEWAYS_PLAN.forEach((g, i) => {
      const r = runs[placed[i].boundary];
      expect([r.a, r.b].sort(), `${g.a} to ${g.b}`).toEqual([g.a, g.b].sort());
      // Within a few metres of the issue's point: it is moved onto the line, and clear of a corner by its width and a metre.
      expect(placed[i].moved, `${g.a} to ${g.b} at ${g.at}`).toBeLessThan(10);
    });
  });
  it('have every one the issue lists', () => {
    const at = (a, b, x, z) => GATEWAYS_PLAN.some((g) => [g.a, g.b].sort().join() === [a, b].sort().join() && g.at[0] === x && g.at[1] === z);
    expect(at('wood', 'wet', 130, 215)).toBe(true);
    expect(at('home', 'farmstead', 412, 368)).toBe(true);
    expect(at('home', 'sheep', 200, 444)).toBe(true); // the green lane's head
    expect(at('farmstead', 'hay', 420, 440)).toBe(true);
    expect(GATEWAYS_PLAN.some((g) => g.a === 'hay' && g.b === 'sheep')).toBe(true); // and on into the sheep field
    expect(at('far', 'sheep', 195, 500)).toBe(true); // the sheep field's west side from the green lane (#674)
    expect(at('hay', 'brook', 420, 545)).toBe(true);
    expect(at('farmstead', 'top', 546, 232)).toBe(true);
    expect(at('top', 'pit', 720, 150)).toBe(true);
    expect(at('north', 'out', 380, 30)).toBe(true);
  });
  it('give each arable field a way in from a track: the stone tracks, the drive, the green lane or Back Lane', () => {
    const ways = { north: ['out'], top: ['farmstead'], lanefield: ['drive'], longpiece: ['drive'], far: ['sheep'], south: ['brook'] };
    for (const [f, from] of Object.entries(ways)) expect(GATEWAYS_PLAN.some((g) => [g.a, g.b].includes(f) && from.some((o) => [g.a, g.b].includes(o))), f).toBe(true);
  });
  it('reach every field from the farmstead', () => {
    const seen = new Set(['farmstead']);
    for (let grew = true; grew; ) {
      grew = false;
      for (const g of two.gateways) {
        if (g.a === 'out' || g.b === 'out') continue;
        if (seen.has(g.a) !== seen.has(g.b)) {
          seen.add(g.a).add(g.b);
          grew = true;
        }
      }
    }
    expect([...seen].sort()).toEqual(FIELDS_PLAN.map((f) => f.name).sort());
  });
  it('and a route goes from the yard to the middle of every field through them', () => {
    const yard = { x: 0, z: 0 };
    expect(fields.areaOf(0, 0)).toBe('farmstead');
    for (const f of two.fields) {
      if (f.name === 'farmstead') continue;
      const to = fields.clampToArea(f.name, ...Object.values(centre(f.points)), 8);
      const path = fields.route(yard, to);
      expect(path.length, f.name).toBeGreaterThan(1);
      expect(path[path.length - 1]).toEqual(to);
    }
  });
});

describe('the fields as data', () => {
  it('are what createFields reads: the outline, the fields, their boundaries and gateways', () => {
    expect(Object.keys(fields.polygons)).toEqual(FIELDS_PLAN.map((f) => f.name));
    expect(fields.kinds.top).toBe('arable');
    expect(fields.gateways).toHaveLength(GATEWAYS_PLAN.length);
    expect(fields.boundaries.length).toBeGreaterThanOrEqual(two.boundaries.length);
    expect(fields.farm).toEqual(polygonBounds(outlineGame));
    expect(fields.inFarm(...fromPlan([60, 120]))).toBe(true);
    expect(fields.inFarm(...fromPlan([30, 90]))).toBe(false); // outside the outline's north-west corner, inside its box
    expect(fields.hedgeDistance(...fromPlan([412, 120]))).toBeLessThan(1e-6); // on North Field's east hedge
  });
});

describe('what has not moved yet', () => {
  const keyed = new Set([...Object.keys(NOT_MOVED_YET), ...SETTINGS, ...REPLACED]);
  it('names every place in today\'s layout that is still at today\'s numbers, with the issue that moves it', () => {
    for (const k of Object.keys(LAYOUT)) {
      if (k === 'anchors') for (const a of Object.keys(LAYOUT.anchors)) expect(keyed.has(`anchors.${a}`), `anchors.${a}`).toBe(true);
      else expect(keyed.has(k), k).toBe(true);
    }
    for (const v of Object.values(NOT_MOVED_YET)) expect(v).toMatch(/^#\d+/);
  });
  it('really are at today\'s numbers in layout 2', () => {
    const get = (o, path) => path.split('.').reduce((v, k) => v?.[k], o);
    for (const k of Object.keys(NOT_MOVED_YET)) expect(get(two, k), k).toEqual(get(LAYOUT, k));
  });
  it('lists nothing that is not in today\'s layout', () => {
    for (const k of Object.keys(NOT_MOVED_YET)) expect(k.split('.').reduce((v, x) => v?.[x], LAYOUT), k).toBeDefined();
  });
});

describe('the ground by kind', () => {
  it('is stubble on the six arable fields, barley and wheat in turn, with the hollow in North Field', () => {
    expect(fields.stubbleFields).toEqual(['north', 'top', 'lanefield', 'longpiece', 'far', 'south']);
    expect(fields.stubbleFields.map((k) => two.stubbleFields[k].crop)).toEqual(['barley', 'wheat', 'barley', 'wheat', 'barley', 'wheat']);
    const h = two.stubbleFields.north.hollow;
    expect(fields.areaOf(h.x, h.z)).toBe('north');
    expect(fields.areaOf(h.x + h.rx + 3, h.z)).toBe('north');
    expect(fields.soakAt(h.x, h.z)).toBeCloseTo(1, 6);
  });
  it('is stubble in every arable field and nowhere else', () => {
    for (const f of two.fields) {
      const c = fields.clampToArea(f.name, ...Object.values(centre(f.points)), 8);
      expect(fields.stubbleAt(c.x, c.z) > 0.5, f.name).toBe(f.kind === 'arable');
    }
  });
  it('gives each field its kind: grass, meadow (hay), ley, rough, pasture, wood, the yard and the drive', () => {
    expect(new Set(Object.values(fields.kinds))).toEqual(new Set(['wood', 'arable', 'rough', 'pasture', 'grass', 'yard', 'lane', 'hay', 'ley']));
  });
});

describe('the map', () => {
  const f = farmMapFeatures(two, fields, new Track(two.trackPoints));
  it('draws every field, in its crop\'s or kind\'s colour, and writes its name', () => {
    expect(f.areas.map((a) => a.kind)).toEqual(FIELDS_PLAN.map((x) => x.name));
    const names = f.labels.filter((l) => l.kind === 'field').map((l) => l.text);
    for (const x of FIELDS_PLAN) expect(names, x.label).toContain(x.label);
    expect(new Set(f.areas.map((a) => a.fill)).size).toBeGreaterThan(5);
  });
  it('draws the walls grey and the hedges green', () => {
    expect(f.hedges.some((h) => h.wall)).toBe(true);
    expect(f.hedges.some((h) => !h.wall)).toBe(true);
  });
});

/** The middle of a polygon's corners. */
function centre(points) {
  const n = points.length;
  return { x: points.reduce((s, p) => s + p[0], 0) / n, z: points.reduce((s, p) => s + p[1], 0) / n };
}
