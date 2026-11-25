// Everything the farm places, as numbers, and the rules a placement must keep (#1187). Pure: no Three.js. `farmPlacements` lists each thing a builder
// stands on the farm (hedges block by block with their solid boxes, walls, fences and rails, gates, buildings, trees, props, landmarks), each from the
// same function or layout entry its builder reads, so the list can't drift from what is drawn. The rules each take one thing and say why it is in the
// wrong place, or null: a builder can ask before it places (`placementBreaks`), and tests/farmPlacement.test.js runs all of them over the whole farm.
// Positions are game metres; `toPlan` turns one into the plan's metres (docs/farm-plan.md) for a message.

import { PLAN_ORIGIN } from './layoutNew.js';
import { createFields } from './fields.js';
import { roadNetwork } from './roads.js';
import { createTerrainHeight } from './terrainHeight.js';
import { Track } from './track.js';
import { layHedge, layLaneHedge } from './hedgeLay.js';
import { HEDGE_SOLID_HALF } from './hedgeSolid.js';
import { streamFor } from './propStreams.js';
import { laneHedgeRuns, laneGaps, laneGates, laneStile, sidePoint, hedgeOffset } from './laneHedges.js';
import { aRoadGaps, junctionSites, junctionFittings, bendBins } from './aRoadFittings.js';
import { neighbourLandShape } from './neighbourLand.js';
import { neighbourFarmShape } from './neighbourFarm.js';
import { yardFootprints } from './neighbourYard.js';
import { createOutbuildings } from './outbuildings.js';
import { wallBoxes } from './barn.js';
import { hutShape } from './hut.js';
import { villageShape } from './village.js';
import { wallPieces } from './moor.js';
import { createWoods } from './woods.js';
import { BUILT_KINDS, landmarksOf, pondShape } from './fieldLandmarks.js';
import { farmTreeSpots, distantTreeSpots } from './treeSpots.js';
import { polygonBounds, pointInPolygon } from './polygons.js';
import { createRiver } from './river.js';
import { riversidePlaces, fenceStretches } from './riverPlaces.js';
import { laneGateOf, laneReach, entrancePlan, entranceHedges, ENTRANCE } from './pitEntrance.js';
import { pitGrowth } from './pitGrowth.js';
import { quarryPlants } from './quarry.js';
import { pitCover, pitLip, pitTreeLine } from './pitScrub.js';

/** m: how far two shapes must overlap, or a shape reach into a place, before it counts. Less is a touch, which the rules allow. */
export const PLACE_TOLERANCE = 0.05;
/** m either side of a footpath's or bridleway's line that is kept for it. */
export const ROUTE_HALF = 1;
/** m round a reserved spot (a crossing, a trough, the moor gate, a pole) that is kept for what goes there. */
export const SPOT_RADIUS = 1.5;
/** The kinds that are a boundary: they meet a route where it crosses them (at a crossing), so only what stands on a route is a break. */
const BOUNDARY_KINDS = ['hedge', 'hedgeLeaves', 'wall', 'fence', 'rail'];

/** A place in game metres as the plan's metres, for a message: (x, z) to [x, z] on docs/farm-plan.md. */
export const toPlan = (x, z) => [Math.round((x + PLAN_ORIGIN[0]) * 10) / 10, Math.round((z + PLAN_ORIGIN[1]) * 10) / 10];

/** The corners of a box `hx` by `hz` either side of (x, z), turned `turn` about the up axis as a collider is (its local x along (cos, -sin)). */
export function boxCorners(x, z, hx, hz, turn = 0) {
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => [x + a * hx * c + b * hz * s, z - a * hx * s + b * hz * c]);
}

/** A circle as an octagon round it (it holds the circle), for the shapes the rules compare. */
export function circleCorners(x, z, r) {
  const R = r / Math.cos(Math.PI / 8);
  return Array.from({ length: 8 }, (_, i) => [x + R * Math.cos((i * Math.PI) / 4 + Math.PI / 8), z + R * Math.sin((i * Math.PI) / 4 + Math.PI / 8)]);
}

const rectCorners = (r) => [[r.minX, r.minZ], [r.maxX, r.minZ], [r.maxX, r.maxZ], [r.minX, r.maxZ]];

/** One placed thing: `kind`, `name` (what a message calls it), its middle, its footprint's corners (convex), whether it is solid, and what it may do. */
function thing(kind, name, x, z, corners, solid, extra = {}) {
  return { kind, name, x, z, corners, solid, ...extra };
}
const box = (kind, name, x, z, hx, hz, turn, solid, extra) => thing(kind, name, x, z, boxCorners(x, z, hx, hz, turn), solid, extra);
const disc = (kind, name, x, z, r, solid, extra) => thing(kind, name, x, z, circleCorners(x, z, r), solid, extra);
const rect = (kind, name, r, solid, extra) => thing(kind, name, (r.minX + r.maxX) / 2, (r.minZ + r.maxZ) / 2, rectCorners(r), solid, extra);

