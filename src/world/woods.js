// The wood through the north gate (layout.woods) and its circuit, the Hollow Run: the lie of the ground, the track's bed and berms, the humps,
// the pond, the mud, and where the trees, logs and bogs go. Pure: used by the terrain, the fields, the props, the map and the girls.
// Nothing here is drawn; the meshes are in woodsProps.js.

import { Track } from './track.js';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const inRect = (r, x, z, margin = 0) => x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

const CELL = 6; // metres: the grid that finds the nearest bit of track without looking at all of it
const BERM_REACH = 4.5; // metres past the track's edge that a berm (or the nearest-track search) reaches
const BEND_RADIUS = [7, 17]; // metres: a bend this tight has a full berm, this wide none

/** Null when the layout has no wood. */
export function createWoods(layout) {
  const w = layout.woods;
  if (!w) return null;
  const rect = { minX: w.minX, maxX: w.maxX, minZ: w.minZ, maxZ: w.maxZ };
  const c = w.circuit;
  const half = c.halfWidth;
  const track = new Track(c.points, 30);
  const pts = track.points;
  const n = pts.length;
  const farm = layout.farm ?? { minX: -layout.fieldHalf, maxX: layout.fieldHalf, minZ: -layout.fieldHalf, maxZ: layout.fieldHalf };
  const pond = w.pond ?? null;

  /** The point `metres` round the circuit from its first control point (the junction with the lead-in). */
  const at = (metres) => track.sample(metres / track.totalLength);

  // How tight the circuit bends at each sample, and which way (+1 or -1, as the sign of the cross product of the way on and the way after).
  const bend = new Float32Array(n);
  const turn = new Int8Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 5 + n) % n];
    const b = pts[i];
    const d = pts[(i + 5) % n];
    const ab = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bd = Math.hypot(d[0] - b[0], d[1] - b[1]);
    const ad = Math.hypot(d[0] - a[0], d[1] - a[1]);
    const cross = (b[0] - a[0]) * (d[1] - b[1]) - (b[1] - a[1]) * (d[0] - b[0]);
    const radius = Math.abs(cross) < 1e-9 ? Infinity : (ab * bd * ad) / (2 * Math.abs(cross));
    bend[i] = 1 - smoothstep(BEND_RADIUS[0], BEND_RADIUS[1], radius);
    turn[i] = cross > 0 ? 1 : -1;
  }

  /**
   * A grid of a loop's segments, so a query looks at the few near it. Returns a function: the nearest part of the loop within `reach` of
   * (x, z), as its distance, the segment, and which side of the way on the point is (+1 or -1).
   */
  const nearestOf = (loop, reach) => {
    const m = loop.length;
    const grid = new Map();
    const key = (ix, iz) => ix * 4096 + iz;
    for (let i = 0; i < m; i++) {
      const a = loop[i];
      const b = loop[(i + 1) % m];
      const x0 = Math.floor((Math.min(a[0], b[0]) - reach) / CELL);
      const x1 = Math.floor((Math.max(a[0], b[0]) + reach) / CELL);
      const z0 = Math.floor((Math.min(a[1], b[1]) - reach) / CELL);
      const z1 = Math.floor((Math.max(a[1], b[1]) + reach) / CELL);
      for (let ix = x0; ix <= x1; ix++) {
        for (let iz = z0; iz <= z1; iz++) {
          const k = key(ix + 2048, iz + 2048);
          const list = grid.get(k);
          if (list) list.push(i);
          else grid.set(k, [i]);
        }
      }
    }
    return (x, z) => {
      const list = grid.get(key(Math.floor(x / CELL) + 2048, Math.floor(z / CELL) + 2048));
      if (!list) return NONE;
      let best = Infinity;
      let bi = -1;
      let side = 0;
      for (const i of list) {
        const a = loop[i];
        const b = loop[(i + 1) % m];
        const abx = b[0] - a[0];
        const abz = b[1] - a[1];
        const len2 = abx * abx + abz * abz;
        const t = clamp(len2 > 0 ? ((x - a[0]) * abx + (z - a[1]) * abz) / len2 : 0, 0, 1);
        const dx = x - (a[0] + abx * t);
        const dz = z - (a[1] + abz * t);
        const d2 = dx * dx + dz * dz;
        if (d2 < best) {
          best = d2;
          bi = i;
          side = abx * dz - abz * dx > 0 ? 1 : -1;
        }
      }
      return { d: Math.sqrt(best), i: bi, side };
    };
  };
  const NONE = { d: Infinity, i: -1, side: 0 };
  /** The nearest part of the circuit within reach of (x, z): its distance, the segment, and which side of the way on the point is (+1 or -1). */
  const nearest = nearestOf(pts, half + BERM_REACH);

  /** Metres from (x, z) to the nearest point of a line through `list` ([x, z] pairs). */
  const lineDistance = (list, x, z) => {
    let best = Infinity;
    for (let i = 0; i < list.length - 1; i++) {
      const [ax, az] = list[i];
      const dx = list[i + 1][0] - ax;
      const dz = list[i + 1][1] - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };
  /** Metres to the circuit or the lead-in, whichever is nearer (Infinity when neither is within reach). */
  const trackDistance = (x, z) => Math.min(nearest(x, z).d, lineDistance(w.leadIn, x, z));

  const pondR = (x, z) => (pond ? Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz) : Infinity);
  const pondCut = (x, z) => {
    const r = pondR(x, z);
    return r >= 1 ? 0 : pond.depth * (1 - smoothstep(0.3, 1, r));
  };

  // The whoops: small humps across the track, one after another, as [x, z, tx, tz].
  const wh = w.whoops;
  const whoops = [];
  for (let k = 0; wh && k < wh.count; k++) {
    const p = at(wh.from + k * wh.spacing);
    whoops.push(p);
  }

  // Bogs and logs, placed by how far round the circuit they are.
  const bogs = (w.bogs ?? []).map((b) => {
    const p = at(b.at);
    return { x: p.x, z: p.z, radius: b.radius };
  });
  const logs = (w.logs ?? []).map((l) => {
    const p = at(l.at);
    const nx = -p.tz; // across the track
    const nz = p.tx;
    const lat = l.side * (half + 0.35 - l.len / 2);
    return { x: p.x + nx * lat, z: p.z + nz * lat, yaw: Math.atan2(-nz, nx), len: l.len, r: 0.28 };
  });
  const deadwood = (w.deadwood ?? []).map(([x, z, yaw, len]) => ({ x, z, yaw, len, r: 0.24 }));

  // The Fern Trail: a narrow loop for the two-wheelers between the circuit's rows (null when the layout has none).
  const tr = w.trail ?? null;
  const trailHalf = tr ? tr.halfWidth : 0;
  const trailTrack = tr ? new Track(tr.points, 30) : null;
  const trailNearest = tr ? nearestOf(trailTrack.points, trailHalf + 2.6) : null;
  /** The point `metres` round the trail from its first control point (by the lead-in). */
  const trailAt = (metres) => trailTrack.sample((((metres % trailTrack.totalLength) + trailTrack.totalLength) % trailTrack.totalLength) / trailTrack.totalLength);
  /** Metres round the trail of its segment `i`. */
  const trailMetres = (i) => trailTrack.lengths[i];
  /** The thing laid across the trail `metres` round: where it is, its yaw (its long side across the way) and `len` m of it. */
  const across = (metres, len, extra) => {
    const p = trailAt(metres);
    return { x: p.x, z: p.z, yaw: Math.atan2(-p.tx, -p.tz), len, at: metres, ...extra };
  };
  const hop = tr?.hop ? across(tr.hop.at, tr.hop.len, { r: tr.hop.r }) : null;
  const dips = tr ? (tr.dips ?? []).map((d) => ({ ...d, ...trailAt(d.at) })) : [];
  // Clusters of roots across the trail, three to a cluster at slightly different angles, none where it crosses the circuit or by the log or a dip.
  const trailDistanceToCircuit = (m) => {
    const p = trailAt(m);
    return nearest(p.x, p.z).d;
  };
  const roots = [];
  if (tr?.roots) {
    const ro = tr.roots;
    for (let m = ro.from, k = 0; m < trailTrack.totalLength - 6; m += ro.spacing, k++) {
      if (trailDistanceToCircuit(m) < half + trailHalf + 2.5) continue;
      if (hop && Math.abs(m - hop.at) < 8) continue;
      if (dips.some((d) => Math.abs(m - d.at) < d.len / 2 + 3)) continue;
      for (let j = 0; j < ro.count; j++) {
        const jitter = Math.sin((k * 7 + j * 3) * 1.7); // -1..1, the same every load
        roots.push(across(m + j * 0.9 - 0.9 + jitter * 0.3, 2 * trailHalf + 1.1 + (jitter + 1) * 0.3, { r: ro.rise + 0.02 * (jitter + 1) / 2, k }));
        roots[roots.length - 1].yaw += jitter * 0.35;
      }
    }
  }
  // Way-marker posts every `postEvery` m on the right of the way on, just off the edge, none on a crossing.
  const posts = [];
  if (tr) {
    for (let m = tr.postEvery * 0.5; m < trailTrack.totalLength - 4; m += tr.postEvery) {
      const p = trailAt(m);
      if (nearest(p.x, p.z).d < half + trailHalf + 2.5) continue;
      posts.push({ x: p.x - p.tz * (trailHalf + 0.7), z: p.z + p.tx * (trailHalf + 0.7), yaw: Math.atan2(-p.tx, -p.tz), at: m }); // facing back along the way on
    }
  }

  /**
   * The wood's ground at (x, z), relative to the farm's gentle rolling (terrainHeight.js adds it to baseHeight): a little roll, the swell
   * between the rows, the pond's bowl, then the circuit's bed, the berms on the outside of its tight bends, and the whoops. It runs in
   * over the first 14 m from the grass field's hedge, so there is no step at the gate.
   */
  function profile(x, z) {
    const edge = smoothstep(0, 14, rect.maxZ - z);
    if (edge <= 0) return 0;
    let h = 0.4 * Math.sin(x * 0.21 + 1.3) * Math.sin(z * 0.17 + 0.4) + 0.25 * Math.sin(x * 0.11 - z * 0.13 + 2);
    const hump = w.hump;
    if (hump) h += hump.rise * (1 - smoothstep(0, 1, Math.hypot(x - hump.x, z - hump.z) / hump.r));
    if (pond) h -= 0.9 * (1 - smoothstep(0, 1, Math.hypot(x - pond.x, z - pond.z) / 26));
    h -= pondCut(x, z);
    const near = nearest(x, z);
    if (near.i >= 0) {
      const d = near.d;
      h -= c.depth * (1 - smoothstep(half * 0.75, half + 0.5, d));
      // A berm on the outside of a tight bend, from the track's edge out.
      if (near.side !== turn[near.i]) {
        h += 0.5 * bend[near.i] * smoothstep(half * 0.9, half + 0.9, d) * (1 - smoothstep(half + 1.2, half + 1.2 + BERM_REACH - 1.2, d));
      }
    }
    for (const p of whoops) {
      const vx = x - p.x;
      const vz = z - p.z;
      const along = vx * p.tx + vz * p.tz;
      const across = vx * p.tz - vz * p.tx;
      if (Math.abs(along) < wh.r && Math.abs(across) < half + 2.5) {
        h += wh.rise * (1 - smoothstep(0, wh.r, Math.abs(along))) * (1 - smoothstep(half + 0.5, half + 2.5, Math.abs(across)));
      }
    }
    if (tr) {
      const t = trailNearest(x, z);
      if (t.i >= 0) {
        h -= tr.depth * (1 - smoothstep(trailHalf * 0.7, trailHalf + 0.5, t.d));
        for (const dip of dips) {
          const along = Math.abs(trailMetres(t.i) - dip.at);
          if (along < dip.len / 2) h -= dip.depth * (1 - smoothstep(0, 1, along / (dip.len / 2))) * (1 - smoothstep(trailHalf + 0.4, trailHalf + 2.4, t.d));
        }
      }
    }
    // The lead-in from the gate is bedded like the circuit.
    h -= c.depth * (1 - smoothstep(half * 0.75, half + 0.5, lineDistance(w.leadIn, x, z)));
    return h * edge;
  }

  /** 0..1 how much of the ground at (x, z) is the wood's own rather than the farmland round it, fading out over 40 m beyond its hedges. */
  function weight(x, z) {
    if (inRect(farm, x, z)) return 0;
    return 1 - smoothstep(0, 40, outside(rect, x, z));
  }

  /** 0..1 how much water stands at (x, z): the pond, where it is cut deeper than the water stands. */
  function waterAt(x, z) {
    if (!pond || pondR(x, z) >= 1) return 0;
    const dry = pond.depth - pond.water;
    return clamp((pondCut(x, z) - dry) / (pond.water * 0.5), 0, 1);
  }

  /** 0..1 mud: churned along the circuit and the lead-in, and round the pond's shore. */
  function mudAt(x, z) {
    if (!inRect(rect, x, z, -3)) return 0;
    let m = 0.85 * (1 - smoothstep(half * 0.7, half + 0.6, nearest(x, z).d));
    m = Math.max(m, 0.7 * (1 - smoothstep(half * 0.7, half + 0.6, lineDistance(w.leadIn, x, z))));
    if (pond) m = Math.max(m, 0.8 * (1 - smoothstep(1, 1.3, pondR(x, z))));
    if (tr) {
      // The trail is packed earth, damp only in the dips.
      const t = trailNearest(x, z);
      if (t.i >= 0) {
        const on = 1 - smoothstep(trailHalf * 0.7, trailHalf + 0.5, t.d);
        const wet = dips.some((dip) => Math.abs(trailMetres(t.i) - dip.at) < dip.len / 2) ? 0.55 : 0;
        m = Math.max(m, on * (0.12 + wet));
      }
    }
    return m;
  }

  const inWoods = (x, z, margin = 0) => inRect(rect, x, z, margin);
  /** Whether (x, z) is some way in from the gate: where a girl following you stops short and waits (`waitSpot`) rather than driving in among the trees. */
  const pastGate = (x, z) => inWoods(x, z) && z < rect.maxZ - 8;
  const waitSpot = { x: w.gate.x + 3, z: rect.maxZ - 3.5 };

  /** Whether a trunk may stand at (x, z): inside the hedges, clear of the track, the pond, the bogs and the logs. `clear` is the room left beside the track. */
  function treeOk(x, z, clear = 2.6) {
    if (!inWoods(x, z, 3.5)) return false;
    if (trackDistance(x, z) < half + clear) return false;
    if (trailNearest && trailNearest(x, z).d < trailHalf + (clear > 2 ? 1.1 : 0.5)) return false; // close enough to steer round, not to block it
    if (pondR(x, z) < 1.5) return false;
    for (const b of bogs) if (Math.hypot(x - b.x, z - b.z) < b.radius + 1.5) return false;
    for (const l of [...logs, ...deadwood]) if (Math.hypot(x - l.x, z - l.z) < 2.5 + l.len / 2) return false;
    if (hop && Math.hypot(x - hop.x, z - hop.z) < 2.5) return false;
    if (tr && Math.hypot(x - tr.entrance.x, z - tr.entrance.z) < 2.5) return false; // the sign
    return true;
  }

  return {
    rect, name: w.name, circuitName: c.name, trailName: tr?.name ?? null, trailTrack, trailHalf, trailDepth: tr?.depth ?? 0, track, leadIn: w.leadIn, halfWidth: half, pond, bogs, logs, deadwood, whoops, gate: w.gate, waitSpot,
    trail: tr ? { name: tr.name, entrance: tr.entrance, hop, dips, roots, posts } : null, trailAt, trailNearest, trailMetres,
    at, nearest, trackDistance, lineDistance, profile, weight, waterAt, pondCut, mudAt, inWoods, pastGate, treeOk,
    outside: (x, z) => outside(rect, x, z),
  };
}

