import { describe, it, expect } from 'vitest';
import { LAYOUT, LAYOUT_CHOSEN } from '../src/world/layout.js';
import {
  layoutNew, fromPlan, layoutFromSearch, searchForLayout, describeLayout, clippedFields, boundariesOf, placeGateways, areasOf,
  OUTLINE_PLAN, CORNERS_PLAN, FIELDS_PLAN, GATEWAYS_PLAN, NOT_MOVED_YET, SETTINGS, REPLACED,
  STEWARDSHIP_PLAN, stewardshipPlan, RESERVED_PLAN, flattenPath, LANDMARKS_PLAN, LANDFORM_PLAN, canSee, landformHeightAt, traitsOf,
  FIELD_LANDMARKS_PLAN, MOOR_PLAN, fieldLandmarksLayout,
} from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { pointInPolygon, polygonArea, polygonBounds, polygonEdges, distanceToEdges } from '../src/world/polygons.js';
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
  it('are drystone walls round the sheep field and the hill, nothing along the drive, and hedges everywhere else', () => {
    const open = ['drive|lanefield', 'drive|longpiece', 'drive|farmstead'];
    for (const r of runs) {
      const wall = ['sheep', 'hill'].includes(r.a) || ['sheep', 'hill'].includes(r.b);
      expect(r.kind, `${r.a}|${r.b}`).toBe(open.includes([r.a, r.b].sort().join('|')) ? 'none' : wall ? 'wall' : 'hedge');
    }
    expect(runs.filter((r) => r.kind === 'wall').map((r) => [r.a, r.b].sort().join('|')).sort()).toEqual(
      ['brook|hill', 'far|hill', 'far|sheep', 'hay|sheep', 'hill|out', 'hill|sheep', 'home|sheep'].sort(),
    );
    expect(fields.hedges.length + fields.boundaries.filter((b) => b.kind === 'wall' || b.kind === 'none').length).toBe(fields.boundaries.length);
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

// The stewardship strips, the places reserved for later items and what is seen from every gate (#814), in the plan's metres.
describe('the stewardship strips', () => {
  const steward = stewardshipPlan();
  const inner = (name) => steward.margins.find((m) => m.field === name).inner;
  const inside = (poly, [x, z], margin = 0) => pointInPolygon(poly, x, z, margin);
  const along = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);

  it('puts a 6 m grass margin round each of the six arable fields, a ring inside its own sides', () => {
    expect(steward.margin).toBe(6);
    expect(steward.margins.map((m) => m.field).sort()).toEqual(['far', 'lanefield', 'longpiece', 'north', 'south', 'top']);
    for (const m of steward.margins) {
      const outer = byName[m.field].points;
      expect(m.width, m.field).toBe(6);
      for (const p of m.inner) {
        expect(inside(outer, p), `${m.field} ${p}`).toBe(true);
        // 6 m in from its sides; a corner the outline cuts with a short side is folded to a point first, which can move that corner by a metre or so
        const d = distanceToEdges(polygonEdges(outer), p[0], p[1]);
        expect(d, `${m.field} ${p}`).toBeGreaterThan(5.5);
        expect(d, `${m.field} ${p}`).toBeLessThan(7.5);
      }
      const ring = polygonArea(outer) - polygonArea(m.inner);
      const perimeter = outer.reduce((s, p, i) => s + along(p, outer[(i + 1) % outer.length]), 0);
      expect(ring / perimeter, m.field).toBeGreaterThan(5.5);
      expect(ring / perimeter, m.field).toBeLessThan(6.3);
    }
  });
  it('has no margin on a field that is not arable', () => {
    for (const f of FIELDS_PLAN.filter((x) => x.kind !== 'arable')) expect(steward.margins.some((m) => m.field === f.name), f.name).toBe(false);
  });
  it('lays a wildflower strip along Long Piece beside the drive: 6 m wide, just inside the headland, over 200 m long', () => {
    const w = steward.wildflower;
    expect(w.field).toBe('longpiece');
    for (const p of w.points) expect(inside(inner('longpiece'), p), `${p}`).toBe(true);
    const [a, b, c] = w.points;
    const long = Math.max(along(a, b), along(b, c));
    const short = Math.min(along(a, b), along(b, c));
    expect(short).toBeCloseTo(6, 3);
    expect(long).toBeGreaterThan(200);
    // The drive's side of Long Piece is its north one, z 355: the strip lies 6.5 to 12.5 m south of it, level with it.
    for (const [, z] of w.points) {
      expect(z).toBeGreaterThan(355 + 6.4);
      expect(z).toBeLessThan(355 + 12.6);
    }
  });
  it('lays a beetle bank across the middle of Top Field, headland to headland, 2 m wide and 40 cm high', () => {
    const bank = steward.beetleBank;
    expect(bank.field).toBe('top');
    expect([bank.width, bank.height]).toEqual([2, 0.4]);
    const [a, b] = bank.points;
    const bounds = polygonBounds(byName.top.points);
    expect(a[0]).toBe(b[0]);
    expect(Math.abs(a[0] - (bounds.minX + bounds.maxX) / 2)).toBeLessThan(2);
    expect(along(a, b)).toBeGreaterThan(150);
    for (const p of [a, b, [a[0], (a[1] + b[1]) / 2]]) expect(inside(byName.top.points, p), `${p}`).toBe(true);
    // Its ends are at the headland: within a metre of the margin's inner line, and nothing of it goes into the margin.
    expect(distanceToEdges(polygonEdges(inner('top')), a[0], a[1])).toBeLessThan(1);
    expect(distanceToEdges(polygonEdges(inner('top')), b[0], b[1])).toBeLessThan(1);
  });
  it('lays a skylark plot 4 m square in each of Top Field and Far Field, well in from every side and clear of the bank', () => {
    expect(steward.skylarkPlots.map((s) => s.field).sort()).toEqual(['far', 'top']);
    for (const s of steward.skylarkPlots) {
      expect(s.size, s.field).toBe(4);
      const half = s.size / 2;
      for (const [dx, dz] of [[-half, -half], [half, -half], [half, half], [-half, half]]) expect(inside(inner(s.field), [s.at[0] + dx, s.at[1] + dz]), s.field).toBe(true);
      expect(distanceToEdges(polygonEdges(inner(s.field)), s.at[0], s.at[1]), s.field).toBeGreaterThan(20);
    }
    const top = steward.skylarkPlots.find((s) => s.field === 'top');
    expect(Math.abs(top.at[0] - steward.beetleBank.points[0][0])).toBeGreaterThanOrEqual(25);
  });
  it('is in the layout in game metres: the plan\'s places less the yard\'s', () => {
    const s = two.stewardship;
    expect(s.margin).toBe(6);
    expect(s.margins).toHaveLength(6);
    expect(s.beetleBank.points[0]).toEqual(fromPlan(steward.beetleBank.points[0]));
    expect(s.wildflower.points[2]).toEqual(fromPlan(steward.wildflower.points[2]));
    expect(s.skylarkPlots.map((p) => p.at)).toEqual(steward.skylarkPlots.map((p) => fromPlan(p.at)));
    const g = createFields(two);
    for (const m of s.margins) expect(pointInPolygon(two.fields.find((f) => f.name === m.field).points, m.inner[0][0], m.inner[0][1]), m.field).toBe(true);
    expect(g.areaOf(s.beetleBank.points[0][0], (s.beetleBank.points[0][1] + s.beetleBank.points[1][1]) / 2)).toBe('top');
  });
  it('throws if the drive and Long Piece share no line for the strip to lie along', () => {
    expect(() => stewardshipPlan(plan, [], STEWARDSHIP_PLAN)).toThrow(/share no line/);
  });
});

describe('the places reserved for later items', () => {
  const R = RESERVED_PLAN;
  const footpath = flattenPath(R.footpath);
  const bridleway = flattenPath(R.bridleway);
  const routes = { footpath, bridleway };
  const near = (runs, p) => {
    let best = Infinity;
    for (const pts of runs) {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x1, z1] = pts[i];
        const [x2, z2] = pts[i + 1];
        const t = Math.max(0, Math.min(1, ((p[0] - x1) * (x2 - x1) + (p[1] - z1) * (z2 - z1)) / ((x2 - x1) ** 2 + (z2 - z1) ** 2 || 1)));
        best = Math.min(best, Math.hypot(p[0] - x1 - (x2 - x1) * t, p[1] - z1 - (z2 - z1) * t));
      }
    }
    return best;
  };

  it('has the footpath from the village bridge to the ladder stile in the ridge wall, in two runs that break at the stone track\'s bridge', () => {
    expect(footpath).toHaveLength(2);
    expect(footpath[0][0]).toEqual([905, 640]);
    expect(footpath[0].at(-1)).toEqual([432, 572]);
    expect(footpath[1][0]).toEqual([412, 586]);
    expect(footpath[1].at(-1)).toEqual([-334, 612]);
    expect(footpath[1].some(([x, z]) => Math.hypot(x - 10, z - 790) < 1)).toBe(true); // Back Lane at (10, 790)
  });
  it('has the bridleway from Back Lane in the north to Back Lane in the west, round the Wet Meadow', () => {
    expect(bridleway).toHaveLength(1);
    expect(bridleway[0][0]).toEqual([222, 18]);
    expect(bridleway[0].at(-1)).toEqual([14, 364]);
    expect(bridleway[0].some(([x, z]) => Math.hypot(x - 200, z - 225) < 1)).toBe(true); // down Hollow Wood's east edge
    expect(bridleway[0].some(([x, z]) => Math.hypot(x - 195, z - 368) < 1)).toBe(true); // the corner of the Wet Meadow
  });
  it('has the eight crossings, each on its own route', () => {
    expect(R.crossings).toHaveLength(8);
    expect(R.crossings.filter((c) => c.route === 'footpath')).toHaveLength(5);
    expect(R.crossings.filter((c) => c.route === 'bridleway')).toHaveLength(3);
    for (const c of R.crossings) expect(near(routes[c.route], c.at), `${c.route} ${c.at}`).toBeLessThan(10);
  });
  it('has the moor gate at (38, 700) in the hill pasture\'s west wall', () => {
    expect(R.moorGate.at).toEqual([38, 700]);
    expect(R.moorGate.field).toBe('hill');
    expect(distanceToEdges(polygonEdges(OUTLINE_PLAN), 38, 700)).toBeLessThan(5);
  });
  it('has five trough spots, each inside its own field', () => {
    expect(R.troughs.map((t) => t.field).sort()).toEqual(['brook', 'hay', 'hill', 'sheep', 'wet']);
    for (const t of R.troughs) expect(pointInPolygon(byName[t.field].points, t.at[0], t.at[1]), t.field).toBe(true);
  });
  it('has the 11 kV line: a pole on the lane, seven poles 50 to 65 m apart in a straight line, the last in the farmstead', () => {
    const poles = R.powerLine.poles;
    expect(poles).toHaveLength(7);
    expect(poles[0]).toEqual([905, 168]);
    expect(poles.at(-1)).toEqual([566, 274]);
    expect(R.powerLine.transformerPole).toBe(6);
    expect(pointInPolygon(OUTLINE_PLAN, 905, 168)).toBe(false); // on the lane, beyond the farm's east side
    for (let i = 1; i < poles.length - 1; i++) {
      const d = Math.hypot(poles[i + 1][0] - poles[i][0], poles[i + 1][1] - poles[i][1]);
      expect(d, `pole ${i}`).toBeGreaterThan(50);
      expect(d, `pole ${i}`).toBeLessThan(65);
    }
    const [a, b] = [poles[0], poles.at(-1)];
    for (const p of poles) {
      const off = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / Math.hypot(b[0] - a[0], b[1] - a[1]);
      expect(off, `${p}`).toBeLessThan(1);
    }
    expect(pointInPolygon(byName.farmstead.points, ...poles.at(-1))).toBe(true);
    expect(poles.filter((p) => pointInPolygon(byName.lanefield.points, p[0], p[1])).length).toBeGreaterThanOrEqual(3);
  });
  it('is in the layout in game metres', () => {
    expect(two.reserved.moorGate.at).toEqual([38 - 520, 700 - 365]);
    expect(two.reserved.troughs).toHaveLength(5);
    expect(two.reserved.crossings).toHaveLength(8);
    expect(two.reserved.footpath[0][0]).toEqual(fromPlan([905, 640]));
    expect(two.reserved.powerLine.poles.at(-1)).toEqual(fromPlan([566, 274]));
  });
  it('does not stop the new farm loading: nothing else in the layout reads them yet', () => {
    expect(Object.keys(two)).toEqual(expect.arrayContaining(['stewardship', 'reserved', 'landmarks', 'fieldLandmarks']));
  });
});