/** The lines of a boundary `kind` (rail, fence) as solid boxes between its gateways, as buildHomeRails and buildPitBoundary lay them (`layout.boundaries`, `layout.gateways`). */
function boundaryLines(layout, kind, half) {
  const out = [];
  (layout.boundaries ?? []).forEach((b, index) => {
    if (b.kind !== kind) return;
    const gaps = (layout.gateways ?? []).filter((g) => g.boundary === index && g.half).map((g) => [g.at - g.half, g.at + g.half]);
    let s0 = 0;
    for (let i = 0; i + 1 < b.points.length; i++) {
      const [x0, z0] = b.points[i];
      const [x1, z1] = b.points[i + 1];
      const len = Math.hypot(x1 - x0, z1 - z0);
      const ux = (x1 - x0) / len;
      const uz = (z1 - z0) / len;
      // The stretches of this side between its gaps.
      let from = 0;
      const cuts = gaps.map(([a, e]) => [a - s0, e - s0]).filter(([a, e]) => e > 0 && a < len).sort((p, q) => p[0] - q[0]);
      for (const [a, e] of [...cuts, [len, len]]) {
        const to = Math.min(len, Math.max(0, a));
        if (to - from > 0.1) {
          const m = (from + to) / 2;
          out.push(box(kind, `${kind} ${b.between?.join('|') ?? index}`, x0 + ux * m, z0 + uz * m, (to - from) / 2, half, Math.atan2(-uz, ux), true));
        }
        from = Math.max(from, e);
      }
      s0 += len;
    }
  });
  return out;
}

/**
 * Everything the farm places, from `layout` (the new farm's, `LAYOUT`): [{ kind, name, x, z, corners, solid, owner?, water?, gate?, reserved? }], game metres.
 * `owner` is the field (a key of `fields.polygons`) or the rectangle it belongs inside; `water` true for what stands in water on purpose (a bridge,
 * a pond); `gate` for a gate, which fills its gateway; `reserved` for the thing a reserved spot is kept for. `reach` is the hedge and bush models'
 * leaf reach (hedgeSolid.js `leafReach`: `{ block, bush }`), which only the game's models know; without it a block's leaves are taken to reach its
 * solid half-thickness. `fields` and `roads` may be passed in when the caller has them.
 */
