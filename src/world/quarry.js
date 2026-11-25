// The gravel pit (layout.quarry), in the hedged field north of the barley field: the lie of the ground (a bowl cut into a levelled patch, a haul road
// that winds down its wall, a pond in the low corner, heaps of graded stone on the floor), the loose surface, the climb that goes up its longest
// wall, and where scrub and boulders may stand. Pure: used by the terrain, the fields, the props, the map and the girls. Nothing here is drawn;
// the meshes are in quarryProps.js.
//
// The pit's shape is dealt from the farm's seed (`dealPit`), so every farm has its own pit and keeps it: how big, how it is turned, how ragged
// its rim is, which wall is the climb wall (the long, gentle one you can ride straight up) and where the buttresses (the spurs you can't) are,
// which way the haul road winds, where the pond and the heaps are.

import { createRandom } from '../core/random.js';
import { dealPlant, inPlantsWay, plantPadWeight } from './plantSite.js';
import { polygonEdges, pointInPolygon, outsidePolygon, polygonBounds, outsideBounds } from './polygons.js';
import { laneGateOf, spoilBankOf, bankRise } from './pitEntrance.js';
import { streamFor } from './propStreams.js';
import { byArea, fieldArea, bowlArea, scrubOk } from './pitScrub.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const TAU = Math.PI * 2;
/** The shortest signed way round from angle b to angle a (-PI..PI). */
const angleDiff = (a, b) => {
  const d = (a - b) % TAU;
  return d > Math.PI ? d - TAU : d < -Math.PI ? d + TAU : d;
};
/** 0..1 across a ramp, half straight and half smoothstep, so its steepest part is a quarter again its average, not half as much again. */
const softRamp = (t) => {
  const k = clamp(t, 0, 1);
  return 0.5 * k + 0.5 * k * k * (3 - 2 * k);
};
const inRect = (r, x, z, margin = 0) => x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

const ROAD_STEP = 2.5; // metres between the haul road's sample points
const ROAD_SHOULDER = 4; // metres the road's ledge takes to ease into the wall either side of its surface
const ZONE_FADE = 14; // metres beyond the rim that the ground is eased from the pit's level back into the field's
const RIM_MARGIN = 7; // the closest a rim may come to the field's hedges (today's small field only: a field with an `outline` has room for the pit as dealt)
const WAIT_IN = 3.5; // metres inside the way-in gate, and along from it, where a girl following you waits
const PAST_GATE = 8; // metres in from the way-in gate that counts as having gone in

/**
 * The pit's gates, whatever shape the field is (#685). Today's field has one, in its south side, which the haul road and the girls both use; the
 * new farm's has two: the lane gate (shut, the haul road ends in it) and the farm gate from the stone track (open, the way in). Each is
 * `{ id, x, z, width, open, inward }`, `inward` the unit vector from it into the field. `haul` is the one the road starts at, `way` the one you come in by.
 */
export function gatesOf(q) {
  const gates = q.gates ?? [{ id: 'quarry', ...q.gate, z: q.maxZ, inward: [0, -1] }];
  return { gates, haul: gates.find((g) => g.haul) ?? gates[0], way: gates.find((g) => g.open) ?? gates[0] };
}

/** The ellipse's radius at angle `a` (in the pit's own frame) before the rim's ragged bumps. */
const ellipseRadius = (pit, a) => (pit.rx * pit.rz) / Math.hypot(pit.rz * Math.cos(a), pit.rx * Math.sin(a));

/** The angle the pit climb goes up: the middle of the climb wall. */
const climbAngle = (pit) => pit.climbAt;

/** The rim's ragged factor at angle `a`: 1 plus the bumps. */
function rimFactor(pit, a) {
  let f = 1;
  for (const [k, amp, ph] of pit.bumps) f += amp * Math.cos(k * a + ph);
  return f;
}

/** Metres from lip to floor along angle `a` before the buttresses are cut into the wall: the haul roads follow this, so they keep a smooth line across them. */
function baseRun(pit, a) {
  const wall = Math.exp(-((angleDiff(a, pit.climbAt) / pit.climbWidth) ** 2));
  return (pit.climbRun + (pit.gentleRun - pit.climbRun) * (1 - wall)) * (1 + 0.1 * Math.sin(3 * a + 1.1) + 0.05 * Math.sin(7 * a));
}