describe('what is seen from every gate', () => {
  it('is something tall: from every gateway, at least one of the church tower, the Dutch barn\'s roof, the trig pillar and the last pole', () => {
    for (const g of GATEWAYS_PLAN) {
      const seen = LANDMARKS_PLAN.filter((l) => canSee(g.at, l));
      expect(seen.length, `${g.a} to ${g.b}`).toBeGreaterThan(0);
    }
  });
  it('knows a ridge in the way: from behind a hill the thing is hidden', () => {
    const hill = [[0, 0], [100, 60], [200, 0]]; // a 60 m hill between x 0 and 200
    expect(canSee([0, 0], { at: [200, 0], height: 10 }, hill)).toBe(false);
    expect(canSee([0, 0], { at: [200, 0], height: 150 }, hill)).toBe(true);
    expect(canSee([0, 0], { at: [100, 0], height: 10 }, hill)).toBe(true);
  });
  it('stops at the draw distance: nothing is seen from 1500 m or more', () => {
    expect(canSee([0, 0], { at: [1400, 0], height: 500 }, [[0, 0], [2000, 0]])).toBe(true);
    expect(canSee([0, 0], { at: [1600, 0], height: 500 }, [[0, 0], [2000, 0]])).toBe(false);
  });
  it('reads the landform\'s heights: 26 m at the yard, falling to the valley floor at the A-road', () => {
    expect(landformHeightAt(520)).toBe(26);
    expect(landformHeightAt(1000)).toBe(0);
    expect(landformHeightAt(2000)).toBe(0);
    expect(landformHeightAt(-330)).toBe(100);
    expect(LANDFORM_PLAN[0]).toEqual([-330, 100]);
  });
  it('puts the landmarks in the layout in game metres', () => {
    expect(two.landmarks.map((l) => l.name)).toEqual(LANDMARKS_PLAN.map((l) => l.name));
    expect(two.landmarks[0].at).toEqual(fromPlan([1240, 763]));
  });
});