/**
 * Where the oaks and the bushes go in the wood: random spots, thinned into clearings by a slow patchy pattern, no two oaks closer than 6 m,
 * none on the track or in the pond. `random` is a function giving 0..1. Returns { trees: [[x, z, scale]], bushes: [[x, z]] }.
 */
export function woodsPlants(woods, layout, random) {
  const w = layout.woods;
  const r = woods.rect;
  const patch = (x, z) => 0.5 + 0.25 * Math.sin(x * 0.06 + z * 0.045 + 0.7) + 0.25 * Math.sin(z * 0.09 - x * 0.04 + 2.1);
  const trees = [];
  for (let tries = 0; trees.length < w.trees && tries < 40000; tries++) {
    const x = r.minX + 3.5 + random() * (r.maxX - r.minX - 7);
    const z = r.minZ + 3.5 + random() * (r.maxZ - r.minZ - 7);
    if (random() > 0.2 + 0.8 * patch(x, z)) continue;
    if (!woods.treeOk(x, z)) continue;
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 6)) continue;
    trees.push([x, z, 0.9 + random() * 0.9]);
  }
  const bushes = [];
  for (let tries = 0; bushes.length < w.bushes && tries < 20000; tries++) {
    const x = r.minX + 2.5 + random() * (r.maxX - r.minX - 5);
    const z = r.minZ + 2.5 + random() * (r.maxZ - r.minZ - 5);
    if (!woods.treeOk(x, z, 1.6)) continue;
    bushes.push([x, z]);
  }
  return { trees, bushes };
}