/** Metres from lip to floor along angle `a`: the other walls' run, the climb wall's (a Gaussian round `climbAt`, the gentlest and longest) and the buttresses' (short spurs of hard rock). */
function runFor(pit, a) {
  let run = baseRun(pit, a);
  const rim = ellipseRadius(pit, a) * rimFactor(pit, a);
  for (const b of pit.buttresses) run = Math.min(run, run + (b.run - run) * Math.exp(-((angleDiff(a, b.at) / (b.w / rim)) ** 2)));
  return Math.min(run, rim * 0.78); // the floor never closes up at the middle
}

/**
 * How deep, as a share of the pit's depth, the ground is `u` of the way from the lip (0) to the floor (1): a rounded lip, the steepest going in
 * the middle of the bank (about 1.2 times its average) and a scree toe easing out onto the floor.
 */
const bankShape = (u) => (u <= 0 ? 0 : u >= 1 ? 1 : 0.55 * u + 0.45 * smoothstep(0, 1, u));
/** The `u` at which the bank is `t` of the way down (the inverse of `bankShape`, by halving). */
const bankAt = (t) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (bankShape(mid) < t) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
};

/**
 * A pit's shape for one farm, from `random` (0..1): its size, turn and ragged rim, the way the haul road winds, the climb wall opposite it with
 * its buttresses, the pond by the climb wall's foot and the heaps on the floor. `q` is `layout.quarry` (the field and its gate).
 */
export function dealPit(q, random) {
  const r = (lo, hi) => lo + random() * (hi - lo);
  const { haul } = gatesOf(q);
  const x = (q.centre ? q.centre.x : (q.minX + q.maxX) / 2) + r(-4, 4);
  const z = (q.centre ? q.centre.z : q.maxZ - 66) + r(-3, 3);
  const depth = r(13, 16);
  const pit = {
    x, z,
    rx: r(45, 48), // the long way, turned to run from the gate to the climb wall by `yaw`
    rz: r(36, 39),
    yaw: Math.PI / 2 + r(-0.15, 0.15),
    depth,
    bumps: [[2, r(0.03, 0.05), r(0, TAU)], [3, r(0.02, 0.04), r(0, TAU)], [5, r(0.01, 0.025), r(0, TAU)]], // [harmonic, share of the radius, phase]
    gentleRun: depth * r(1.15, 1.25), // metres from lip to floor on the other walls (about 40 degrees, a little more at its steepest)
    climbRun: depth * r(2.2, 2.3), // and on the climb wall, the longest and gentlest (about 25 degrees on average, 30 at its steepest)
    climbWidth: r(0.4, 0.55), // radians the climb wall takes before it eases
    buttresses: [],
    // Two roads leave the lip point facing the gate, one `dir` round and one the other, each `sweep` radians down the wall (a grade of 20 to 25%, 12 to 14 degrees).
    road: { dir: random() < 0.5 ? -1 : 1, from: 0, sweep: r(2.7, 2.8), halfWidth: 2.7, bend: r(-7, 7) },
    pond: null,
    heaps: [],
    plant: null, // where the screening plant stands, if the floor had room (plantSite.js); its heap is the first of `heaps`
  };
  // The haul roads leave the rim on the side facing the gate and go down either side; the climb wall is where they don't reach, opposite.
  const toGate = Math.atan2(haul.z - z, haul.x - x) - pit.yaw;
  pit.road.from = toGate;
  pit.climbAt = toGate + Math.PI + r(-0.12, 0.12);

  // A few spurs of hard rock on the climb wall's flanks, to the sides of the line up so none stands in it.
  for (let tries = 0; pit.buttresses.length < 3 && tries < 60; tries++) {
    const at = pit.climbAt + (random() < 0.5 ? -1 : 1) * r(0.3, 0.5);
    if (pit.buttresses.some((o) => Math.abs(angleDiff(at, o.at)) < 0.2)) continue;
    pit.buttresses.push({ at, w: r(3.5, 5), run: depth * r(0.78, 0.86) });
  }

  // Fit the rim inside the hedges with a margin: if the pit as dealt would come closer, make it smaller.
  const short = (p) => {
    let out = 0;
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * TAU;
      const rim = ellipseRadius(p, a) * rimFactor(p, a);
      const wx = p.x + Math.cos(a + p.yaw) * rim;
      const wz = p.z + Math.sin(a + p.yaw) * rim;
      out = Math.max(out, RIM_MARGIN - Math.min(wx - q.minX, q.maxX - wx, wz - q.minZ));
    }
    return out;
  };
  for (let k = 0; k < 14 && !q.outline && short(pit) > 0; k++) {
    pit.rx *= 0.97;
    pit.rz *= 0.97;
  }

  const at = (a, s) => ({ x: pit.x + Math.cos(a + pit.yaw) * s, z: pit.z + Math.sin(a + pit.yaw) * s });
  const rimOf = (a) => ellipseRadius(pit, a) * rimFactor(pit, a);
  const floorEdge = (a) => rimOf(a) - runFor(pit, a);

  // The pond in a low corner on the gate's side, away from where the roads come down and the climb wall's foot.
  const pa = pit.road.from + (random() < 0.5 ? -1 : 1) * r(0.55, 1);
  const prx = r(6.5, 9);
  const prz = r(4.8, 6.5);
  const pc = at(pa, floorEdge(pa) - Math.min(prx, prz) * 0.5);
  pit.pond = { x: pc.x, z: pc.z, rx: prx, rz: prz, depth: 0.75, water: 0.35 };

  // Heaps of graded stone on the floor, none on the pond, the foot of the climb wall (the start of the climb) or where the road comes down.
  const roadPaths = [1, -1].map((dir) => descentPath(pit, dir));
  const roadEnds = roadPaths.map((pts) => pts[pts.length - 1]); // where each road really finishes, not where the sweep says it should
  const cAngle = climbAngle(pit);
  const climbFoot = at(cAngle, floorEdge(cAngle) - 9);
  const count = 3 + Math.floor(random() * 3);
  // The screening plant first, and the heap its conveyor ends over: the floor is too crowded to find it room after the other heaps.
  const dealt = dealPlant(pit, { at, floorEdge, roadEnds, climbFoot, roadPaths: roadPaths.map((pts) => pts.filter((pt) => pt.t > 0.5)) }, random);
  if (dealt) {
    pit.heaps.push(dealt.heap);
    pit.plant = dealt.plant;
  }
  for (let tries = 0; pit.heaps.length < count && tries < 700; tries++) {
    const rad = r(3.8, 6.2) * (1 - Math.min(0.4, tries / 700)); // smaller as the floor fills
    const a = r(0, TAU);
    const s = random() * floorEdge(a);
    const p = at(a, s);
    if (s > floorEdge(a) - rad * 0.9) continue;
    if (Math.hypot(p.x - pit.pond.x, p.z - pit.pond.z) < rad + Math.max(prx, prz) + 2) continue;
    if (roadEnds.some((e) => Math.hypot(p.x - e.x, p.z - e.z) < rad + 7)) continue;
    if (Math.hypot(p.x - climbFoot.x, p.z - climbFoot.z) < rad + 8) continue;
    if (pit.heaps.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < h.r + rad + 3)) continue;
    if (inPlantsWay(pit, p.x, p.z, rad)) continue;
    pit.heaps.push({ x: p.x, z: p.z, r: rad, h: r(1.8, 3.6), kind: random() < 0.5 ? 'gravel' : 'sand' });
  }
  return pit;
}