export function farmPlacements(layout, { fields = createFields(layout), roads = roadNetwork(layout), reach = null } = {}) {
  const out = [];
  const add = (...things) => out.push(...things);
  const T = layout.hedgeThickness;
  const flat = () => 0; // the rules are on the plan: no height is asked of what is laid
  const blockReach = reach?.block ?? HEDGE_SOLID_HALF / 1.5;
  const bushReach = reach?.bush ?? 0.5;

  // The farm's hedges (props.js `buildHedges`): every block's leaves, every bush and every solid box, from the builder's own stream.
  {
    const random = streamFor('buildHedges');
    for (const h of fields.hedges) {
      const name = `hedge ${h.between?.join('|') ?? ''}`.trim();
      const lay = layHedge(h, { T, H: h.height ?? layout.hedgeHeight, heightAt: flat, random, blockReach, bushReach });
      for (const b of lay.blocks) add(disc('hedgeLeaves', name, b.x, b.z, blockReach * b.width, false));
      for (const b of lay.bushes) add(disc('hedgeLeaves', `${name} bush`, b.x, b.z, bushReach * b.height, false));
      for (const k of lay.colliders) add(box('hedge', name, k.x, k.z, k.hx, k.hz, k.turn, true));
    }
  }
  // Back Lane's and the A-road's hedges (backLaneProps.js `layHedges`), each from its builder's stream, whose first draws they are.
  for (const [id, stream, gapsOf] of [['backLane', 'buildBackLaneProps', (r) => laneGaps(r)], ['aRoad', 'buildARoadProps', (r) => aRoadGaps(roads, r, layout)]]) {
    const road = roads.road(id);
    if (!road) continue;
    const random = streamFor(stream);
    const name = id === 'backLane' ? "Back Lane's hedge" : "the A-road's hedge";
    for (const run of laneHedgeRuns(road, gapsOf(road))) {
      const lay = layLaneHedge(road, run, { T, H: 2, heightAt: flat, random, blockReach });
      for (const b of lay.blocks) add(disc('hedgeLeaves', name, b.x, b.z, blockReach * b.width, false));
      for (const k of lay.colliders) add(box('hedge', name, k.x, k.z, k.hx, k.hz, k.turn, true));
    }
  }
  // Her hedges across the lane (neighbourLand.js `hedgeStretches`, which neighbourLandProps.js makes solid) and her north field gate.
  const land = neighbourLandShape(layout);
  if (land) {
    for (const s of land.stretches) add(box('hedge', "the neighbour's hedge", s.x, s.z, s.hx, s.hz, 0, true));
    if (land.gate) add(box('gate', "the neighbour's field gate", land.gate.x, land.gate.z, 0.1, land.gate.width / 2, 0, true, { gate: true }));
  }
  // The rails along Home Ground and the pit's post and wire (farmsteadProps.js `buildHomeRails`, quarryProps.js `buildPitBoundary`).
  add(...boundaryLines(layout, 'rail', 0.07), ...boundaryLines(layout, 'fence', 0.07));
  // The Moor's ridge wall (moor.js `wallPieces`, which moorProps.js makes solid) and the sheep field's paddock wall (hillProps.js `buildWall`).
  if (layout.moor?.wall) for (const p of wallPieces(layout.moor.wall)) add(box('wall', 'the ridge wall', p.x, p.z, p.len / 2 + 0.05, layout.moor.wall.thickness / 2, p.yaw, true));
  const pw = layout.hill?.paddocks?.east?.wall;
  if (pw) {
    for (const [a, b] of [[pw.from, pw.gap.at - pw.gap.half], [pw.gap.at + pw.gap.half, pw.to]]) add(box('wall', 'the paddock wall', (a + b) / 2, pw.z, (b - a) / 2, 0.25, 0, true));
  }

  // The gates (props.js): each fills its own gateway, solid while it is shut.
  if (layout.gate) add(box('gate', `the ${layout.gate.side ?? ''} field gate`.replace('  ', ' '), layout.gate.x, layout.gate.z ?? layout.fieldHalf, layout.gate.width / 2 + 0.2, 0.2, 0, !layout.gate.open, { gate: true }));
  for (const g of layout.quarry?.gates ?? []) {
    add(box('gate', `the pit's ${g.open ? 'farm' : 'lane'} gate`, g.x, g.z, g.width / 2, 0.2, Math.atan2(-g.inward[0], -g.inward[1]), !g.open, { gate: true })); // across the fence, square to the way in
  }
  // The pit's lane entrance (props.js `buildPitLaneGate`, quarryProps.js `buildPitEntrance`, #1002): from the same plan the builder draws.
  const pitLane = laneGateOf(layout.quarry?.gates);
  if (pitLane && roads.road('lane')) {
    const plan = entrancePlan(pitLane, laneReach(pitLane, (x, z) => roads.onRoad('lane', x, z)));
    const yaw = plan.frame.yaw;
    for (const p of plan.posts) add(box('gate', 'a post of the pit\'s lane gate', p.x, p.z, ENTRANCE.postW / 2, ENTRANCE.postW / 2, yaw, true, { gate: true }));
    for (const b of plan.blocks) add(box('prop', 'a concrete block at the pit\'s lane gate', b.x, b.z, ENTRANCE.block.l / 2, ENTRANCE.block.w / 2, yaw + b.turn, true));
    for (const p of plan.barrier.posts) add(box('prop', 'a post of the height barrier at the pit\'s lane gate', p.x, p.z, ENTRANCE.barrier.post / 2 + 0.01, ENTRANCE.barrier.post / 2 + 0.01, yaw, true));
    for (const p of plan.sign.posts) add(box('prop', 'a post of the works sign at the pit\'s lane gate', p.x, p.z, 0.04, 0.04, yaw, true));
    for (const b of plan.buddleia) add(disc('plant', 'a buddleia at the pit\'s lane gate', b.x, b.z, b.h * 0.4, false));
    for (const lay of entranceHedges(plan, { T, H: layout.hedgeHeight, heightAt: flat, blockReach })) {
      for (const b of lay.blocks) add(disc('hedgeLeaves', 'the hedge at the pit\'s lane gate', b.x, b.z, blockReach * b.width, false));
      for (const k of lay.colliders) add(box('hedge', 'the hedge at the pit\'s lane gate', k.x, k.z, k.hx, k.hz, k.turn, true));
    }
  }
  if (layout.road?.bypass) add(box('gate', 'the bypass gate', layout.road.bypass.x, layout.road.bypass.z, 0.2, layout.road.bypass.width / 2 + 0.3, 0, true, { gate: true }));
  if (layout.moor?.gate) add(box('gate', 'the moor gate', layout.moor.gate.x, layout.moor.gate.z, 0.2, layout.moor.gate.width / 2 + 0.3, layout.moor.gate.yaw, true, { gate: true }));
  const backLane = roads.road('backLane');
  if (backLane) {
    for (const g of laneGates(backLane)) {
      const mid = sidePoint(backLane, g.s, g.side, hedgeOffset(backLane, g.s, g.side));
      add(box('gate', `Back Lane's ${g.id} gate`, mid.x, mid.z, 2, 0.12, Math.atan2(-mid.tz, mid.tx), true, { gate: true }));
    }
    // The footpath's stile, solid (#1017): its gap's own, as a gate is its gateway's.
    const stile = laneStile(backLane);
    if (stile) add(box('gate', "Back Lane's stile", stile.x, stile.z, stile.box.hx, stile.box.hz, stile.yaw, true, { gate: true }));
  }
  // The lane's fittings (aRoadProps.js, laneFittingsProps.js): the gateways' posts and shut leaves, the grit bins, the postbox, the bin stand, the fingerposts and signs.
  const F = layout.laneFittings;
  if (F) {
    for (const g of F.gateways) add(box('gate', `the lane's gateway at plan z ${toPlan(g.x, g.z)[1]}`, g.x, g.z, 0.12, g.width / 2 + 0.12, 0, true, { gate: true })); // its shut leaf and its two posts
    const lane = roads.road('lane');
    if (lane) for (const b of bendBins(lane, F.gritBins.map((p) => [p.x, p.z]))) add(box('prop', 'a grit bin by the lane', b.x, b.z, 0.5, 0.32, b.yaw, true));
    add(disc('prop', 'the postbox', F.postbox.x, F.postbox.z, 0.15, true), box('prop', 'the bin stand', F.binStand.x, F.binStand.z, 0.4, 0.9, 0, true));
    if (F.southFingerpost) add(disc('prop', 'the south fingerpost', F.southFingerpost.x, F.southFingerpost.z, 0.12, true));
  }
  if (layout.junctions && roads.road('aRoad')) {
    for (const f of junctionFittings(junctionSites(roads, layout.junctions))) add(disc('prop', `the ${f.site} junction's ${f.kind}`, f.x, f.z, f.kind.startsWith('grit') ? 0.55 : 0.1, f.kind !== 'gritHeap'));
  }

  // Buildings: the barn's walls, the Dutch barn, the field shed and the muck heap, the shepherd's hut, the neighbour's yard and the village.
  for (const w of wallBoxes(layout)) add(box('building', `the barn's ${w.id ?? 'wall'}`, w.x, w.z, w.hx, w.hz, 0, true, { owner: 'farmstead' }));
  const ob = createOutbuildings(layout);
  if (ob.barn) add(rect('building', 'the Dutch barn', ob.barn.outer, true, { owner: 'farmstead' }));
  if (ob.shed) add(rect('building', 'the field shed', ob.shed.outer, true));
  if (ob.heap) add(rect('prop', 'the muck heap', ob.heap, true, { owner: 'farmstead' }));
  const hut = hutShape(layout);
  if (hut) add(rect('building', "the shepherd's hut", hut.box(), true, { owner: 'hill' }));
  const nf = neighbourFarmShape(layout);
  if (nf) {
    const yard = nf.yard;
    for (const w of nf.walls) add(box('wall', "the neighbour's yard wall", w.x, w.z, w.hx, w.hz, 0, true));
    for (const [name, d] of [['house', nf.house], ['wing', nf.house?.wing], ['lean-to', nf.house?.leanTo], ['barn', nf.barn], ['parlour', nf.parlour], ['tank room', nf.tankRoom]]) {
      if (d?.outer) add(rect('building', `the neighbour's ${name}`, d.outer, true, { owner: yard }));
    }
    if (nf.slurry) add(disc('building', "the neighbour's slurry store", nf.slurry.x, nf.slurry.z, nf.slurry.r, true, { owner: yard }));
    for (const p of yardFootprints(nf.furniture)) add(rect('prop', `the neighbour's ${p.kind}`, p.outer, true, { owner: yard }));
  }
  if (layout.village) {
    const v = villageShape(layout);
    v.footprints.forEach((f, i) => add(rect('building', `a village building at plan ${toPlan((f.minX + f.maxX) / 2, (f.minZ + f.maxZ) / 2)}`, f, true, { index: i })));
    for (const w of v.walls ?? []) add(box('wall', 'a village wall', w.x, w.z, w.hx, w.hz, 0, true));
  }
  if (layout.farmBridge) {
    const b = layout.farmBridge;
    add(box('bridge', 'the farm bridge', b.x, b.z, b.width / 2, b.length / 2, b.yaw ?? 0, false, { water: true }));
  }

  // The farmstead's and Home Ground's things (layoutNew.js `FARMSTEAD_PLAN`), each where its builder stands it.
  const at = (o) => (Array.isArray(o) ? { x: o[0], z: o[1] } : o);
  if (layout.harrows) add(box('prop', 'the chain harrows', layout.harrows.x, layout.harrows.z, 1.6, 1.4, layout.harrows.yaw ?? 0, true));
  for (const k of ['trailer', 'tipTrailer', 'sprayer']) if (layout[k]) add(box('vehicle', `the ${k}`, layout[k].x, layout[k].z, 1.1, 2, layout[k].yaw ?? 0, true));
  for (const [k, car] of Object.entries(layout.cars ?? {})) add(box('vehicle', `the ${k}`, car.x, car.z, 0.95, 2.3, car.yaw ?? 0, true));
  for (const k of ['dieselBowser', 'fuelTank', 'generator']) if (layout[k]) add(disc('prop', `the ${k}`, layout[k].x, layout[k].z, 1, true, { owner: 'farmstead' }));
  if (layout.bonfire) add(disc('prop', 'the bonfire', layout.bonfire.x, layout.bonfire.z, 1.2, false, { owner: 'home' }));
  if (layout.jumpRamp) add(box('prop', 'the jump ramp', layout.jumpRamp.x, layout.jumpRamp.z, layout.jumpRamp.width / 2, layout.jumpRamp.length / 2, layout.jumpRamp.yaw, true, { owner: 'home' }));
  for (const [x, z] of layout.strawBaleSpots ?? []) add(disc('prop', 'a straw bale', x, z, 0.75, true));
  for (const [x, z] of layout.brushwood ?? []) add(disc('prop', 'a brushwood bundle', x, z, 0.6, false));
  for (const s of layout.jerryCanSpots ?? []) add(disc('prop', `a jerry can ${s.where ?? ''}`.trim(), s.x, s.z, 0.25, false));
  const A = layout.farmAnimals;
  if (A && layout.farmstead?.orchard) {
    for (const [k, r] of [['hen pen', A.pen], ['sty', A.sty]]) add(rect('prop', `the ${k}`, r, true, { owner: layout.farmstead.orchard }));
  }
  if (layout.silage) add(disc('prop', 'the silage stack', at(layout.silage).x + 2, at(layout.silage).z + 2, 2.5, true, { owner: 'ley' }));
  // The wood's fallen logs and branches (woods.js `createWoods`, which woodsProps.js `buildLogs` makes solid).
  const woods = createWoods(layout);
  for (const l of [...(woods?.logs ?? []), ...(woods?.deadwood ?? [])]) add(box('prop', 'a log in the wood', l.x, l.z, l.len / 2, l.r, l.yaw, true, { owner: 'wood' }));

  // Each field's landmark (layoutNew.js `FIELD_LANDMARKS_PLAN`), solid where it is built; the pond is water on purpose.
  for (const l of layout.fieldLandmarks ?? []) {
    const built = BUILT_KINDS.includes(l.kind);
    const owner = l.field === 'moor' ? null : l.field;
    if (l.kind === 'farPond') add(thing('landmark', 'the far pond', l.at[0], l.at[1], circleCorners(l.at[0], l.at[1], Math.min(l.rx, l.rz)), false, { owner, water: true }));
    else if (l.trees) l.trees.forEach(([x, z]) => add(disc('tree', `a tree of the ${l.kind}`, x, z, 0.5, built, { owner })));
    else add(disc('landmark', `the ${l.kind}`, l.at[0], l.at[1], 0.6, built, { owner, reserved: l.kind === 'powerLine' ? 'pole' : undefined }));
  }
  // The troughs and the line's poles held for later items (layoutNew.js `RESERVED_PLAN`).
  const R = layout.reserved;
  for (const t of R?.troughs ?? []) add(box('trough', `the trough held in ${t.field}`, t.at[0], t.at[1], 1.2, 0.4, 0, false, { owner: t.field, reserved: 'trough' }));
  for (const p of R?.powerLine?.poles ?? []) add(disc('pole', 'a pole of the 11 kV line', p[0], p[1], 0.15, false, { reserved: 'pole' }));
  // The trees: the farm's own oaks (props.js `buildTrees`), solid trunks, and the clumps on the far hedgerows (`buildDistantTrees`), which have none.
  for (const t of farmTreeSpots(layout, streamFor('buildTrees'))) add(disc('tree', 'an oak by the yard', t.x, t.z, 0.32 * t.s, true));
  for (const t of distantTreeSpots(layout, fields, roads, streamFor('buildDistantTrees'))) add(disc('tree', 'a distant tree clump', t.x, t.z, 0.4 * t.s, false));
  for (const [x, z, s] of layout.hill?.hedgeOaks ?? []) add(disc('tree', 'a hedgerow oak on the hill', x, z, 0.32 * s, true));
  // Brook Meadow and the brook past it (hillProps.js `buildRiverside`, #999), on the ground as the game shapes it: the crossing's posts and the river
  // gates stand in the water on purpose, and so do the reeds and rushes of the shallows and the crossing's stones; the willows, the meadow's grazing and
  // the brook's stock fence don't. The meadow's things belong to Brook Meadow.
  const brook = layout.hill?.riverside?.gates ? placementContext(layout, { fields, roads }).heights.brook : null;
  const river = brook ? createRiver(layout, brook) : null;
  if (river) {
    for (const p of river.posts()) add(disc('post', 'a post at the river crossing', p.x, p.z, 0.08, true, { water: true }));
    for (const h of river.hurdles(fields.gateways)) add(box('gate', 'a river gate', h.x, h.z, 0.2, h.half, 0, true, { water: true, gate: true }));
    for (const w of river.willows()) add(disc('tree', 'a willow by the river', w.x, w.z, 0.48, true));
    for (const r of river.reeds(streamFor('riverReeds'))) add(disc('plant', 'a reed by the river', r.x, r.z, 0.2, false, { water: brook.waterAt(r.x, r.z) > 0.05 }));
    const P = riversidePlaces(layout, brook, { roads });
    const plants = [['rushes', 'a rush', 0.12], ['sedge', 'a sedge', 0.15], ['brookReeds', 'a reed by the brook', 0.2], ['stones', 'a stone at the crossing', 0.1]];
    for (const [key, name, r] of plants) for (const p of P[key]) add(disc(key === 'stones' ? 'prop' : 'plant', name, p.x, p.z, r * p.s, false, { water: p.water }));
    for (const [key, name, r] of [['tussocks', 'a tussock in Brook Meadow', 0.18], ['thistles', 'a thistle in Brook Meadow', 0.2], ['docks', 'a dock in Brook Meadow', 0.3], ['dung', 'a cowpat in Brook Meadow', 0.22]]) {
      for (const p of P[key]) add(disc('plant', name, p.x, p.z, r * p.s, false, { owner: 'brook' }));
    }
    for (const [[ax, az], [bx, bz]] of fenceStretches(P.fence)) {
      const len = Math.hypot(bx - ax, bz - az);
      add(box('fence', "the brook's stock fence", (ax + bx) / 2, (az + bz) / 2, len / 2, 0.07, Math.atan2(-(bz - az) / len, (bx - ax) / len), true));
    }
  }
  // What has grown over the Old Pit's floor (quarryProps.js `buildPitGrowth`, pitGrowth.js, #1003): the heaps' grass, birch seedlings and buddleia,
  // the reeds, rushes and sedge round the pond (at its edge, not in it), the weeds at the plant's footings and pad, and the lumps off the pad's edge.
  // Nothing in it is solid. What grows round the relics buildSite deals in its drawing code joins the list with them (#1229).
  const pitQuarry = layout.quarry?.outline ? placementContext(layout, { fields, roads }).heights.quarry : null;
  if (pitQuarry) {
    const G = pitGrowth(pitQuarry);
    const owner = fields.polygons?.pit ? { owner: 'pit' } : {};
    const grown = [
      ['tufts', 'grass on a heap in the pit', (p) => 0.2 * p.s], ['seedlings', 'a birch seedling on a heap in the pit', (p) => 0.25 * p.h],
      ['buddleia', 'a buddleia on a heap in the pit', (p) => 0.4 * p.h], ['reeds', "a reed at the pit's pond", (p) => 0.2 * p.s],
      ['rushes', "a rush at the pit's pond", (p) => 0.12 * p.s], ['sedge', "a sedge at the pit's pond", (p) => 0.15 * p.s],
      ['footings', "a weed at a footing of the pit's plant", (p) => 0.2 * p.s], ['padWeeds', "a weed on the pit plant's pad", (p) => 0.15 * p.s],
      ['padLumps', "a lump off the pit plant's pad", (p) => p.size / 2],
    ];
    for (const [key, name, r] of grown) for (const p of G[key]) add(disc(key === 'padLumps' ? 'prop' : 'plant', name, p.x, p.z, r(p), false, owner));
    // The field gone to scrub (#1004, quarry.js `quarryPlants`, pitScrub.js): the bushes (none solid), the oaks in the rough and the big boulders on
    // the floor (solid), the stones and flints, the rough grass and thistles, the roots at the lip and the scree at the foot, and the tree line, whose
    // ash and oak standards are solid and whose hawthorns are not.
    const P = quarryPlants(pitQuarry);
    const reach = { hawthorn: 1.5, gorse: 0.75, bramble: 0.7, birch: 0.4 };
    // Named for the Old Pit, so they are told apart from #1003's growth on its floor.
    for (const [x, z, s, kind] of P.bushes) add(disc('plant', `a ${kind} in the Old Pit's field`, x, z, reach[kind] * s, false, owner));
    for (const [x, z, s] of P.trees) add(disc('tree', "an oak in the Old Pit's field", x, z, 0.32 * s, true, owner));
    for (const [x, z, size] of P.big) add(disc('prop', "a big boulder on the Old Pit's floor", x, z, size * 0.96, true, owner)); // its collider's corners, however it is turned
    for (const [x, z, size] of [...P.boulders, ...P.stones]) add(disc('prop', "a stone in the Old Pit's walls or field", x, z, size * 0.6, false, owner));
    const C = pitCover(pitQuarry);
    for (const p of C.tussocks) add(disc('plant', "rough grass in the Old Pit's field", p.x, p.z, 0.2 * p.s, false, owner));
    for (const p of C.thistles) add(disc('plant', "a thistle in the Old Pit's field", p.x, p.z, 0.2 * p.s, false, owner));
    const L = pitLip(pitQuarry);
    for (const p of L.roots) add(disc('plant', "roots at the Old Pit's lip", p.x, p.z, 0.4 * p.s, false, owner));
    for (const p of L.scree) add(disc('prop', "scree at the foot of the Old Pit's walls", p.x, p.z, p.s, false, owner));
    for (const t of pitTreeLine(pitQuarry, layout.boundaries, fields.kinds)) {
      const standard = t.kind !== 'hawthorn';
      add(disc(standard ? 'tree' : 'plant', `a ${t.kind} in the Old Pit's tree line`, t.x, t.z, (standard ? (t.kind === 'ash' ? 0.38 : 0.35) : 1.6) * t.s, standard, owner));
    }
  }
  return out;
}

