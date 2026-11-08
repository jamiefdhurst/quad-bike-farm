// One road network (#664). Pure: no Three.js, no DOM.
//
// Every road on the map (the public lane, the farm road, the village street, and later Back Lane, the drive and the A-road) is one entry in
// `layout.roads`: a centreline through points (smoothed), a width, a surface, markings, verges, and whether hedges line it. A road that
// ends on another is joined to it end to side (`junction`). This module answers what the rest of the world asks of a road: how far it is,
// whether (x, z) is hard standing and of what surface, how to level the ground across it, the points along it for traffic and the map,
// and where the passing places are on single track. world/roadMesh.js draws them, one builder for all.
//
// A road is:
//   id, name           what to call it
//   surface            'tarmac' | 'stone'
//   points             [[x, z], ...] the centreline, smoothed through a Catmull-Rom curve
//   halfWidth          m from the middle to the edge of the carriageway
//   pavement           m of hard standing beyond that each side (the village's pavements): hard, but not carriageway
//   markings           { centre: 'dashed' | 'solid' | 'none', edge: bool, giveWay: bool } ('none' for single track), see MARKINGS
//   verge, hedged      m of grass between the edge and the hedges, and whether hedges line it
//   junction           { end: 'start' | 'end', onto: <road id> }: that end meets the side of the other road
//   level              null, or { shoulder, lead: [start, end], blend, mouth }: laid level across (see levelAt); `camber` is the crown's height
//   pads               [{ x, z, radius }] round hard standing along it (the farm road's hardstanding)
//   passing            { spacing, length, bay } for single track: a widening every `spacing` m (see passingPlaces)
//   cuttings           [{ from, to }] stretches (m along) where the road may run in a cutting deeper than MAX_CUT
//   draw               'mesh' (laid over the ground) or 'ground' (painted into the ground, so mud and wet and snow lie on it)

export const MAX_CUT = 1.5; // m a levelled road may sink into a bank before the cutting has to be flagged on the road
export const EDGE = 0.15; // m: the soft edge of hard standing, a hand's width across
export const KEEP_LEFT = 0.48; // of a road's half width: where a vehicle drives, to the left of its way

export const SURFACES = ['tarmac', 'stone'];
export const MARKINGS = ['dashed', 'solid', 'none'];

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Where the dashes of a broken line go: `on` m long every `on + off` m from `from` to `to` m along, `width` m wide: [{ s, len, a, b }] (s the middle of each). `whole`: every dash is full length, even the last, which then runs past `to`. */
export function dashes({ on, off, from = 0, to, width = 0.14, whole = false }) {
  const out = [];
  for (let start = from; start < to; start += on + off) {
    const len = whole ? on : Math.min(on, to - start);
    if (len > 0.05) out.push({ s: start + len / 2, len, a: -width / 2, b: width / 2 });
  }
  return out;
}