/** The quarry's own settings with a pit dealt from a fixed seed, for a layout that has not been dealt one (the tests, a seeded game). */
export function quarryOf(layout) {
  const q = layout.quarry;
  if (!q) return null;
  return q.pit ? q : { ...q, pit: dealPit(q, createRandom(51)) };
}

/** The layout with this farm's own pit dealt into it (the farm's seed keeps the pit the same day after day). */
export function dealtLayout(layout, farmSeed) {
  if (!layout.quarry) return layout;
  return { ...layout, quarry: { ...layout.quarry, pit: dealPit(layout.quarry, createRandom((farmSeed ^ 0x6a17) >>> 0)) } };
}

/**
 * The haul road down the wall from the lip point, `dir` round (1 or -1), from the lip to the floor: `[{ x, z, t, a, s }]`, even in grade (`t` is how
 * far down, 0 to 1, `a` and `s` where it is round the pit and out from its middle). Here and not in createQuarry so the plant can be dealt clear of it.
 */
export function descentPath(pit, dir) {
  const road = pit.road;
  const rimAt = (a) => ellipseRadius(pit, a) * rimFactor(pit, a);
  const frameAt = (a, s) => ({ x: pit.x + Math.cos(a + pit.yaw) * s, z: pit.z + Math.sin(a + pit.yaw) * s });
  const n = Math.max(24, Math.round((road.sweep * rimAt(road.from)) / ROAD_STEP));
  const angle = (i) => road.from + (dir * road.sweep * i) / n;
  const w = (a) => rimAt(a) - baseRun(pit, a) * 0.5; // the radius of the middle of the bank: the length of wall passed per radian
  const share = [0];
  for (let i = 1; i <= n; i++) share.push(share[i - 1] + (w(angle(i - 1)) + w(angle(i))) / 2);
  let ts = share.map((v) => v / share[n]);
  const at = (i) => {
    const a = angle(i);
    return { ...frameAt(a, rimAt(a) - bankAt(ts[i]) * baseRun(pit, a)), t: ts[i], at: 0, a, s: rimAt(a) - bankAt(ts[i]) * baseRun(pit, a) };
  };
  // The road is lower where it is nearer the middle, and passes less wall per radian there: space the depth by the length actually driven.
  for (let pass = 0; pass < 6; pass++) {
    const here = ts.map((_, i) => at(i));
    const len = [0];
    for (let i = 1; i <= n; i++) len.push(len[i - 1] + Math.hypot(here[i].x - here[i - 1].x, here[i].z - here[i - 1].z));
    ts = len.map((v) => v / len[n]);
  }
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(at(i));
  return pts;
}