/**
 * What `farmPlacements` reads, by builder (props.js `buildProps`), and the builders it doesn't: the test holds the three to the builders that run.
 * `read` builders are listed by what they place (with `partly` saying what of theirs is not yet: their small fittings are worked out inside their
 * drawing code), `flat` ones place nothing that stands, and `notYet` ones place things the list doesn't have yet, for the same reason.
 */
export const PLACEMENT_SOURCES = {
  read: [
    'buildBarn', 'buildHedges', 'gates', 'buildPitLaneGate', 'buildHomeRails', 'buildBales', 'buildOutbuildings', 'buildNeighbourFarm', 'buildBackLaneProps', 'buildMoorProps',
    'buildNeighbourLand', 'buildARoadProps', 'buildLaneFittings', 'buildVillage', 'buildFarmBridge', 'buildTrees', 'buildDistantTrees', 'buildHill', 'buildWoods', 'buildQuarry',
    'buildFieldLandmarks', 'buildJumpRamp',
  ],
  partly: {
    buildBackLaneProps: 'its hedgerow trees, signs, drains and the gates\' posts',
    buildARoadProps: 'its hedgerow trees and the bus stop flag',
    buildMoorProps: 'the stile, the trig pillar, the cairn, the grids\' wings and the bridle gates',
    buildLaneFittings: 'the cottages and their front walls',
    buildVillage: 'its furniture, and the small farm\'s walls and buildings',
    buildHill: 'the hut\'s steps, the climb\'s flags, the flask rock and the posts of Brook Meadow\'s gateway from Hay Meadow',
    buildWoods: 'the trail\'s signs and the woodpile\'s scenery',
    buildQuarry: 'the screening plant, the digger and the heaps\' drums and tyres; and, with the relics they stand by (#1003), the weeds through the digger\'s tracks and the drums, the cabin\'s chair and table, and the container\'s hardstanding and birch; and (#1004) the scrub thick round the container, the dead trees and the pallet',
    buildFieldLandmarks: 'the gateposts\' and roller\'s own boxes (their places are listed)',
  },
  flat: {
    buildCattleGrid: 'bars in the road, driven over',
    buildReflectorPosts: 'posts on the drive\'s verge with no collider',
    buildDriveVerge: 'the drive\'s verge: grass and its edge',
    buildPublicLane: 'the lane\'s tarmac',
    buildBackLane: 'Back Lane\'s tarmac',
    buildPaddock: 'today\'s farm only: nothing on the new one',
    buildWeatherVane: 'on the barn\'s ridge',
    buildUpperThornby: 'the far hamlet on the hill, beyond the map',
    buildBrookCulvert: 'under the road where the brook crosses it',
    buildPuddles: 'water in the ground',
    buildBogs: 'mud in the ground',
    buildGrass: 'ground cover',
    buildStubble: 'ground cover',
  },
  notYet: {
    buildGardenWall: 'the garden\'s wall round `farmstead.garden`',
    buildYardGates: 'the yard\'s steel gates and their posts',
    buildYardFurniture: 'the barn wall\'s gear, the heaps, the pallets and the tyres',
    buildStackyardKit: 'the stackyard\'s bales and the bale spike',
    buildYardLights: 'the floodlight pole behind the tanks',
  },
};

