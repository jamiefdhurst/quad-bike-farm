// The gravel pit (layout.quarry), in the hedged field north of the barley field: the lie of the ground (a bowl cut into a levelled patch, a haul road
// that winds down its wall, a pond in the low corner, heaps of graded stone on the floor), the loose surface, the climb that goes up its steepest
// wall, and where scrub and boulders may stand. Pure: used by the terrain, the fields, the props, the map and the girls. Nothing here is drawn;
// the meshes are in quarryProps.js.
//
// The pit's shape is dealt from the farm's seed (`dealPit`), so every farm has its own pit and keeps it: how big, how it is turned, how ragged
// its rim is, which wall is the steep one, where the chutes (the loose gullies you can climb) and the buttresses (the spurs you can't) are,
// which way the haul road winds, where the pond and the heaps are.

import { createRandom } from '../core/random.js';

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
const ROAD_SHOULDER = 6; // metres the road's ledge takes to ease into the wall either side of its surface
const ZONE_FADE = 14; // metres beyond the rim that the ground is eased from the pit's level back into the field's
const RIM_MARGIN = 7; // the closest a rim may come to the field's hedges

/** The ellipse's radius at angle `a` (in the pit's own frame) before the rim's ragged bumps. */
const ellipseRadius = (pit, a) => (pit.rx * pit.rz) / Math.hypot(pit.rz * Math.cos(a), pit.rx * Math.sin(a));

/** The rim's ragged factor at angle `a`: 1 plus the bumps. */
function rimFactor(pit, a) {
  let f = 1;
  for (const [k, amp, ph] of pit.bumps) f += amp * Math.cos(k * a + ph);
  return f;
}