/** Null when the layout has no gravel pit. */
export function createQuarry(layout) {
  const q = quarryOf(layout);
  if (!q) return null;
  const rect = { minX: q.minX, maxX: q.maxX, minZ: q.minZ, maxZ: q.maxZ };
  const pit = q.pit;
  const farm = layout.farm ?? { minX: -layout.fieldHalf, maxX: layout.fieldHalf, minZ: -layout.fieldHalf, maxZ: layout.fieldHalf };
  const outline = q.outline ?? null; // the new farm's field is its own shape, not a rectangle (`rect` is its bounds)
  const outlineEdges = outline ? polygonEdges(outline) : null;
  const outlineBox = outline ? polygonBounds(outline) : null; // 40 m past it the pit's weight is nothing, without walking the outline (#1107)
  const { gates, haul: gate, way } = gatesOf(q);
  const cosY = Math.cos(pit.yaw);
  const sinY = Math.sin(pit.yaw);

  /** (x, z) in the pit's own frame: the angle round it and the distance from its middle. */
  const polar = (x, z) => {
    const dx = x - pit.x;
    const dz = z - pit.z;
    const qx = dx * cosY + dz * sinY;
    const qz = -dx * sinY + dz * cosY;
    return { a: Math.atan2(qz, qx), s: Math.hypot(qx, qz) };
  };
  const rimAt = (a) => ellipseRadius(pit, a) * rimFactor(pit, a);
  const runAt = (a) => runFor(pit, a);
  /** The point at angle `a` (the pit's frame) and `s` metres from its middle, in the world. */
  const frameAt = (a, s) => ({ x: pit.x + Math.cos(a + pit.yaw) * s, z: pit.z + Math.sin(a + pit.yaw) * s });
  const floorEdge = (a) => rimAt(a) - runAt(a);
  let reachMax = 0;
  for (let i = 0; i < 90; i++) reachMax = Math.max(reachMax, rimAt((i / 90) * TAU));

  // The haul roads: from the gate straight (with a bend) to the lip on the side facing it, where they fork and go down the wall either way round, each
  // a ledge at the depth the bank has at that distance (so it is cut into the slope, not a ramp through it), its depth growing with the distance along
  // it so the grade is even. Between their feet is the climb wall. Each point: where, how far down (0 on the lead-in, 1 at the floor), the angle round
  // the pit and how far from its middle. Down one and up the other is a loop.
  const road = pit.road;
  const roadHalf = road.halfWidth;
  const startRim = frameAt(road.from, rimAt(road.from));
  const leadLen = Math.hypot(startRim.x - gate.x, startRim.z - gate.z);
  const leadN = Math.max(2, Math.round(leadLen / ROAD_STEP));
  const side = [-gate.inward[1], gate.inward[0]]; // across the lead-in, which is the way the bend goes
  const lead = [];
  for (let i = 0; i <= leadN; i++) {
    const f = i / leadN;
    const bend = Math.sin(f * Math.PI) * road.bend;
    lead.push({ x: gate.x + (startRim.x - gate.x) * f + bend * side[0], z: gate.z + (startRim.z - gate.z) * f + bend * side[1], t: 0, at: 0, a: road.from, s: rimAt(road.from) });
  }
  for (let i = 1; i < lead.length; i++) lead[i].at = lead[i - 1].at + Math.hypot(lead[i].x - lead[i - 1].x, lead[i].z - lead[i - 1].z);
  const leadAt = lead[lead.length - 1].at;
  /** One road down the wall from the lip point, `dir` round (1 or -1): points from the lip to the floor, even in grade. */
  const descend = (dir) => {
    const pts = descentPath(pit, dir);
    pts[0] = { x: startRim.x, z: startRim.z, t: 0, at: leadAt, a: road.from, s: rimAt(road.from) };
    for (let i = 1; i < pts.length; i++) pts[i].at = pts[i - 1].at + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z);
    return pts;
  };
  const roadA = descend(road.dir);
  const roadB = descend(-road.dir);
  const roadPts = [...lead, ...roadA.slice(1)]; // the main road: the lead-in and the way down the first side
  const rampPts = roadB; // and the way down the other, from the lip
  const roadLength = roadPts[roadPts.length - 1].at;
  const roads = [roadPts, rampPts].map((pts) => ({
    pts,
    box: {
      minX: Math.min(...pts.map((p) => p.x)) - roadHalf - 8,
      maxX: Math.max(...pts.map((p) => p.x)) + roadHalf + 8,
      minZ: Math.min(...pts.map((p) => p.z)) - roadHalf - 8,
      maxZ: Math.max(...pts.map((p) => p.z)) + roadHalf + 8,
    },
  }));

  /** The nearest part of one road (`{ pts, box }`) to (x, z): its distance, how far down it is there (0..1) and the metres along it. Infinity far off. */
  const nearOne = (rd, x, z) => {
    if (!inRect(rd.box, x, z)) return { d: Infinity, t: 0, at: 0 };
    const pts = rd.pts;
    let best = Infinity;
    let t = 0;
    let at = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const len2 = abx * abx + abz * abz || 1;
      const k = clamp(((x - a.x) * abx + (z - a.z) * abz) / len2, 0, 1);
      const d2 = (x - (a.x + abx * k)) ** 2 + (z - (a.z + abz * k)) ** 2;
      if (d2 < best) {
        best = d2;
        t = a.t + (b.t - a.t) * k;
        at = a.at + (b.at - a.at) * k;
      }
    }
    return { d: Math.sqrt(best), t, at };
  };
  /** The nearest part of any haul road to (x, z). */
  const roadNear = (x, z) => {
    let best = { d: Infinity, t: 0, at: 0 };
    for (const rd of roads) {
      const n = nearOne(rd, x, z);
      if (n.d < best.d) best = n;
    }
    return best;
  };

  // The pond, as the wood's: an ellipse cut deeper than the water stands.
  const pond = pit.pond;
  const pondR = (x, z) => Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
  const pondCut = (x, z) => {
    const r = pondR(x, z);
    return r >= 1 ? 0 : pond.depth * (1 - smoothstep(0.3, 1, r));
  };

  // The spoil bank along the lane side of the new farm's field, with the haul road's gap through it (pitEntrance.js, #1002): the pit's landmark from the lane.
  const laneGate = outline ? laneGateOf(gates) : null;
  const bank = laneGate ? spoilBankOf(laneGate) : null;
  const bankAt = (x, z, rd) => (bank ? bankRise(bank, x, z, () => rd.d, roadHalf) : 0);

  const heapRise = (x, z) => {
    let h = 0;
    for (const m of pit.heaps) {
      const k = 1 - Math.hypot(x - m.x, z - m.z) / m.r;
      if (k > 0) h += m.h * k ** 1.25 * smoothstep(0, 0.12, k);
    }
    return h;
  };

  /** How deep the bowl cuts at (x, z) below the pit's level: 0 outside the lip, the pit's depth on the floor. */
  const bowlCut = (x, z) => {
    const dx = x - pit.x;
    const dz = z - pit.z;
    if (dx * dx + dz * dz > reachMax * reachMax) return 0;
    const { a, s } = polar(x, z);
    const rim = rimAt(a);
    return s >= rim ? 0 : pit.depth * bankShape((rim - s) / runAt(a));
  };

  /** 0..1 how much of the ground at (x, z) is the pit's own rather than the farmland round it: 1 in the field, fading out 40 m beyond its hedges. */
  function weight(x, z) {
    if (outline) return outsideBounds(outlineBox, x, z) >= 40 ? 0 : 1 - smoothstep(0, 40, outsidePolygon(outline, x, z, outlineEdges));
    if (inRect(farm, x, z)) return 0;
    return 1 - smoothstep(0, 40, outside(rect, x, z));
  }

  /**
   * The ground at (x, z) given `h`, the ground as the land lies there, and `level`, the lie at the pit's middle. The patch round the pit is eased
   * to `level` (over `ZONE_FADE` m beyond the lip), the bowl is cut into it, the haul road is laid as a ledge down the wall, and the pond, the heaps and
   * a little roughness on the floor go on top.
   */
  function groundAt(x, z, h, level) {
    const dx = x - pit.x;
    const dz = z - pit.z;
    const near = dx * dx + dz * dz <= (reachMax + ZONE_FADE) ** 2;
    const rd = roadNear(x, z);
    const rise = bankAt(x, z, rd);
    if (!near && rd.d > roadHalf + ROAD_SHOULDER) return h + rise;
    let base = h;
    let cut = 0;
    if (near) {
      const { a, s } = polar(x, z);
      const rim = rimAt(a);
      base = h + (level - h) * (1 - smoothstep(0, ZONE_FADE, Math.max(0, s - rim)));
      if (s < rim) cut = pit.depth * bankShape((rim - s) / runAt(a));
    }
    let out = base - cut;
    // Each road lays its ledge in turn, so where two come close the ground goes from one to the other without a step.
    for (const r of roads) {
      const n = nearOne(r, x, z);
      if (n.t > 0 && n.d < roadHalf + ROAD_SHOULDER) out += (base - pit.depth * n.t - out) * (1 - softRamp((n.d - roadHalf) / ROAD_SHOULDER));
    }
    // The floor is rutted and rough.
    if (cut >= pit.depth - 0.001) out += 0.1 * Math.sin(x * 0.7 + z * 0.37) * Math.sin(z * 0.53 - x * 0.21 + 1);
    // The screening plant's pad is level: the floor's roughness and the foot of a wall are levelled out under it, and eased back in beyond its edge.
    const flat = plantPadWeight(pit.plant, x, z);
    if (flat > 0) out += (level - pit.depth - out) * flat;
    return out - pondCut(x, z) + heapRise(x, z) + rise;
  }

  /** 0..1 how much standing water there is at (x, z): the pond, where it is cut deeper than the water stands. */
  function waterAt(x, z) {
    if (pondR(x, z) >= 1) return 0;
    return clamp((pondCut(x, z) - (pond.depth - pond.water)) / (pond.water * 0.5), 0, 1);
  }

  /** 0..1 how muddy: round the pond's shore, and a little along the floor where the road comes down. */
  function mudAt(x, z) {
    if (!inRect(rect, x, z, -3)) return 0;
    let m = 0.8 * (1 - smoothstep(1, 1.35, pondR(x, z)));
    const rd = roadNear(x, z);
    if (rd.t > 0.9) m = Math.max(m, 0.18 * (1 - smoothstep(roadHalf, roadHalf + 2, rd.d)));
    return m;
  }

  /** 0..1 how loose the ground is underfoot: the banks and their scree most, the floor and the haul road a little less, none outside. */
  function gravelAt(x, z) {
    if (!inRect(rect, x, z, -1)) return 0;
    const dx = x - pit.x;
    const dz = z - pit.z;
    let g = 0;
    if (dx * dx + dz * dz <= (reachMax + 3) ** 2) {
      const { a, s } = polar(x, z);
      const rim = rimAt(a);
      if (s < rim + 2) {
        const u = (rim - s) / runAt(a);
        g = (u >= 1 ? 0.7 : 0.7 + 0.3 * smoothstep(0.05, 0.45, u)) * (1 - smoothstep(0, 2, s - rim));
      }
    }
    const rd = roadNear(x, z);
    if (rd.d < roadHalf + 1) g = Math.max(g, 0.75 * (1 - smoothstep(roadHalf - 0.4, roadHalf + 1, rd.d)));
    return g;
  }

  /** 0..1 the haul road's surface (worn bare gravel) at (x, z), with a soft edge. */
  const roadAt = (x, z) => {
    const rd = roadNear(x, z);
    return rd.d === Infinity ? 0 : 1 - smoothstep(roadHalf - 0.6, roadHalf + 0.4, rd.d);
  };

  // The pit climb: start gate on the floor at the climb wall's foot, one on the bank and the finish just past the lip, all facing up the wall,
  // `gateHalf` wide: the line up the wall is yours (npc/hillClimb.js's gates).
  const cAngle = climbAngle(pit);
  const gateAt = (s) => {
    const p = frameAt(cAngle, s);
    return [p.x, p.z];
  };
  const finishS = rimAt(cAngle) + 5;
  const climb = {
    points: [gateAt(floorEdge(cAngle) - 9), gateAt(rimAt(cAngle) - runAt(cAngle) * 0.5), gateAt(finishS)],
    gateHalf: 9,
  };
  /** Whether the lip's fence must be open at angle `a` (the post at (x, z)): where the haul road comes in, and over the lip where the climb finishes. */
  const fenceOpen = (a, x, z) => roadNear(x, z).d < roadHalf + 6 || Math.abs(angleDiff(a, cAngle)) * (rimAt(cAngle) + 2.4) < climb.gateHalf + 1.5;

  const inQuarry = (x, z, margin = 0) => (outline ? pointInPolygon(outline, x, z, margin, outlineEdges) : inRect(rect, x, z, margin));
  /** Whether (x, z) is some way in from the way-in gate: where a girl following you stops short and waits (`waitSpot`) rather than driving in. */
  const [wx, wz] = way.inward;
  const pastGate = (x, z) => inQuarry(x, z) && (x - way.x) * wx + (z - way.z) * wz > PAST_GATE;
  const waitSpot = { x: way.x + wx * WAIT_IN - wz * WAIT_IN, z: way.z + wz * WAIT_IN + wx * WAIT_IN };
  /** Whether (x, z) is inside the pit: below the lip. */
  const inPit = (x, z) => {
    const { a, s } = polar(x, z);
    return s < rimAt(a);
  };

  /** Whether a bush or boulder may stand at (x, z): inside the hedges, clear of the pit, the road and the gate. `clear` is the room to leave off the lip. */
  function plantOk(x, z, clear = 1.5) {
    if (!inQuarry(x, z, 3)) return false;
    const { a, s } = polar(x, z);
    if (s < rimAt(a) + clear) return false;
    if (roadNear(x, z).d < roadHalf + 2.5) return false;
    return gates.every((g) => Math.hypot(x - g.x, z - g.z) >= 9);
  }

  // The places held in the field for later items (layoutNew.js `RESERVED_PLAN`: the 11 kV line's poles, a trough), which the scrub keeps off (#1004).
  const R = layout.reserved ?? {};
  const held = [...(R.powerLine?.poles ?? []), ...(R.troughs ?? []).map((t) => t.at), ...(R.crossings ?? []).map((c) => c.at)]
    .filter(([x, z]) => x > rect.minX - 5 && x < rect.maxX + 5 && z > rect.minZ - 5 && z < rect.maxZ + 5);

  return {
    rect, outline, name: q.name, pit, gate, gates, way, pond, waitSpot, climb, held,
    weight, groundAt, waterAt, mudAt, gravelAt, roadAt, pondCut, bowlCut, heapRise, inQuarry, inPit, pastGate, plantOk, laneGate, bank,
    bankAt: (x, z) => bankAt(x, z, roadNear(x, z)),
    polar, frameAt, rimAt, runAt, floorEdge, roadNear, fenceOpen, roadPoints: roadPts, rampPoints: rampPts, roadHalf, roadLength, reachMax,
    outside: (x, z) => (outline ? outsidePolygon(outline, x, z, outlineEdges) : outside(rect, x, z)),
  };
}