describe('what a field is for its name', () => {
  it('works out how each field lies: Top Field is north and by the pit, Hill Pasture high and far, Low Ley low and wet', () => {
    const traits = Object.fromEntries(plan.map((f) => [f.name, traitsOf(f)]));
    expect(traits.top).toEqual(expect.arrayContaining(['north', 'pit']));
    expect(traits.hill).toEqual(expect.arrayContaining(['high', 'far']));
    expect(traits.ley).toEqual(expect.arrayContaining(['low', 'water']));
    expect(traits.wet).toEqual(expect.arrayContaining(['pond', 'water', 'wood']));
    expect(traits.longpiece).toEqual(expect.arrayContaining(['long', 'lane']));
    expect(traits.hay).toContain('long');
    expect(traits.south).not.toContain('high');
  });
  it('marks the wood, the pit, Home Ground, the farmstead and the drive as keeping their names', () => {
    expect(two.fields.filter((f) => f.fixed).map((f) => f.name).sort()).toEqual(['drive', 'farmstead', 'home', 'pit', 'wood']);
    for (const f of two.fields) expect(Array.isArray(f.traits), f.name).toBe(true);
  });
});

describe('a landmark in every field (#815)', () => {
  const L = FIELD_LANDMARKS_PLAN;
  const inField = (l, p) => (l.field === 'moor' ? p[0] >= MOOR_PLAN.minX && p[0] <= MOOR_PLAN.maxX && p[1] >= MOOR_PLAN.minZ && p[1] <= MOOR_PLAN.maxZ : pointInPolygon(byName[l.field].points, p[0], p[1]));
  const pointsOf = (l) => [l.at, ...(l.trees ?? []), ...(l.willows ?? [])];
  const game = fieldLandmarksLayout();
  const toPlan = ([x, z]) => [x + 520, z + 365];
  const TWELVE = ['north', 'top', 'lanefield', 'longpiece', 'far', 'south', 'hay', 'ley', 'brook', 'sheep', 'hill', 'moor'];

  it('has one in each of the twelve fields the issue lists, and none in the others', () => {
    expect([...new Set(L.map((l) => l.field))].sort()).toEqual([...TWELVE].sort());
    for (const f of ['wood', 'pit', 'wet', 'home', 'farmstead', 'drive']) expect(L.some((l) => l.field === f), f).toBe(false);
  });
  it('has the kind the issue names in each', () => {
    const kind = Object.fromEntries(L.filter((l) => l.field !== 'hill').map((l) => [l.field, l.kind]));
    expect(kind).toEqual({
      north: 'loneOak', top: 'oldGateposts', lanefield: 'powerLine', longpiece: 'deadElm', far: 'farPond', south: 'castRoller', hay: 'loneAsh',
      ley: 'brookAlders', brook: 'bigOaks', sheep: 'fieldBarn', moor: 'trigPillar',
    });
    expect(L.filter((l) => l.field === 'hill').map((l) => l.kind).sort()).toEqual(['flaskRock', 'hut']);
  });
  it('puts every one, and every tree and willow of it, inside its own field', () => {
    for (const l of game) for (const p of pointsOf(l)) expect(inField(l, toPlan(p)), `${l.field} ${l.kind} ${toPlan(p)}`).toBe(true);
  });
  it('puts each a little way in from its field\'s sides (the dead elm, which stands in the hedge, is two metres in)', () => {
    for (const l of game) {
      if (l.field === 'moor') continue;
      const edges = polygonEdges(byName[l.field].points);
      for (const p of pointsOf(l)) {
        const d = distanceToEdges(edges, ...toPlan(p));
        if (l.kind === 'deadElm') {
          expect(d, 'in the hedge').toBeLessThan(3);
          expect(d).toBeGreaterThan(1);
        } else expect(d, `${l.kind} ${toPlan(p)}`).toBeGreaterThan(8);
      }
    }
  });
  it('keeps each clear of the strips: the grass margin, the beetle bank, the skylark plots, the wildflower strip and the barley\'s hollow', () => {
    const S = stewardshipPlan(plan);
    for (const l of game) {
      if (l.field === 'moor' || l.kind === 'deadElm') continue;
      for (const q of pointsOf(l)) {
        const p = toPlan(q);
        const margin = S.margins.find((m) => m.field === l.field);
        if (margin) expect(pointInPolygon(margin.inner, p[0], p[1]), `${l.kind} in the headland`).toBe(true);
        if (S.beetleBank.field === l.field) expect(Math.abs(p[0] - S.beetleBank.points[0][0]), 'beetle bank').toBeGreaterThan(10);
        for (const sp of S.skylarkPlots) if (sp.field === l.field) expect(Math.hypot(p[0] - sp.at[0], p[1] - sp.at[1]), 'skylark plot').toBeGreaterThan(12);
        if (l.field === 'north') {
          const h = { x: 300, z: 120, rx: 26, rz: 16 };
          expect(Math.hypot((p[0] - h.x) / (h.rx + 10), (p[1] - h.z) / (h.rz + 10)), 'the hollow').toBeGreaterThan(1);
        }
      }
    }
  });
  it('keeps each clear of the gateways, the troughs and the footpath\'s crossings, by at least 12 m', () => {
    const gates = GATEWAYS_PLAN.map((g) => g.at);
    const spots = [...gates, ...RESERVED_PLAN.troughs.map((t) => t.at), ...RESERVED_PLAN.crossings.map((c) => c.at)];
    for (const l of game) {
      if (l.field === 'moor' || l.kind === 'deadElm' || l.builtBy) continue;
      for (const q of pointsOf(l)) {
        const p = toPlan(q);
        for (const o of spots) expect(Math.hypot(p[0] - o[0], p[1] - o[1]), `${l.kind} ${p} near ${o}`).toBeGreaterThan(12);
      }
    }
  });
  it('has the places the other issues were promised: the barn at (378, 451), the hut at (95, 802), the rock at (262, 814)', () => {
    const at = (kind) => L.find((l) => l.kind === kind).at;
    expect(at('fieldBarn')).toEqual([378, 451]);
    expect(at('hut')).toEqual([95, 802]);
    expect(at('flaskRock')).toEqual([262, 814]);
  });
  it('names who builds the pieces this issue only places: #711 the line, #624 the barn, #684 the hut and the rock, #713 the pillar', () => {
    expect(Object.fromEntries(L.filter((l) => l.builtBy).map((l) => [l.kind, l.builtBy]))).toEqual({
      powerLine: '#711', fieldBarn: '#624', hut: '#684', flaskRock: '#684', trigPillar: '#713',
    });
  });
  it('has the 11 kV line\'s pole in Lane Field the line\'s own, and three of its poles in the field', () => {
    const pole = L.find((l) => l.kind === 'powerLine');
    expect(RESERVED_PLAN.powerLine.poles).toContainEqual(pole.at);
    const inside = RESERVED_PLAN.powerLine.poles.filter((p) => pointInPolygon(byName.lanefield.points, p[0], p[1]));
    expect(inside).toHaveLength(3);
    expect(inside).toContainEqual(pole.at);
  });
  it('has the trig pillar where LANDMARKS_PLAN has it (the same array, so there is no second copy to drift), in the moor\'s strip west of Back Lane', () => {
    const pillar = L.find((l) => l.kind === 'trigPillar');
    expect(pillar.at).toBe(LANDMARKS_PLAN.find((l) => l.name === 'trig pillar').at);
    expect(pillar.at[0]).toBeGreaterThanOrEqual(MOOR_PLAN.minX);
    expect(pillar.at[0]).toBeLessThan(OUTLINE_PLAN.reduce((m, p) => Math.min(m, p[0]), Infinity));
  });
  it('has Far Field\'s pond near plan (160, 530), 14 m across, clear of the green lane, the stream and the plots, and two willows on its banks', () => {
    const pond = L.find((l) => l.kind === 'farPond');
    expect(pond.at).toEqual([160, 530]);
    expect(pond.rx + pond.rz).toBeGreaterThan(15); // about 14 m across the water once the dish is cut
    expect(Math.hypot(pond.at[0] - 195, pond.at[1] - 500)).toBeGreaterThan(40); // the gap in the green lane's hedge
    expect(565 - pond.at[1]).toBeGreaterThan(30); // the stream along the field's south edge
    expect(pond.willows).toHaveLength(2);
    for (const w of pond.willows) {
      const d = Math.hypot(w[0] - pond.at[0], w[1] - pond.at[1]);
      expect(d).toBeGreaterThan(Math.min(pond.rx, pond.rz));
      expect(d).toBeLessThan(pond.rx + 4);
    }
  });
  it('has the Wet Meadow\'s pond to itself: nothing of Far Field\'s stands in the Wet Meadow', () => {
    for (const l of L.filter((o) => o.field === 'far')) for (const p of pointsOf(l)) expect(pointInPolygon(byName.wet.points, p[0], p[1])).toBe(false);
  });
  it('has the alders in a line along the brook\'s north bank: six, 4 m off the plan\'s curve and 20 to 40 m apart', () => {
    const alders = game.find((l) => l.kind === 'brookAlders');
    expect(alders.trees).toHaveLength(6);
    const run = flattenPath('M650 600 C700 632 790 648 885 650')[0];
    for (const t of alders.trees) {
      const p = toPlan(t);
      let best = Infinity;
      for (let i = 0; i + 1 < run.length; i++) {
        const [x1, z1] = run[i];
        const [x2, z2] = run[i + 1];
        const k = Math.max(0, Math.min(1, ((p[0] - x1) * (x2 - x1) + (p[1] - z1) * (z2 - z1)) / ((x2 - x1) ** 2 + (z2 - z1) ** 2 || 1)));
        best = Math.min(best, Math.hypot(p[0] - x1 - (x2 - x1) * k, p[1] - z1 - (z2 - z1) * k));
      }
      expect(best).toBeGreaterThan(3.5);
      expect(best).toBeLessThan(4.5);
    }
    for (let i = 0; i + 1 < alders.trees.length; i++) {
      const d = Math.hypot(alders.trees[i + 1][0] - alders.trees[i][0], alders.trees[i + 1][1] - alders.trees[i][1]);
      expect(d).toBeGreaterThan(20);
      expect(d).toBeLessThan(40);
    }
  });
  it('is in the layout in game metres, and not on today\'s farm', () => {
    expect(LAYOUT.fieldLandmarks).toBeUndefined();
    expect(two.fieldLandmarks).toHaveLength(L.length);
    const oak = two.fieldLandmarks.find((l) => l.kind === 'loneOak');
    expect(oak.at).toEqual([352 - 520, 150 - 365]);
    expect(oak).toMatchObject({ field: 'north' });
  });
});