// The rules ------------------------------------------------------------------

const cache = new WeakMap();

/**
 * What the rules need of the farm, worked out once a layout: the gateways' openings, the water, the roads and tracks, the fields' outlines and the
 * reserved places. `{ layout, fields, roads, heights }` may be passed in.
 */
export function placementContext(layout, { fields = createFields(layout), roads = roadNetwork(layout), heights = null } = {}) {
  if (cache.has(layout)) return cache.get(layout);
  const h = heights ?? createTerrainHeight(layout, new Track(layout.trackPoints));
  // The openings: every gateway of the farm's (`GATEWAYS_PLAN`, through `fields.gateways`), a rectangle `half` m either side of its middle along the line and
  // a hedge's solid half-thickness across, and Back Lane's gaps (its gates, the ford, the stile and the bridle gates). A shut one has no way through, so is left out.
  const openings = [];
  for (const g of fields.gateways) {
    if (!g.gap || g.gap.shut) continue; // a way across with no gap of its own (fieldPlan.js) has no opening to keep clear
    const e = g.via.edge;
    openings.push({ name: `the gateway ${g.a}|${g.b}${g.gap.id ? ` (${g.gap.id})` : ''}`, x: e.x1 + e.dx * g.via.at, z: e.z1 + e.dz * g.via.at, ux: e.dx, uz: e.dz, half: g.gap.half, across: HEDGE_SOLID_HALF });
  }
  if (roads.road('backLane')) {
    const road = roads.road('backLane');
    for (const g of laneGaps(road)) {
      if (g.kind === 'common') continue; // the common's whole side is open: not a gateway
      for (const side of g.side === undefined ? [1, -1] : [g.side]) {
        const p = sidePoint(road, g.s, side, hedgeOffset(road, g.s, side));
        openings.push({ name: `Back Lane's ${g.kind}${g.id ? ` (${g.id})` : ` at plan ${toPlan(p.x, p.z)}`}`, x: p.x, z: p.z, ux: p.tx, uz: p.tz, half: g.half, across: HEDGE_SOLID_HALF });
      }
    }
  }
  const ponds = landmarksOf(layout, 'farPond').map((l) => pondShape(l));
  const waterAt = (x, z) => Math.max(h.hill?.waterAt(x, z) ?? 0, h.woods?.waterAt(x, z) ?? 0, h.quarry?.waterAt(x, z) ?? 0, h.brook?.waterAt(x, z) ?? 0, ponds.some((p) => p.through(x, z) < 1) ? 1 : 0);
  const R = layout.reserved ?? {};
  const routes = [...(R.footpath ?? []).map((pts) => ({ name: 'the footpath', pts })), ...(R.bridleway ?? []).map((pts) => ({ name: 'the bridleway', pts }))];
  const spots = [
    ...(R.crossings ?? []).map((c) => ({ name: `the ${c.route}'s crossing`, at: c.at, for: 'crossing' })),
    ...(R.troughs ?? []).map((t) => ({ name: `the trough's place in ${t.field}`, at: t.at, for: 'trough' })),
    ...(R.moorGate ? [{ name: 'the moor gate', at: R.moorGate.at, for: 'gate' }] : []),
    ...(R.powerLine?.poles ?? []).map((p) => ({ name: 'a pole of the 11 kV line', at: p, for: 'pole' })),
  ];
  const keptClear = (layout.farmstead?.keptClear ?? []).map((k) => ({ name: `the ${k.name} (${k.by})`, rect: k, for: k.name === '11 kV pole' ? 'pole' : null }));
  const ctx = { layout, fields, roads, heights: h, openings, waterAt, routes, spots, keptClear };
  cache.set(layout, ctx);
  return ctx;
}