/**
 * How much the pit's field grows, by area and to a cap (#1004): each is `[how many a hectare, the most]`. The bushes and the field's stones and trees go
 * by the field's area (the new farm's is 1.9 times the old one's, so its scrub would have doubled with nothing to stop it), the wall's stones and the
 * big boulders by the bowl's at the lip. `lip` is the share of the bushes dealt along the lip (2 to 11 m out), the rest over the field, and the kinds
 * are dealt by those shares: birch thickest at the lip, bramble and hawthorn more over the rough.
 */
export const PIT_PLANTS = {
  bushes: [58, 190],
  trees: [2, 4],
  stones: [12, 40],
  boulders: [120, 80],
  big: [16, 10],
  lip: 0.62,
  lipKinds: { birch: 0.34, gorse: 0.28, hawthorn: 0.18, bramble: 0.2 },
  fieldKinds: { birch: 0.12, gorse: 0.3, hawthorn: 0.28, bramble: 0.3 },
};

const HECTARE = 10000;
const pickKind = (shares, v) => {
  let t = 0;
  for (const [k, w] of Object.entries(shares)) if (v < (t += w)) return k;
  return Object.keys(shares).at(-1);
};

/**
 * Where the scrub and the boulders go round the pit: hawthorn, gorse, bramble and birch thick along the lip and over the field (thinned into patches by
 * a slow pattern, kept off the ride: pitScrub.js), a few oaks standing in the rough, flints over it, and boulders and stones strewn at the foot of the
 * banks, each as many as the field's or the bowl's area gives, to its cap (`PIT_PLANTS`). From the pit's plants' own stream unless `random` is given
 * (0..1). Returns { bushes: [[x, z, scale, kind]], trees: [[x, z, scale]], stones: [[x, z, size]], boulders: [[x, z, size]], big: [[x, z, size]] }.
 */