/** Metres from lip to floor along angle `a`: the easy walls' run, the steep wall's (a Gaussian round `steepAt`), the chutes' and the buttresses'. */
function runFor(pit, a) {
  const wall = Math.exp(-((angleDiff(a, pit.steepAt) / pit.steepWidth) ** 2));
  let run = (pit.steepRun + (pit.gentleRun - pit.steepRun) * (1 - wall)) * (1 + 0.1 * Math.sin(3 * a + 1.1) + 0.05 * Math.sin(7 * a));
  const rim = ellipseRadius(pit, a) * rimFactor(pit, a);
  for (const c of pit.chutes) run = Math.max(run, run + (c.run - run) * Math.exp(-((angleDiff(a, c.at) / (c.w / rim)) ** 2)));
  for (const b of pit.buttresses) run = Math.min(run, run + (b.run - run) * Math.exp(-((angleDiff(a, b.at) / (b.w / rim)) ** 2)));
  return run;
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
 * A pit's shape for one farm, from `random` (0..1): its size, turn and ragged rim, the way the haul road winds, the steep wall opposite it with
 * its chutes and buttresses, the pond by the steep wall's foot and the heaps on the floor. `q` is `layout.quarry` (the field and its gate).
 */
export function dealPit(q, random) {
  const r = (lo, hi) => lo + random() * (hi - lo);
  const x = (q.minX + q.maxX) / 2 + r(-4, 4);
  const z = q.maxZ - 76 + r(-3, 3);
  const pit = {
    x, z,
    rx: r(42, 45),
    rz: r(29, 32),
    yaw: r(-0.3, 0.3),
    depth: r(8, 9.5),
    bumps: [[2, r(0.04, 0.07), r(0, TAU)], [3, r(0.03, 0.06), r(0, TAU)], [5, r(0.015, 0.035), r(0, TAU)]], // [harmonic, share of the radius, phase]
    gentleRun: r(14.5, 16.5), // metres from lip to floor on the easy walls (about 30 degrees, a little more at its steepest)
    steepRun: r(10.4, 11.8), // and on the steep one (about 38)
    steepWidth: r(0.55, 0.8), // radians the steep wall takes before it eases
    chutes: [],
    buttresses: [],
    road: { dir: random() < 0.5 ? -1 : 1, from: 0, sweep: r(2.4, 2.9), halfWidth: 2.7, bend: r(-7, 7) },
    pond: null,
    heaps: [],
  };
  // The haul road leaves the rim on the side facing the gate, and winds round the wall; the steep wall is on the far side from its middle.
  const toGate = Math.atan2(q.maxZ - z, q.gate.x - x) - pit.yaw;
  pit.road.from = toGate;
  pit.steepAt = toGate + (pit.road.dir * pit.road.sweep) / 2 + Math.PI + r(-0.25, 0.25);

  // Two chutes in the steep wall (a gully of loose stone, easier going: the line up is the thing to find) and a few buttresses of hard rock
  // between them that are not.
  const first = pit.steepAt + r(-0.22, 0.22);
  const second = first + (random() < 0.5 ? -1 : 1) * r(0.3, 0.5);
  pit.chutes = [{ at: first, w: r(3, 4), run: r(15, 17) }, { at: second, w: r(2.5, 3.5), run: r(14, 16) }];
  pit.buttresses = [first + (second - first) * 0.5, pit.steepAt + r(-0.9, 0.9), pit.steepAt + r(-0.9, 0.9)].map((at) => ({ at, w: r(2.5, 4), run: r(8, 9) }));

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
  for (let k = 0; k < 14 && short(pit) > 0; k++) {
    pit.rx *= 0.97;
    pit.rz *= 0.97;
  }

  const at = (a, s) => ({ x: pit.x + Math.cos(a + pit.yaw) * s, z: pit.z + Math.sin(a + pit.yaw) * s });
  const rimOf = (a) => ellipseRadius(pit, a) * rimFactor(pit, a);
  const floorEdge = (a) => rimOf(a) - runFor(pit, a);

  // The pond in the low corner, a little way round from the steep wall's foot.
  const pa = pit.steepAt + (random() < 0.5 ? -1 : 1) * r(0.6, 0.85);
  const prx = r(6.5, 9);
  const prz = r(4.8, 6.5);
  const pc = at(pa, floorEdge(pa) - Math.min(prx, prz) * 0.5);
  pit.pond = { x: pc.x, z: pc.z, rx: prx, rz: prz, depth: 0.75, water: 0.35 };

  // Heaps of graded stone on the floor, none on the pond, the foot of the steep wall (the start of the climb) or where the road comes down.
  const endA = pit.road.from + pit.road.dir * pit.road.sweep;
  const roadEnd = at(endA, floorEdge(endA));
  const climbFoot = at(pit.steepAt, floorEdge(pit.steepAt) - 9);
  const count = 3 + Math.floor(random() * 3);
  for (let tries = 0; pit.heaps.length < count && tries < 400; tries++) {
    const rad = r(4.5, 7);
    const a = r(0, TAU);
    const s = random() * floorEdge(a);
    const p = at(a, s);
    if (s > floorEdge(a) - rad * 0.9) continue;
    if (Math.hypot(p.x - pit.pond.x, p.z - pit.pond.z) < rad + Math.max(prx, prz) + 2) continue;
    if (Math.hypot(p.x - roadEnd.x, p.z - roadEnd.z) < rad + 9) continue;
    if (Math.hypot(p.x - climbFoot.x, p.z - climbFoot.z) < rad + 10) continue;
    if (pit.heaps.some((h) => Math.hypot(h.x - p.x, h.z - p.z) < h.r + rad + 3)) continue;
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

/** Null when the layout has no gravel pit. */
export function createQuarry(layout) {
  const q = quarryOf(layout);
  if (!q) return null;
  const rect = { minX: q.minX, maxX: q.maxX, minZ: q.minZ, maxZ: q.maxZ };
  const pit = q.pit;
  const farm = layout.farm ?? { minX: -layout.fieldHalf, maxX: layout.fieldHalf, minZ: -layout.fieldHalf, maxZ: layout.fieldHalf };
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

  // The haul road: from the gate straight (with a bend) to the lip on the side facing it, then winding down the wall at the depth the bank has
  // at that distance, so it is a ledge cut into the slope and not a ramp through it. Each point: where, and how far down (0 on the lead-in, 1 at the floor).
  const road = pit.road;
  const roadHalf = road.halfWidth;
  const roadPts = [];
  const startRim = frameAt(road.from, rimAt(road.from));
  const gate = q.gate;
  const leadLen = Math.hypot(startRim.x - gate.x, startRim.z - q.maxZ);
  const leadN = Math.max(2, Math.round(leadLen / ROAD_STEP));
  for (let i = 0; i <= leadN; i++) {
    const f = i / leadN;
    const bend = Math.sin(f * Math.PI) * road.bend;
    roadPts.push({ x: gate.x + (startRim.x - gate.x) * f + bend, z: q.maxZ + (startRim.z - q.maxZ) * f, t: 0, at: 0 });
  }
  const arc = Math.max(8, Math.round((road.sweep * (rimAt(road.from) - runAt(road.from) * 0.5)) / ROAD_STEP));
  for (let i = 1; i <= arc; i++) {
    const f = i / arc;
    const a = road.from + road.dir * road.sweep * f;
    const p = frameAt(a, rimAt(a) - bankAt(f) * runAt(a));
    roadPts.push({ x: p.x, z: p.z, t: f, at: 0 });
  }
  for (let i = 1; i < roadPts.length; i++) roadPts[i].at = roadPts[i - 1].at + Math.hypot(roadPts[i].x - roadPts[i - 1].x, roadPts[i].z - roadPts[i - 1].z);
  const roadLength = roadPts[roadPts.length - 1].at;
  const roadBox = {
    minX: Math.min(...roadPts.map((p) => p.x)) - roadHalf - 8,
    maxX: Math.max(...roadPts.map((p) => p.x)) + roadHalf + 8,
    minZ: Math.min(...roadPts.map((p) => p.z)) - roadHalf - 8,
    maxZ: Math.max(...roadPts.map((p) => p.z)) + roadHalf + 8,
  };

  /** The nearest part of the haul road to (x, z): its distance, how far down it is there (0..1) and the metres along it. Infinity far off. */
  const roadNear = (x, z) => {
    if (!inRect(roadBox, x, z)) return { d: Infinity, t: 0, at: 0 };
    let best = Infinity;
    let t = 0;
    let at = 0;
    for (let i = 0; i < roadPts.length - 1; i++) {
      const a = roadPts[i];
      const b = roadPts[i + 1];
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

  // The pond, as the wood's: an ellipse cut deeper than the water stands.
  const pond = pit.pond;
  const pondR = (x, z) => Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz);
  const pondCut = (x, z) => {
    const r = pondR(x, z);
    return r >= 1 ? 0 : pond.depth * (1 - smoothstep(0.3, 1, r));
  };

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
    if (!near && rd.d > roadHalf + ROAD_SHOULDER) return h;
    let base = h;
    let cut = 0;
    if (near) {
      const { a, s } = polar(x, z);
      const rim = rimAt(a);
      base = h + (level - h) * (1 - smoothstep(0, ZONE_FADE, Math.max(0, s - rim)));
      if (s < rim) cut = pit.depth * bankShape((rim - s) / runAt(a));
    }
    let out = base - cut;
    if (rd.t > 0 && rd.d < roadHalf + ROAD_SHOULDER) out += (base - pit.depth * rd.t - out) * (1 - softRamp((rd.d - roadHalf) / ROAD_SHOULDER));
    // The floor is rutted and rough.
    if (cut >= pit.depth - 0.001) out += 0.1 * Math.sin(x * 0.7 + z * 0.37) * Math.sin(z * 0.53 - x * 0.21 + 1);
    return out - pondCut(x, z) + heapRise(x, z);
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

  // The pit climb: start gate on the floor at the steep wall's foot, one on the bank and the finish just past the lip, all facing up the wall,
  // wide enough (`gateHalf`) to take in the chutes: the line up is yours to find (npc/hillClimb.js's gates).
  const gateAt = (s) => {
    const p = frameAt(pit.steepAt, s);
    return [p.x, p.z];
  };
  const climb = {
    points: [gateAt(floorEdge(pit.steepAt) - 9), gateAt(rimAt(pit.steepAt) - runAt(pit.steepAt) * 0.5), gateAt(rimAt(pit.steepAt) + 5)],
    gateHalf: 9,
  };

  const inQuarry = (x, z, margin = 0) => inRect(rect, x, z, margin);
  /** Whether (x, z) is some way in from the gate: where a girl following you stops short and waits (`waitSpot`) rather than driving in. */
  const pastGate = (x, z) => inQuarry(x, z) && z < rect.maxZ - 8;
  const waitSpot = { x: gate.x + 3.5, z: rect.maxZ - 3.5 };
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
    return Math.hypot(x - gate.x, z - rect.maxZ) >= 9;
  }

  return {
    rect, name: q.name, pit, gate, pond, waitSpot, climb,
    weight, groundAt, waterAt, mudAt, gravelAt, roadAt, pondCut, bowlCut, heapRise, inQuarry, inPit, pastGate, plantOk,
    polar, frameAt, rimAt, runAt, floorEdge, roadNear, roadPoints: roadPts, roadHalf, roadLength, reachMax,
    outside: (x, z) => outside(rect, x, z),
  };
}

/**
 * Where the scrub and the boulders go round the pit: hawthorn and gorse thick along the lip and over the field (thinned into patches by a slow
 * pattern), boulders and flints strewn at the foot of the banks and down the chutes. `random` gives 0..1. Returns { bushes: [[x, z, scale]],
 * trees: [[x, z, scale]], boulders: [[x, z, size]], big: [[x, z, size]] }.
 */
export function quarryPlants(quarry, random) {
  const { pit, rect } = quarry;
  const patch = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.07 + z * 0.05 + 0.7) + 0.25 * Math.sin(z * 0.1 - x * 0.045 + 2.1);
  const bushes = [];
  for (let tries = 0; bushes.length < 170 && tries < 20000; tries++) {
    const a = random() * TAU;
    let x;
    let z;
    if (random() < 0.65) {
      // along the lip
      const p = quarry.frameAt(a, quarry.rimAt(a) + 2 + random() * 9);
      x = p.x;
      z = p.z;
    } else {
      x = rect.minX + 3 + random() * (rect.maxX - rect.minX - 6);
      z = rect.minZ + 3 + random() * (rect.maxZ - rect.minZ - 6);
    }
    if (random() > 0.25 + 0.75 * patch(x, z)) continue;
    if (!quarry.plantOk(x, z)) continue;
    bushes.push([x, z, 0.8 + random() * 1.1]);
  }
  const trees = [];
  for (let tries = 0; trees.length < 14 && tries < 4000; tries++) {
    const x = rect.minX + 6 + random() * (rect.maxX - rect.minX - 12);
    const z = rect.minZ + 6 + random() * (rect.maxZ - rect.minZ - 12);
    if (!quarry.plantOk(x, z, 7)) continue;
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 12)) continue;
    trees.push([x, z, 0.9 + random() * 0.7]);
  }
  const start = quarry.climb.points[0];
  const boulders = [];
  for (let tries = 0; boulders.length < 90 && tries < 5000; tries++) {
    const a = random() * TAU;
    const run = quarry.runAt(a);
    const p = quarry.frameAt(a, quarry.floorEdge(a) + (random() - 0.35) * run * 0.7); // the foot and lower bank, where it has rolled down
    if (quarry.waterAt(p.x, p.z) > 0 || pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r)) continue;
    if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 1.2) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 4) continue; // not on the start line
    boulders.push([p.x, p.z, 0.2 + random() * random() * 0.7]);
  }
  const big = [];
  for (let tries = 0; big.length < 9 && tries < 3000; tries++) {
    const a = random() * TAU;
    const p = quarry.frameAt(a, quarry.floorEdge(a) - 2 - random() * 12);
    if (quarry.waterAt(p.x, p.z) > 0 || quarry.roadNear(p.x, p.z).d < 8) continue;
    if (pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 1.5)) continue;
    if (Math.hypot(p.x - start[0], p.z - start[1]) < 9) continue;
    if (big.some(([bx, bz]) => Math.hypot(bx - p.x, bz - p.z) < 6)) continue;
    big.push([p.x, p.z, 0.8 + random() * 0.6]);
  }
  return { bushes, trees, boulders, big };
}