const boundsOf = (pts) => polygonBounds(pts);

/** How far the convex shapes `a` and `b` overlap along the axis that parts them most (0 or less: they don't). */
export function overlapDepth(a, b) {
  let least = Infinity;
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const [x0, z0] = poly[i];
      const [x1, z1] = poly[(i + 1) % poly.length];
      const nx = z1 - z0;
      const nz = x0 - x1;
      const len = Math.hypot(nx, nz);
      if (len < 1e-9) continue;
      let amin = Infinity;
      let amax = -Infinity;
      let bmin = Infinity;
      let bmax = -Infinity;
      for (const [x, z] of a) {
        const p = (x * nx + z * nz) / len;
        amin = Math.min(amin, p);
        amax = Math.max(amax, p);
      }
      for (const [x, z] of b) {
        const p = (x * nx + z * nz) / len;
        bmin = Math.min(bmin, p);
        bmax = Math.max(bmax, p);
      }
      least = Math.min(least, Math.min(amax, bmax) - Math.max(amin, bmin));
      if (least <= 0) return least;
    }
  }
  return least;
}

/** Points over a shape a `step` apart, and at least `inset` m inside its edges: where a thing is, for the rules that ask of the ground. */
export function pointsIn(corners, step = 0.5, inset = PLACE_TOLERANCE) {
  const b = boundsOf(corners);
  const pts = [];
  const nx = Math.max(1, Math.ceil((b.maxX - b.minX) / step));
  const nz = Math.max(1, Math.ceil((b.maxZ - b.minZ) / step));
  for (let i = 0; i <= nx; i++) {
    for (let k = 0; k <= nz; k++) {
      const x = b.minX + ((b.maxX - b.minX) * i) / nx;
      const z = b.minZ + ((b.maxZ - b.minZ) * k) / nz;
      if (pointInPolygon(corners, x, z, inset)) pts.push([x, z]);
    }
  }
  if (!pts.length) pts.push([corners.reduce((s, p) => s + p[0], 0) / corners.length, corners.reduce((s, p) => s + p[1], 0) / corners.length]);
  return pts;
}