export function quarryPlants(quarry, random = streamFor('pitPlants')) {
  const { pit, rect } = quarry;
  const field = fieldArea(quarry) / HECTARE;
  const bowl = bowlArea(quarry) / HECTARE;
  const P = PIT_PLANTS;
  const patch = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.07 + z * 0.05 + 0.7) + 0.25 * Math.sin(z * 0.1 - x * 0.045 + 2.1);
  const bushes = [];
  const bushCount = byArea(P.bushes, field);
  for (let tries = 0; bushes.length < bushCount && tries < bushCount * 220; tries++) {
    const a = random() * TAU;
    let x;
    let z;
    const lip = random() < P.lip;
    if (lip) {
      const p = quarry.frameAt(a, quarry.rimAt(a) + 2 + random() * 9);
      x = p.x;
      z = p.z;
    } else {
      x = rect.minX + 3 + random() * (rect.maxX - rect.minX - 6);
      z = rect.minZ + 3 + random() * (rect.maxZ - rect.minZ - 6);
    }
    const keep = random();
    const s = 0.8 + random() * 1.1;
    const kind = pickKind(lip ? P.lipKinds : P.fieldKinds, random());
    if (keep > 0.25 + 0.75 * patch(x, z)) continue;
    if (!scrubOk(quarry, x, z)) continue;
    bushes.push([x, z, s, kind]);
  }
  const trees = [];
  const treeCount = byArea(P.trees, field);
  for (let tries = 0; trees.length < treeCount && tries < 4000; tries++) {
    const x = rect.minX + 6 + random() * (rect.maxX - rect.minX - 12);
    const z = rect.minZ + 6 + random() * (rect.maxZ - rect.minZ - 12);
    const s = 0.9 + random() * 0.7;
    if (!scrubOk(quarry, x, z, 7, 2) || !quarry.inQuarry(x, z, 9)) continue;
    if ([[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dz]) => quarry.bankAt(x + dx, z + dz) > 0.01)) continue; // nor up on the spoil bank (#1002)
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 12)) continue;
    trees.push([x, z, s]);
  }
  // Flints and stones turned up in the rough, here and there.
  const stones = [];
  const stoneCount = byArea(P.stones, field);
  for (let tries = 0; stones.length < stoneCount && tries < stoneCount * 40; tries++) {
    const x = rect.minX + 3 + random() * (rect.maxX - rect.minX - 6);
    const z = rect.minZ + 3 + random() * (rect.maxZ - rect.minZ - 6);
    const size = 0.12 + random() * random() * 0.35;
    if (!scrubOk(quarry, x, z, 0.5)) continue;
    stones.push([x, z, size]);
  }
  const start = quarry.climb.points[0];
  const boulders = [];
  const boulderCount = byArea(P.boulders, bowl);
  for (let tries = 0; boulders.length < boulderCount && tries < 5000; tries++) {
    const a = random() * TAU;
    const run = quarry.runAt(a);
    const p = quarry.frameAt(a, quarry.floorEdge(a) + (random() - 0.35) * run * 0.7); // the foot and lower bank, where it has rolled down
    if (quarry.waterAt(p.x, p.z) > 0 || pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r)) continue;
    if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 1.2) continue;
    if (inPlantsWay(pit, p.x, p.z, 0.6)) continue; // nor on the plant's pad
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 4) continue; // not on the start line
    boulders.push([p.x, p.z, 0.2 + random() * random() * 0.7]);
  }
  const big = [];
  const bigCount = byArea(P.big, bowl);
  for (let tries = 0; big.length < bigCount && tries < 3000; tries++) {
    const a = random() * TAU;
    const p = quarry.frameAt(a, quarry.floorEdge(a) - 2 - random() * 12);
    if (quarry.waterAt(p.x, p.z) > 0 || quarry.roadNear(p.x, p.z).d < 8) continue;
    if (pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 1.5) || inPlantsWay(pit, p.x, p.z, 1.5)) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 9) continue;
    if (big.some(([bx, bz]) => Math.hypot(bx - p.x, bz - p.z) < 6)) continue;
    big.push([p.x, p.z, 0.8 + random() * 0.6]);
  }
  return { bushes, trees, stones, boulders, big };
}
