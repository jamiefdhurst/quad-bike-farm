import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { LAYOUT } from '../src/world/layout.js';
import { fromPlan } from '../src/world/layoutNew.js';
import {
  farmPlacements, placementContext, placementBreaks, PLACEMENT_RULES, PLACEMENT_SOURCES, toPlan, boxCorners, circleCorners, overlapDepth,
  gatewayBreak, waterBreak, trackBreak, plotBreak, reservedBreak,
} from '../src/world/farmPlacement.js';
import { hedgeReach } from './helpers/hedgeModels.js';

// Everything placed on the new farm, checked against every placement rule (#1187): a hedge or a prop in a gateway, something standing in the brook,
// a collider across a track, a thing out of its plot, something in a reserved place. What a rule finds is fixed, or filed and listed in `KNOWN` by its
// issue so this passes; the list only gets shorter, as an entry that no longer breaks its rule fails too. `FARM_PLACEMENT_REPORT=1` prints the count by rule.

/**
 * What is filed, by issue: the rule, the thing's name (`farmPlacements`) and where it is on the plan, within `within` m. One entry covers every piece of
 * that name breaking that rule there (a hedge breaks as several boxes and blocks).
 */
const KNOWN = [
  { issue: 1216, rule: 'gateway', name: 'hedge far|lane', at: [195, 562], within: 6 }, // the hedge's end at the ford, past its corner into the ford's opening
  { issue: 1216, rule: 'water', name: 'hedge far|lane', at: [195, 562], within: 6 }, // and into the stream
  { issue: 1216, rule: 'water', name: 'hedge ley|south', at: [880, 650], within: 8 }, // the brook running over the corner where it leaves the farm
  { issue: 1216, rule: 'water', name: 'hedge south|out', at: [885, 649], within: 4 },
  { issue: 1082, rule: 'track', name: 'the lane\'s gateway at plan z 459.5', at: [912, 459.5], within: 1 }, // the small farm's track shut by a lane gate
  { issue: 1224, rule: 'reserved', name: 'a river gate', at: [640, 606], within: 2 }, // the footpath's crossing out of Brook Meadow is in the river gate's gap
  { issue: 1217, rule: 'track', name: 'an oak by the yard', at: [545, 267], within: 2 }, // the old farm's tree line, on the stone track north
  { issue: 1217, rule: 'reserved', name: 'an oak by the yard', at: [434, 385], within: 2 }, // in the sheep pens' place
  { issue: 1217, rule: 'reserved', name: 'an oak by the yard', at: [430, 351], within: 2 }, // in the machinery shed's place
];