/** Rule: nothing solid and no hedge in a gateway's opening. A gate is its gateway's own. */
export function gatewayBreak(t, ctx) {
  if (t.gate || !(t.solid || t.kind === 'hedgeLeaves')) return null;
  const tb = boundsOf(t.corners);
  for (const o of ctx.openings) {
    const reach = o.half + o.across;
    if (tb.maxX < o.x - reach || tb.minX > o.x + reach || tb.maxZ < o.z - reach || tb.minZ > o.z + reach) continue;
    const opening = boxCorners(o.x, o.z, o.half, o.across, Math.atan2(-o.uz, o.ux));
    if (overlapDepth(t.corners, opening) > PLACE_TOLERANCE) return `in ${o.name}'s opening`;
  }
  return null;
}

/** Rule: nothing placed in the brook, a ford or a pond (the water of the stream, the river, the wood's and the pit's ponds and the far pond). A bridge is meant to be. */
export function waterBreak(t, ctx) {
  if (t.water) return null;
  for (const [x, z] of pointsIn(t.corners, 0.7)) if (ctx.waterAt(x, z) > 0.05) return `in the water at plan ${toPlan(x, z)}`;
  return null;
}

/** Rule: nothing solid across the drive, a lane or a track (any road of `layout.roads`: the tarmac, the stone tracks, the boundary track). */
export function trackBreak(t, ctx) {
  if (!t.solid) return null;
  const tb = boundsOf(t.corners);
  const near = ctx.roads.roads.filter((r) => {
    const b = ctx.roads.boundsOf(r.id, 0);
    return b && !(tb.maxX < b.minX || tb.minX > b.maxX || tb.maxZ < b.minZ || tb.minZ > b.maxZ);
  });
  if (!near.length) return null;
  for (const [x, z] of pointsIn(t.corners, 0.4)) {
    for (const r of near) if (ctx.roads.onRoad(r.id, x, z)) return `across ${r.name ?? r.id} at plan ${toPlan(x, z)}`;
  }
  return null;
}