/** A Catmull-Rom curve through `points` ([x, z]), sampled about every `step` m: [{ x, z, tx, tz }] with (tx, tz) the unit direction of travel. */
export function smoothRoad(points, step = 1) {
  const p = [points[0], ...points, points[points.length - 1]];
  const out = [];
  for (let i = 1; i < p.length - 2; i++) {
    const [p0, p1, p2, p3] = [p[i - 1], p[i], p[i + 1], p[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const c = (a, b, c2, d) => 0.5 * (2 * b + (-a + c2) * t + (2 * a - 5 * b + 4 * c2 - d) * t * t + (-a + 3 * b - 3 * c2 + d) * t * t * t);
      out.push({ x: c(p0[0], p1[0], p2[0], p3[0]), z: c(p0[1], p1[1], p2[1], p3[1]) });
    }
  }
  const last = points[points.length - 1];
  out.push({ x: last[0], z: last[1] });
  for (let i = 0; i < out.length; i++) {
    const a = out[Math.max(0, i - 1)];
    const b = out[Math.min(out.length - 1, i + 1)];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    out[i].tx = (b.x - a.x) / len;
    out[i].tz = (b.z - a.z) / len;
  }
  return out;
}

/** The straight pieces a run of samples makes: interior samples that sit on the chord between their neighbours are dropped, with their `s` kept. */
function simplify(samples) {
  const keep = [samples[0]];
  for (let i = 1; i < samples.length - 1; i++) {
    const a = keep[keep.length - 1];
    const b = samples[i + 1];
    const c = samples[i];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    if (Math.abs(((c.x - a.x) * (b.z - a.z) - (c.z - a.z) * (b.x - a.x)) / len) > 1e-6) keep.push(c);
  }
  keep.push(samples[samples.length - 1]);
  return keep;
}

function buildRoad(def, step) {
  if (!SURFACES.includes(def.surface)) throw new Error(`road '${def.id}': surface '${def.surface}' is not one of ${SURFACES.join(', ')}`);
  if (!def.points || def.points.length < 2) throw new Error(`road '${def.id}': needs at least two points`);
  const samples = smoothRoad(def.points, step);
  let s = 0;
  samples.forEach((p, i) => {
    if (i > 0) s += Math.hypot(p.x - samples[i - 1].x, p.z - samples[i - 1].z);
    p.s = s;
  });
  const pts = simplify(samples);
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len > 0) segs.push({ a, b, len, tx: (b.x - a.x) / len, tz: (b.z - a.z) / len });
  }
  const pavement = def.pavement ?? 0;
  const hard = def.halfWidth + pavement;
  const pads = (def.pads ?? []).map((q) => ({ ...q }));
  const bays = [];
  const road = {
    ...def,
    pavement,
    hard,
    pads,
    markings: { centre: 'none', edge: false, giveWay: false, ...(def.markings ?? {}) },
    camber: def.camber ?? 0,
    samples,
    length: s,
    segs,
    bays,
  };
  // Where it can be, for a quick no.
  const reach = hard + EDGE + (def.passing ? def.passing.bay : 0);
  const xs = samples.map((p) => p.x);
  const zs = samples.map((p) => p.z);
  road.bounds = { minX: Math.min(...xs) - reach, maxX: Math.max(...xs) + reach, minZ: Math.min(...zs) - reach, maxZ: Math.max(...zs) + reach };
  for (const q of pads) {
    road.bounds.minX = Math.min(road.bounds.minX, q.x - q.radius - EDGE);
    road.bounds.maxX = Math.max(road.bounds.maxX, q.x + q.radius + EDGE);
    road.bounds.minZ = Math.min(road.bounds.minZ, q.z - q.radius - EDGE);
    road.bounds.maxZ = Math.max(road.bounds.maxZ, q.z + q.radius + EDGE);
  }
  return road;
}