const reach = hedgeReach();
const t0 = performance.now();
const things = farmPlacements(LAYOUT, { reach });
const ctx = placementContext(LAYOUT);
/** Every break of every rule over the whole farm: { rule, why, thing, plan }. */
const found = [];
for (const t of things) for (const b of placementBreaks(t, LAYOUT, ctx)) found.push({ ...b, thing: t, plan: toPlan(t.x, t.z) });
const took = performance.now() - t0;
const known = (f) => KNOWN.find((k) => k.rule === f.rule && k.name === f.thing.name && Math.hypot(f.plan[0] - k.at[0], f.plan[1] - k.at[1]) <= k.within);
if (process.env.FARM_PLACEMENT_REPORT) {
  const by = Object.fromEntries(Object.keys(PLACEMENT_RULES).map((r) => [r, found.filter((f) => f.rule === r).length]));
  console.log(`${things.length} things placed, checked in ${took.toFixed(0)} ms; breaks by rule: ${JSON.stringify(by)}`);
  for (const f of found) console.log(`  ${f.rule}: ${f.thing.name} at plan (${f.plan}) ${f.why}${known(f) ? ` (#${known(f).issue})` : ''}`);
}

describe('everything placed on the new farm (#1187)', () => {
  it('lists what the builders place: every hedge block and box, the walls, fences, rails and gates, the buildings, the trees, the props and the landmarks', () => {
    const count = (kind) => things.filter((t) => t.kind === kind).length;
    expect(count('hedgeLeaves')).toBeGreaterThan(5000);
    expect(count('hedge')).toBeGreaterThan(500);
    for (const kind of ['wall', 'fence', 'rail', 'gate', 'building', 'tree', 'prop', 'landmark', 'trough', 'pole', 'vehicle', 'bridge']) expect(count(kind), kind).toBeGreaterThan(0);
    for (const t of things) {
      expect(Number.isFinite(t.x) && Number.isFinite(t.z), t.name).toBe(true);
      expect(t.corners.length, t.name).toBeGreaterThanOrEqual(3);
      for (const [x, z] of t.corners) expect(Number.isFinite(x) && Number.isFinite(z), t.name).toBe(true);
    }
  });

  it('reads every builder the props run, or names it as placing nothing that stands or as not listed yet', () => {
    const src = fs.readFileSync(new URL('../src/world/props.js', import.meta.url), 'utf8');
    const ran = [...src.matchAll(/run\('(\w+)'/g)].map((m) => m[1]).filter((n) => n !== 'scatter'); // the scatter only draws what the builders above it placed
    const named = [...PLACEMENT_SOURCES.read, ...Object.keys(PLACEMENT_SOURCES.flat), ...Object.keys(PLACEMENT_SOURCES.notYet)];
    expect(Object.keys(PLACEMENT_SOURCES.partly).filter((n) => !PLACEMENT_SOURCES.read.includes(n))).toEqual([]);
    expect(ran.filter((n) => !named.includes(n)), 'builders in buildProps the list neither reads nor names').toEqual([]);
    expect(named.filter((n) => !ran.includes(n)), 'names here no builder has').toEqual([]);
  });

  it('breaks no rule anywhere on the farm, but for what is filed', () => {
    const unknown = found.filter((f) => !known(f)).map((f) => `${f.rule}: ${f.thing.name} at plan (${f.plan}) ${f.why}`);
    expect(unknown, unknown.join('\n')).toEqual([]);
  });

  it('lists nothing filed that is fixed: each entry in KNOWN still breaks its rule (take it out when its issue is done)', () => {
    const gone = KNOWN.filter((k) => !found.some((f) => known(f) === k)).map((k) => `#${k.issue} ${k.rule}: ${k.name} at plan (${k.at})`);
    expect(gone, gone.join('\n')).toEqual([]);
  });

  it('checks the whole farm in well under 5 seconds', () => {
    expect(took).toBeLessThan(5000);
  });
});

describe('each rule, on things made up for it', () => {
  const at = (plan) => fromPlan(plan);
  const post = (plan, extra = {}) => {
    const [x, z] = at(plan);
    return { kind: 'prop', name: 'a post', x, z, corners: circleCorners(x, z, 0.2), solid: true, ...extra };
  };

  it('finds something solid, or a hedge, in a gateway\'s opening, and leaves a gate in its own and a thing beside the opening alone', () => {
    expect(gatewayBreak(post([420, 440]), ctx)).toMatch(/farmstead\|hay/); // the stone track south out of the yard
    expect(gatewayBreak(post([420, 440], { solid: false, kind: 'hedgeLeaves' }), ctx)).toMatch(/farmstead\|hay/);
    expect(gatewayBreak(post([420, 440], { gate: true }), ctx)).toBeNull();
    expect(gatewayBreak(post([420, 440], { solid: false }), ctx)).toBeNull(); // a jerry can may stand there
    expect(gatewayBreak(post([426, 440]), ctx)).toBeNull(); // 6 m along: in the hedge, not the gap
  });

  it('finds a thing standing in the river or a pond, and lets a bridge stand over it', () => {
    expect(waterBreak(post([600, 592]), ctx)).toMatch(/water/); // the brook through Brook Meadow
    expect(waterBreak(post([83, 123]), ctx)).toMatch(/water/); // Hollow Wood's pond
    expect(waterBreak(post([600, 592], { water: true }), ctx)).toBeNull();
    expect(waterBreak(post([600, 560]), ctx)).toBeNull();
  });

  it('finds something solid across a road or a track, and lets what has no collider stand on one', () => {
    expect(trackBreak(post([700, 345]), ctx)).toMatch(/drive|farm/); // the drive
    expect(trackBreak(post([700, 345], { solid: false }), ctx)).toBeNull();
    expect(trackBreak(post([700, 352]), ctx)).toBeNull(); // on its verge
  });

  it('finds a thing out of the field or plot it belongs to', () => {
    expect(plotBreak(post([352, 150], { owner: 'north' }), ctx)).toBeNull(); // the lone oak's place
    expect(plotBreak(post([352, 150], { owner: 'top' }), ctx)).toMatch(/out of top/);
    const [x, z] = at([450, 260]);
    expect(plotBreak(post([450, 260], { owner: { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 } }), ctx)).toBeNull();
    expect(plotBreak(post([450, 262], { owner: { minX: x - 1, maxX: x + 1, minZ: z - 1, maxZ: z + 1 } }), ctx)).toMatch(/out of its plot/);
  });

  it('finds a thing in a reserved place, and leaves what it is kept for and the boundary a route crosses alone', () => {
    expect(reservedBreak(post([150, 700]), ctx)).toMatch(/trough/); // the hill's trough
    expect(reservedBreak(post([150, 700], { reserved: 'trough', solid: false }), ctx)).toBeNull();
    expect(reservedBreak(post([732, 222]), ctx)).toMatch(/pole/); // the line's pole in Lane Field
    expect(reservedBreak(post([440, 350]), ctx)).toMatch(/machinery shed/); // the farmstead's kept-clear places
    const footpath = LAYOUT.reserved.footpath[0][5];
    const [fx, fz] = footpath;
    expect(reservedBreak({ kind: 'prop', name: 'a crate', x: fx, z: fz, corners: boxCorners(fx, fz, 0.4, 0.4), solid: true }, ctx)).toMatch(/footpath/);
    expect(reservedBreak({ kind: 'hedge', name: 'a hedge', x: fx, z: fz, corners: boxCorners(fx, fz, 3, 1.3), solid: true }, ctx)).toBeNull();
  });

  it('answers a builder asking before it places: a trough moved into a gateway breaks the gateway rule', () => {
    const [x, z] = at([420, 440]);
    const trough = { kind: 'trough', name: 'a trough', x, z, corners: boxCorners(x, z, 1.2, 0.4), solid: true };
    expect(placementBreaks(trough, LAYOUT).map((b) => b.rule)).toContain('gateway');
    const [ox, oz] = at([300, 480]);
    expect(placementBreaks({ ...trough, x: ox, z: oz, corners: boxCorners(ox, oz, 1.2, 0.4) }, LAYOUT)).toEqual([]);
  });

  it('measures how far two shapes overlap, and none when they only touch', () => {
    expect(overlapDepth(boxCorners(0, 0, 1, 1), boxCorners(1.5, 0, 1, 1))).toBeCloseTo(0.5, 6);
    expect(overlapDepth(boxCorners(0, 0, 1, 1), boxCorners(2, 0, 1, 1))).toBeCloseTo(0, 6);
    expect(overlapDepth(boxCorners(0, 0, 1, 1), boxCorners(0, 3, 1, 1))).toBeLessThan(0);
    expect(overlapDepth(boxCorners(0, 0, 2, 0.1, Math.PI / 4), boxCorners(0, 0, 0.1, 0.1))).toBeGreaterThan(0);
  });
});