/** Rule: what belongs to a field or a plot stands inside its outline (`owner`: a field's name, or a rectangle). */
export function plotBreak(t, ctx) {
  if (!t.owner) return null;
  const poly = typeof t.owner === 'string' ? ctx.fields.polygons[t.owner] : rectCorners(t.owner);
  if (!poly) return `belongs to ${t.owner}, which isn't a field`;
  for (const [x, z] of t.corners) if (!pointInPolygon(poly, x, z, -PLACE_TOLERANCE)) return `out of ${typeof t.owner === 'string' ? t.owner : 'its plot'} at plan ${toPlan(x, z)}`;
  return null;
}

/** The nearest a point comes to a line of points. */
function toLine(pts, x, z) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const L2 = dx * dx + dz * dz || 1;
    const k = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2));
    best = Math.min(best, Math.hypot(x - ax - k * dx, z - az - k * dz));
  }
  return best;
}

/**
 * Rule: nothing in a reserved place (`RESERVED_PLAN`, and the farmstead's kept-clear rectangles): no solid thing on a footpath's or bridleway's line (a
 * boundary meets it where it crosses), nothing on a crossing, a trough's place, the moor gate or a pole but what it is kept for, nothing in a kept-clear rectangle.
 */
export function reservedBreak(t, ctx) {
  const boundary = BOUNDARY_KINDS.includes(t.kind);
  const tb = boundsOf(t.corners);
  if (t.solid && !boundary && !t.gate) {
    for (const r of ctx.routes) {
      for (const [x, z] of pointsIn(t.corners, 0.5, 0)) if (toLine(r.pts, x, z) < ROUTE_HALF - PLACE_TOLERANCE) return `on ${r.name} at plan ${toPlan(x, z)}`;
    }
  }
  if (!boundary) {
    for (const s of ctx.spots) {
      if (t.reserved === s.for || (s.for === 'gate' && t.gate)) continue;
      const [sx, sz] = s.at;
      if (tb.maxX < sx - SPOT_RADIUS || tb.minX > sx + SPOT_RADIUS || tb.maxZ < sz - SPOT_RADIUS || tb.minZ > sz + SPOT_RADIUS) continue;
      if (overlapDepth(t.corners, circleCorners(sx, sz, SPOT_RADIUS)) > PLACE_TOLERANCE) return `on ${s.name}`;
    }
  }
  for (const k of ctx.keptClear) {
    if (t.reserved && t.reserved === k.for) continue;
    if (overlapDepth(t.corners, rectCorners(k.rect)) > PLACE_TOLERANCE) return `in ${k.name}`;
  }
  return null;
}

/** The rules by name, in the order a message gives them. */
export const PLACEMENT_RULES = { gateway: gatewayBreak, water: waterBreak, track: trackBreak, plot: plotBreak, reserved: reservedBreak };

/**
 * Every rule `t` breaks on `layout`'s farm: [{ rule, why }], empty if it may stand there. For a builder to ask before it places: make `t` with
 * `boxCorners` or `circleCorners` ({ kind, name, x, z, corners, solid, owner? }).
 */
export function placementBreaks(t, layout, ctx = placementContext(layout)) {
  const out = [];
  for (const [rule, fn] of Object.entries(PLACEMENT_RULES)) {
    const why = fn(t, ctx);
    if (why) out.push({ rule, why });
  }
  return out;
}