/** The point `s` m along a road (one of the network's `roads`): { x, z, tx, tz }. Clamped to its ends. */
export function pointAt(road, s) {
  const S = road.samples;
  if (s <= 0) return { ...S[0] };
  if (s >= road.length) return { ...S[S.length - 1] };
  let lo = 0;
  let hi = S.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (S[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = S[lo];
  const b = S[hi];
  const f = (s - a.s) / ((b.s - a.s) || 1);
  const tx = a.tx + (b.tx - a.tx) * f;
  const tz = a.tz + (b.tz - a.tz) * f;
  const len = Math.hypot(tx, tz) || 1;
  return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, tx: tx / len, tz: tz / len };
}

/**
 * The nearest point on the road's middle line to (x, z): `d` the distance, `s` the metres along from its start, `across` signed (positive on
 * the left of the way it runs), `at` the point and its heading. A road that joins another is cut square at that end; the others end in a round cap.
 * `lead` is how far past each end [start, end] the line is taken to run on, straight on, for levelling.
 */
function nearestOn(road, x, z, lead = null) {
  let best = null;
  const last = road.segs.length - 1;
  // A road that ends on another is cut square there (a plane across it at that end), not rounded off, so its width never spills over the far side.
  const j = road.junction?.end;
  let depth = Infinity; // how far in from that square end
  if (j) {
    const g = j === 'start' ? road.segs[0] : road.segs[last];
    const e = j === 'start' ? g.a : g.b;
    const sign = j === 'start' ? 1 : -1;
    depth = ((x - e.x) * g.tx + (z - e.z) * g.tz) * sign;
    if (depth < 0) return null;
  }
  road.segs.forEach((g, i) => {
    const px = x - g.a.x;
    const pz = z - g.a.z;
    const raw = px * g.tx + pz * g.tz;
    let t = raw;
    const lo = i === 0 && lead ? -lead[0] : 0;
    const hi = g.len + (i === last && lead ? lead[1] : 0);
    t = Math.min(hi, Math.max(lo, t));
    const cx = g.a.x + g.tx * t;
    const cz = g.a.z + g.tz * t;
    const d = Math.hypot(x - cx, z - cz);
    if (!best || d < best.d) best = { d, g, t, cx, cz, raw };
  });
  if (!best) return null;
  const { g, t, cx, cz } = best;
  const across = (x - cx) * g.tz - (z - cz) * g.tx; // left of travel: for heading (0, 1) (south) the left is east, +x
  return { d: best.d, s: g.a.s + t, raw: g.a.s + best.raw, depth, across: across === 0 ? 0 : across, at: { x: cx, z: cz, tx: g.tx, tz: g.tz }, seg: g };
}

/**
 * The network from the layout (`layout.roads`), or a quiet one on a layout without roads. The roads are built once and shared.
 */
const cache = new WeakMap();
export function roadNetwork(layout) {
  if (!cache.has(layout)) cache.set(layout, createRoads(layout.roads ?? []));
  return cache.get(layout);
}

export function createRoads(defs, { step = 1 } = {}) {
  const roads = defs.map((d) => buildRoad(d, step));
  const byId = new Map(roads.map((r) => [r.id, r]));
  if (byId.size !== roads.length) throw new Error('roads: two roads share an id');
  for (const r of roads) {
    if (r.junction && !byId.has(r.junction.onto)) throw new Error(`road '${r.id}': joins '${r.junction.onto}', which is not a road`);
    if (r.junction && !['start', 'end'].includes(r.junction.end)) throw new Error(`road '${r.id}': a junction is at its 'start' or 'end'`);
  }

  const road = (id) => byId.get(id) ?? null;

  /** Single-track passing places: [{ s, x, z, tx, tz, side, length, bay }], alternating sides and clear of the ends and junctions. */
  function passingPlaces(r) {
    if (!r.passing) return [];
    const { spacing, length, bay } = r.passing;
    const out = [];
    const clear = Math.max(length, 12);
    let side = 1;
    for (let s = spacing / 2; s < r.length - clear; s += spacing) {
      if (s < clear) continue;
      const p = pointAt(r, s);
      out.push({ s, x: p.x, z: p.z, tx: p.tx, tz: p.tz, side, length, bay });
      side = -side;
    }
    return out;
  }
  for (const r of roads) {
    const places = passingPlaces(r);
    for (const p of places) r.bays.push(p);
  }

  /** 0..1 how much of (x, z) is hard standing from road `r`, of any surface: carriageway, pavements, pads and passing bays, with a soft edge. */
  function coverOf(r, x, z) {
    const b = r.bounds;
    if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) return 0;
    let t = 0;
    const n = nearestOn(r, x, z);
    if (n) t = 1 - smoothstep(r.hard - EDGE, r.hard + EDGE, n.d);
    if (t < 1) {
      for (const q of r.pads) t = Math.max(t, 1 - smoothstep(q.radius - EDGE, q.radius + EDGE, Math.hypot(x - q.x, z - q.z)));
    }
    if (t < 1) {
      for (const p of r.bays) {
        const dx = x - p.x;
        const dz = z - p.z;
        const out = (dx * p.tz - dz * p.tx) * p.side; // metres out to the bay's side of the middle
        if (out < 0) continue; // the other side is the road's own
        const dAlong = Math.max(Math.abs(dx * p.tx + dz * p.tz) - p.length / 2, 0);
        const dOut = Math.max(out - (r.halfWidth + p.bay), 0);
        t = Math.max(t, 1 - smoothstep(0, EDGE * 2, Math.hypot(dAlong, dOut)));
      }
    }
    return t;
  }

  /** 0..1 how much of (x, z) is tarmac. */
  function tarmacAt(x, z) {
    let t = 0;
    for (const r of roads) {
      if (r.surface !== 'tarmac') continue;
      const c = coverOf(r, x, z);
      if (c > t) {
        t = c;
        if (t >= 1) return 1;
      }
    }
    return t;
  }

  /** The surface under (x, z) with how much of it: { surface: 'tarmac' | 'stone', t, road } for the strongest hard standing, or null for none. */
  function surfaceAt(x, z) {
    let best = null;
    for (const r of roads) {
      const c = coverOf(r, x, z);
      if (c > 0.001 && (!best || c > best.t)) best = { surface: r.surface, t: c, road: r.id };
    }
    return best;
  }

  /** The stone (or any non-tarmac) hard standing at (x, z), 0..1. */
  const stoneAt = (x, z) => {
    let t = 0;
    for (const r of roads) if (r.surface === 'stone') t = Math.max(t, coverOf(r, x, z));
    return t;
  };

  /** The nearest road to (x, z) within `within` m of its middle: { road, d, s, across, at } or null. */
  function nearest(x, z, within = Infinity) {
    let best = null;
    for (const r of roads) {
      const n = nearestOn(r, x, z);
      if (n && n.d <= within && (!best || n.d < best.d)) best = { road: r, d: n.d, s: n.s, across: n.across, at: n.at };
    }
    return best;
  }

  /** Whether (x, z) is on road `id`'s own carriageway (not its verge, pavement or a pad), between its two ends. */
  function onRoad(id, x, z) {
    const r = byId.get(id);
    if (!r) return false;
    const n = nearestOn(r, x, z, [0, 0]);
    return !!n && n.d <= r.halfWidth && n.raw >= 0 && n.raw <= r.length;
  }

  /** Whether (x, z) is within the carriageway (not the pavement) of any road, and which. */
  function onCarriageway(x, z) {
    for (const r of roads) {
      const n = nearestOn(r, x, z);
      if (n && n.d <= r.halfWidth) return r;
    }
    return null;
  }

  /**
   * Points along road `id` for a route or the map: every `step` m (and its last point), `offset` m to the left of the way you travel, from `from`
   * to `to` m along. `dir` -1 runs it the other way, where "left" turns round with you. [{ x, z, tx, tz, s }] in the order of travel.
   */
  function pointsAlong(id, { step: every = 4, offset = 0, from = 0, to = null, dir = 1 } = {}) {
    const r = byId.get(id);
    const end = Math.min(to ?? r.length, r.length);
    const out = [];
    const at = (s) => {
      const p = pointAt(r, s);
      const tx = p.tx * dir;
      const tz = p.tz * dir;
      return { x: p.x + tz * offset, z: p.z - tx * offset, tx, tz, s };
    };
    for (let s = from; s < end; s += every) out.push(at(s));
    out.push(at(end));
    return dir < 0 ? out.reverse() : out;
  }

  /**
   * Where a vehicle driving road `id` the way `dir` (+1 with its points, -1 against) keeps to: from `lead[0]` m before the start of that way to
   * `lead[1]` m past its end (one number is both), `KEEP_LEFT` of the half width to the left of its middle. [{ x, z }, { x, z }] for a straight road.
   */
  function lanePath(id, dir, lead = 0) {
    const r = byId.get(id);
    const [before, after] = Array.isArray(lead) ? lead : [lead, lead];
    const off = r.halfWidth * KEEP_LEFT;
    const [a, b] = [pointAt(r, 0), pointAt(r, r.length)];
    const ends = dir > 0 ? [a, b] : [b, a];
    const at = (p, along) => ({ x: p.x + p.tx * dir * along + p.tz * dir * off, z: p.z + p.tz * dir * along - p.tx * dir * off });
    return [at(ends[0], -before), at(ends[1], after)];
  }

  /** The metres of ground a levelled road's centre sits at `s` m along, from `ground(x, z)`; the ends that join another road take that road's level there. */
  function centreLevel(r, s, ground, depth = 0) {
    const p = pointAt(r, s);
    let level = ground(p.x, p.z);
    if (r.junction && depth < 4) {
      const parent = byId.get(r.junction.onto);
      const blend = r.level?.blend ?? 8;
      const dEnd = r.junction.end === 'start' ? s : r.length - s;
      const w = 1 - smoothstep(0, blend, dEnd);
      if (w > 0) {
        const hit = nearestOn(parent, p.x, p.z);
        const join = parent.level ? centreLevel(parent, hit.s, ground, depth + 1) : ground(hit.at.x, hit.at.z);
        level += (join - level) * w;
      }
    }
    return level;
  }

  /**
   * How to lay the ground across a levelled road at (x, z): { k, level } or null where no road reaches. `k` is 0..1 how far the ground is pulled
   * to `level` (full on the carriageway and pads, easing out over `shoulder` m), `level` the height there: the ground along the road's own middle
   * (`ground(x, z)`, the land's lie), plus a camber that crowns the middle by `camber` m. A pad is flat, at the ground's height at its middle.
   * Where roads overlap their levels are mixed by how far each reaches, so there is no step between them, and at a junction they agree (centreLevel).
   */
  function levelAt(x, z, ground) {
    let sumK = 0;
    let sumKL = 0;
    let none = 1;
    for (const r of roads) {
      if (!r.level) continue;
      const shoulder = r.level.shoulder ?? 3;
      const b = r.bounds;
      const m = shoulder + (r.level.lead ? Math.max(...r.level.lead) : 0);
      if (x < b.minX - m || x > b.maxX + m || z < b.minZ - m || z > b.maxZ + m) continue;
      const n = nearestOn(r, x, z, r.level.lead ?? null);
      let d = n ? n.d - r.halfWidth : Infinity;
      let level = null;
      let across = 0;
      if (n) {
        level = centreLevel(r, Math.min(r.length, Math.max(0, n.s)), ground);
        // Before the start the lead runs straight on, at the ground's height along that line (not clamped to where the curve of its cap ends).
        if (r.level.lead && n.s <= 0) {
          const end = pointAt(r, 0);
          level = ground(end.x + end.tx * Math.min(0, n.raw), end.z + end.tz * Math.min(0, n.raw));
        }
        across = n.d;
      }
      let k = n ? 1 - smoothstep(0, shoulder, d) : 0;
      let padK = 0;
      let padLevel = 0;
      for (const q of r.pads) {
        const dp = Math.hypot(x - q.x, z - q.z) - q.radius;
        const kp = 1 - smoothstep(0, shoulder, dp);
        if (kp > k) k = kp;
        const pk = 1 - smoothstep(-4, 2, dp);
        if (pk > padK) {
          padK = pk;
          padLevel = ground(q.x, q.z);
        }
      }
      if (k <= 0) continue;
      let lv = level ?? padLevel;
      if (level !== null && padK > 0) lv = level * (1 - padK) + padLevel * padK;
      if (r.camber && n && across < r.halfWidth) lv += r.camber * (1 - (across / r.halfWidth) ** 2) * (1 - padK);
      // A road that joins another fades in from its square end over `mouth` m, so the main road is all there is at the join and its levels meet.
      if (n && r.junction) k *= smoothstep(0, r.level.mouth ?? 4, n.depth);
      sumK += k;
      sumKL += k * lv;
      none *= 1 - k;
    }
    return sumK > 0 ? { k: 1 - none, level: sumKL / sumK } : null;
  }

  /**
   * Where a levelled road runs in a cutting: stretches where the land at the edge of the road stands more than MAX_CUT above the road's level,
   * checked every `every` m along: [{ road, from, to, depth }]. A cutting the road lists in `cuttings` is flagged (`flagged: true`) and fine.
   */
  function cuttings(ground, every = 2) {
    const found = [];
    for (const r of roads) {
      if (!r.level) continue;
      let run = null;
      for (let s = 0; s <= r.length + 1e-9; s += every) {
        const c = pointAt(r, Math.min(s, r.length));
        const level = centreLevel(r, Math.min(s, r.length), ground);
        let depth = 0;
        for (const side of [-1, 1]) {
          const e = r.halfWidth + (r.verge ?? 0);
          depth = Math.max(depth, ground(c.x + c.tz * side * e, c.z - c.tx * side * e) - level);
        }
        if (depth > MAX_CUT) {
          if (!run) run = { road: r.id, from: s, to: s, depth };
          run.to = s;
          run.depth = Math.max(run.depth, depth);
        } else if (run) {
          found.push(run);
          run = null;
        }
      }
      if (run) found.push(run);
    }
    for (const c of found) c.flagged = (byId.get(c.road).cuttings ?? []).some((f) => c.from >= f.from - 1e-6 && c.to <= f.to + 1e-6);
    return found;
  }

  /** A box round road `id`'s hard standing (and pads), grown by `margin`; optionally clipped to { minX, maxX, minZ, maxZ }. */
  function boundsOf(id, margin = 0, clip = null) {
    const b = byId.get(id).bounds;
    const out = { minX: b.minX - margin, maxX: b.maxX + margin, minZ: b.minZ - margin, maxZ: b.maxZ + margin };
    if (clip) {
      out.minX = Math.max(out.minX, clip.minX ?? -Infinity);
      out.maxX = Math.min(out.maxX, clip.maxX ?? Infinity);
      out.minZ = Math.max(out.minZ, clip.minZ ?? -Infinity);
      out.maxZ = Math.min(out.maxZ, clip.maxZ ?? Infinity);
    }
    return out;
  }

  return { roads, road, onRoad, tarmacAt, stoneAt, surfaceAt, nearest, onCarriageway, pointsAlong, lanePath, passingPlaces: (id) => byId.get(id).bays, levelAt, cuttings, boundsOf, pointAt: (id, s) => pointAt(byId.get(id), s) };
}
