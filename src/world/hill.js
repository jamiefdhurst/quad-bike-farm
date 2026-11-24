// The hill through the south gate (layout.hill): the sunk green lane, the stream and its ford, and the rough pasture climbing in banks
// beyond. Pure: the shape of the ground, where the water is, and where things are, used by the terrain, the fields, the props and the girls.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const inRect = (r, x, z, margin = 0) => x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));
/** Whether (x, z) is in a field: its rectangle, or its own outline (`points`, the new farm's) when it has one, `margin` m in from its edge (out for a negative). */
const within = (r, x, z, margin = 0) => (r.points ? pointInPolygon(r.points, x, z, margin, r.edges) : inRect(r, x, z, margin));

import { pointInPolygon, outsidePolygon, polygonEdges } from './polygons.js';

/** How many tries the hill wood's oak loop gets: 60 for each oak a layout asks for, and today's own 2000 where it asks for none (so today's draws are as they were). */
export const woodTries = (wood) => (wood.trees ? wood.trees * 60 : 2000);

/** Null when the layout has no hill. */
export function createHill(layout) {
  const hill = layout.hill;
  if (!hill) return null;
  const { lane, pasture, stream, banks } = hill;
  const ford = stream.ford;
  /** Metres the water stands above its usual after rain (world/streamLevel.js sets it); the channel's cut and the bed don't change. */
  let rise = 0;
  const farm = layout.farm ?? { minX: -layout.fieldHalf, maxX: layout.fieldHalf, minZ: -layout.fieldHalf, maxZ: layout.fieldHalf };
  const top = lane.top ?? layout.fieldHalf; // where the lane starts: the grass field's south hedge, where the gate is (the new farm says its own)
  // The new farm's fields are outlines, not rectangles: each keeps its bounding rectangle for the ground's weight and gets its edges once.
  for (const r of [pasture, hill.paddocks?.west?.rect, hill.paddocks?.east?.rect]) if (r?.points && !r.edges) r.edges = polygonEdges(r.points);
  const laneRect = { minX: lane.x - lane.hedgeOff, maxX: lane.x + lane.hedgeOff, minZ: top, maxZ: lane.toZ };

  // The two fields either side of the lane, through gateways in its hedges: the wet meadow to the west, the sheep field to the east.
  const pad = hill.paddocks ?? null;
  // On the new farm the meadow is not beside the lane: it says its own `rect`.
  const west = pad ? pad.west.rect ?? { minX: pad.west.minX, maxX: laneRect.minX, minZ: top, maxZ: lane.toZ } : null;
  const east = pad ? pad.east.rect ?? { minX: laneRect.maxX, maxX: pad.east.maxX, minZ: top, maxZ: lane.toZ } : null;
  // `side` is which way out of the lane the gateway faces (-1 west, 1 east); `x` is the hedge line it is in.
  const gates = hill.gates
    ? hill.gates.map((g) => ({ side: g.side, x: g.side < 0 ? laneRect.minX : laneRect.maxX, z: g.z, half: g.width / 2 }))
    : pad
    ? [
        { side: -1, x: laneRect.minX, z: pad.west.gate.z, half: pad.west.gate.width / 2 },
        { side: 1, x: laneRect.maxX, z: pad.east.gate.z, half: pad.east.gate.width / 2 },
      ]
    : [];
  // The riverside meadow beyond the pasture's east hedge, where the river runs (world/brook.js); it is entered by a gateway in that hedge.
  const riverside = hill.riverside ? { ...hill.riverside } : null;
  const pond = pad?.west.pond ?? null;
  const terraces = pad?.east.terraces ?? null;
  /** How far (x, z) is through the pond, 0 at its middle and 1 at the edge of the ground it dishes. */
  const pondR = (x, z) => (pond ? Math.hypot((x - pond.x) / pond.rx, (z - pond.z) / pond.rz) : Infinity);
  /** Metres the pond is cut into the ground at (x, z). */
  const pondCut = (x, z) => {
    const r = pondR(x, z);
    return r >= 1 ? 0 : pond.depth * (1 - smoothstep(0.3, 1, r));
  };
  /** Metres from (x, z) to the nearest point of a line through `pts` ([x, z] pairs). */
  const lineDistance = (pts, x, z) => {
    let best = Infinity;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1), 0, 1);
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
    return best;
  };

  /** The stream's middle line at x. */
  const streamZ = (x) => stream.z + stream.wander * Math.sin(x * 0.05 + 1.1);
  /** 1 at the ford (where the lane crosses), 0 along the rest of the stream. */
  // On the new farm the stream runs on west to a second ford where Back Lane crosses it (#686): `stream.west` is { x, minX, halfRoad }, the road's x, how far
  // west the stream goes (the moor's edge) and the road's half width.
  const westEnd = stream.west ?? null;
  const fordK = (x) => Math.max(
    1 - smoothstep(lane.halfWidth + 1, lane.halfWidth + ford.reach, Math.abs(x - lane.x)),
    westEnd ? 1 - smoothstep(westEnd.halfRoad + 1, westEnd.halfRoad + ford.reach, Math.abs(x - westEnd.x)) : 0,
  );
  const halfAt = (x) => stream.halfWidth + (ford.halfWidth - stream.halfWidth) * fordK(x);
  const depthAt = (x) => stream.depth + (ford.depth - stream.depth) * fordK(x);
  /** How deep the water stands in the channel at x: shallower over the ford, in the same proportion as the channel. */
  const waterDepthAt = (x) => (stream.water * depthAt(x)) / stream.depth + rise;
  /** The stream's far (south) edge at x: where the climb starts. */
  const farEdge = (x) => streamZ(x) + halfAt(x);

  // The banks wander a few metres up and down the hill with x, and spread out towards the east end, the gentle way up.
  // The bigger hill adds a second, slower wander (`slowWander` m, a swing every 140 m) so a bank does not repeat itself along 390 m.
  const shift = (x) => 3 * Math.sin(x * 0.045 + 0.8) + (hill.slowWander ?? 0) * Math.sin((x * 2 * Math.PI) / 140 + 0.3);
  const spread = (x) => 1 + (hill.gentle.factor - 1) * smoothstep(hill.gentle.fromX, hill.gentle.toX, x);
  function bankSum(x, d) {
    let h = 0;
    const s = spread(x);
    for (const b of banks) {
      const w = b.width * s;
      const c = b.at + shift(x) * Math.min(1, b.at / 12);
      h += b.rise * smoothstep(c - w / 2, c + w / 2, d);
    }
    return h;
  }
  /** Metres the climb adds at (x, z): nothing up to the stream's far edge, then the banks. */
  const climb = (x, z) => {
    const d = z - farEdge(x);
    return d <= 0 ? 0 : bankSum(x, d) - bankSum(x, 0);
  };
  /** A gentle swell on the flat top (`crown`: x, z, `r` m across, `rise` m high), so the hut on it stands clear of the last bank against the sky seen from below. */
  const crown = hill.crown ?? null;
  /** The height of the top above the ford, for the tests and the docs. */
  const total = banks.reduce((s, b) => s + b.rise, 0);

  /**
   * The land beside the lane, relative to the farm: level from the gate, then down the valley side to the stream. The lane's bed falls
   * steadily from the gate to the same level by its end, `sink` m deeper again along its middle, so it runs deepest between its banks
   * halfway down and comes out at the bottom of the valley side with no hump.
   */
  const land = (x, z) => -hill.valley * smoothstep(lane.toZ - 16, streamZ(x), z);
  function bedAt(z) {
    const fall = -hill.valley * clamp((z - top) / (lane.toZ - top), 0, 1);
    return fall - lane.sink * smoothstep(top + 1, top + 12, z) * (1 - smoothstep(lane.toZ - 34, lane.toZ - 4, z));
  }
  /** How far the lane is cut below the land at (x, z): all of it between its banks, nothing at the hedges, run out through the ford. */
  function sinkAt(x, z) {
    if (z < top || z > streamZ(x)) return 0;
    let across = 1 - smoothstep(lane.halfWidth, lane.hedgeOff - 0.3, Math.abs(x - lane.x));
    // Through a gateway the bank is eased down into the field over `ramp` m, and the cut fades out along the lane a few metres either side.
    for (const g of gates) {
      const out = (x - lane.x) * g.side;
      if (out <= 0) continue;
      const along = 1 - smoothstep(g.half, g.half + 5, Math.abs(z - g.z));
      if (along > 0) across = Math.max(across, along * (1 - smoothstep(lane.halfWidth, lane.hedgeOff + pad.ramp, out)));
    }
    return across > 0 ? across * Math.max(0, land(x, z) - bedAt(z)) : 0;
  }

  /** Metres the stream's channel is cut into the ground at (x, z). */
  function channelAt(x, z) {
    if (x > pasture.maxX && hill.brook) return 0; // beyond the hedge it is the brook's (brook.js)
    // With no brook the stream ends at the pasture's hedges: the ground eases back over 8 m beyond them.
    // (On the new farm the stream's own west end is `stream.west.minX`, beyond the pasture's hedge to the road's ford and the moor's edge.)
    const ends = hill.brook ? (westEnd ? 1 - smoothstep(0, 8, westEnd.minX - x) : 1) : 1 - smoothstep(0, 8, Math.max(pasture.minX - x, x - pasture.maxX, 0));
    if (ends <= 0) return 0;
    const r = Math.abs(z - streamZ(x));
    const half = halfAt(x);
    if (r > half + 1.2) return 0;
    return ends * depthAt(x) * (1 - smoothstep(half * 0.4, half + 1.2, r));
  }

  /**
   * The stream's channel west of the pasture's hedge, to the ford at Back Lane (#686): the hill's own profile fades out there over `fade` (40 m), so the cut is what
   * it leaves out, `(1 - weight)` of the channel, so the two make one channel the whole way. 0 on a farm whose stream ends at the hedge.
   */
  function westCut(x, z, fade = 40) {
    if (!westEnd || x >= pasture.minX) return 0;
    return (1 - weight(x, z, fade)) * channelAt(x, z);
  }

  /**
   * The hill's ground at (x, z), relative to the farm's gentle rolling (terrainHeight.js adds it to baseHeight): down the valley from the
   * gate to the stream, the lane sunk into it, the stream's channel, then the banks up the pasture with tussocky rough on them.
   */
  function profile(x, z) {
    let h = land(x, z) + climb(x, z);
    h -= sinkAt(x, z);
    h -= channelAt(x, z);
    h -= pondCut(x, z);
    h += terraceLift(x, z);
    if (crown) h += crown.rise * (1 - smoothstep(0, crown.r, Math.hypot(x - crown.x, z - crown.z)));
    // Tussocks and old anthills: rough ground, kept off the lane and out of the stream.
    const rough = inPasture(x, z) || inPaddock(x, z) ? smoothstep(1, 4, Math.abs(z - streamZ(x)) - halfAt(x)) : 0;
    if (rough > 0) h += rough * 0.09 * Math.sin(x * 0.93 + z * 0.31) * Math.sin(z * 0.81 - x * 0.27);
    return h;
  }

  /**
   * 0..1 how much of the ground at (x, z) is the hill's own (profile) rather than the neighbouring farmland: all of it in the lane and the
   * pasture, fading out over 40 m beyond their hedges (and over 30 m round the lane) so the hill rolls away into the country round it.
   * `fade` is how far beyond the pasture's south and east hedges it runs: the new farm has no rise beyond them to hold the hill's edge up, so
   * terrainHeight.js asks for a longer one there (#945). Everywhere else, the west most of all where the banks run along z, it stays 40 m (#1172),
   * and the two are blended over 30 m past those hedges, and over 30 m west of the pasture's west hedge, so there is no step (Back Lane's hairpin at its south-west corner is cut into the 40 m ground).
   */
  function weight(x, z, fade = 40) {
    if (inRect(farm, x, z)) return 0;
    const near = weightFor(x, z, 40);
    if (fade === 40) return near;
    const far = weightFor(x, z, fade);
    const long = Math.max(smoothstep(0, 30, z - pasture.maxZ), smoothstep(0, 30, x - pasture.maxX)) * smoothstep(pasture.minX - 30, pasture.minX, x);
    return near + (far - near) * long;
  }

  function weightFor(x, z, fade) {
    let w = Math.max(1 - smoothstep(0, fade, outside(pasture, x, z)), 1 - smoothstep(0, fade * 0.75, outside(laneRect, x, z)));
    if (pad) w = Math.max(w, 1 - smoothstep(0, fade, outside(west, x, z)), 1 - smoothstep(0, fade, outside(east, x, z)));
    return w;
  }

  /** 0..1 how much water stands at (x, z): the stream, its edges where the channel is cut deeper than the water stands. */
  function waterAt(x, z) {
    let w = 0;
    if (x >= (westEnd ? Math.min(westEnd.minX, pasture.minX) : pasture.minX) - 2 && x <= pasture.maxX + 2) {
      const cut = channelAt(x, z);
      const water = waterDepthAt(x);
      const dry = depthAt(x) - water; // the cut above the water's surface
      w = clamp((cut - dry) / (water * 0.5), 0, 1);
    }
    if (pond) {
      const dry = pond.depth - pond.water;
      w = Math.max(w, clamp((pondCut(x, z) - dry) / (pond.water * 0.5), 0, 1));
    }
    return w;
  }

  /** 0..1 mud on the ford's approaches: churned by every quad and tractor that's crossed it. */
  function mudAt(x, z) {
    return Math.max(laneMud(x, z), paddockMud(x, z));
  }

  /** Mud in the two fields: the pond's shore, the track in to it, and a worn patch each side of the gateways in the lane's hedges. */
  function paddockMud(x, z) {
    if (!pad) return 0;
    let m = 0;
    if (pond) m = 0.8 * (1 - smoothstep(1, 1.3, pondR(x, z)));
    if (pad.west.track) m = Math.max(m, 0.75 * (1 - smoothstep(0.9, 2.2, lineDistance(pad.west.track, x, z))));
    for (const g of gates) {
      const out = (x - lane.x) * g.side;
      if (out > 0) m = Math.max(m, 0.6 * (1 - smoothstep(1.5, 6, Math.hypot(out - lane.hedgeOff, z - g.z))));
    }
    return m;
  }

  function laneMud(x, z) {
    const onLane = 1 - smoothstep(lane.halfWidth, lane.halfWidth + 3, Math.abs(x - lane.x));
    if (onLane <= 0) return 0;
    const fromWater = Math.abs(z - streamZ(x)) - halfAt(x) * 0.6;
    return 0.8 * onLane * (1 - smoothstep(0.5, 6, fromWater));
  }

  const inPasture = (x, z, margin = 0) => within(pasture, x, z, margin);
  const inLane = (x, z, margin = 0) => inRect(laneRect, x, z, margin);
  const inWest = (x, z, margin = 0) => !!west && within(west, x, z, margin);
  const inEast = (x, z, margin = 0) => !!east && within(east, x, z, margin);
  const inPaddock = (x, z, margin = 0) => inWest(x, z, margin) || inEast(x, z, margin);
  const inWood = (x, z, margin = 0) => inRect(hill.wood, x, z, margin);

  /** Within the hut's clearing, where nothing grows and no sheep stand. */
  const nearHut = (x, z, margin = hill.hut?.clear ?? 0) => !!hill.hut && Math.hypot(x - hill.hut.x, z - hill.hut.z) < margin;

  /** The climb's slope up the hill at (x, z), rise over run along z: the banks' steepness, without the rough. */
  const climbSlope = (x, z) => Math.abs(climb(x, z + 0.5) - climb(x, z - 0.5));

  /**
   * The sheep field's ground as stepped terraces: 0 on the tread north of the first bank and 1 on the long one at the bottom, a smoothstep
   * up through each bank in between (so each is a steady slope with a flat tread above it).
   */
  const stairs = (z) => {
    let f = 0;
    for (const c of terraces.banks) f += smoothstep(c - terraces.width / 2, c + terraces.width / 2, z) / terraces.banks.length;
    return f;
  };
  /** 0..1 how much of the terraces stand at x: none over the lane's gateway ramp, and none in the last few metres before the east hedge. */
  const terraceReach = (x) => {
    const from = laneRect.maxX + pad.ramp;
    return smoothstep(from, from + terraces.ease, x) * (1 - smoothstep(east.maxX - 6, east.maxX, x));
  };
  /** The metres the terraces fall in all, down to where the field meets the pasture at its south edge: the valley side's own fall there. */
  const terraceFall = (x) => -land(x, east.maxZ);
  /**
   * Metres the terraces change the sheep field's ground at (x, z) from the valley side's smooth fall: the steps stand in place of it, ending at
   * the pasture's edge exactly where it was, so nothing outside the field moves.
   */
  const terraceLift = (x, z) => {
    if (!terraces || z <= east.minZ || z >= east.maxZ) return 0;
    const k = terraceReach(x);
    return k > 0 ? k * (-terraceFall(x) * stairs(z) - land(x, z)) : 0;
  };
  /** The terraces' slope at (x, z), rise over run along z: the banks' steepness without the rough, 0 on a tread. */
  const terraceSlope = (x, z) => {
    if (!terraces || !inEast(x, z)) return 0;
    return terraceReach(x) * terraceFall(x) * Math.abs(stairs(z + 0.5) - stairs(z - 0.5));
  };

  // Patches a few tens of metres across, for where the bracken and the gorse grow.
  const patch = (x, z, k) => 0.5 + 0.25 * Math.sin(x * 0.071 + z * 0.047 + k) + 0.25 * Math.sin(z * 0.113 - x * 0.043 + 1.3 * k);

  /** 0..1 how thick bracken grows at (x, z): in patches over the rough, not in the wood, the lane, the stream or by the ford. */
  function brackenAt(x, z) {
    if (!inPasture(x, z, 1.5) || inWood(x, z, -2) || nearHut(x, z)) return 0;
    if (z < farEdge(x) + hill.foot) return 0;
    return smoothstep(0.58, 0.72, patch(x, z, 0.4));
  }

  /** 0..1 how thick gorse grows at (x, z): in clumps on the steep banks, where nobody's mowed or grazed it, and on the patchy tops. */
  function gorseAt(x, z) {
    if (!inPasture(x, z, 2) || inWood(x, z, -3) || nearHut(x, z)) return 0;
    if (z < farEdge(x) + hill.foot) return 0;
    const steep = smoothstep(0.3, 0.55, climbSlope(x, z));
    return steep * smoothstep(0.42, 0.6, patch(x * 1.7, z * 1.7, 2.1));
  }

  /**
   * Whether a sheep may stand at (x, z) in the sheep field: inside it, on its big side south of the drystone wall (they would walk through the
   * wall, which is only a collider), clear of the thorn bushes and the lane's bank, and off the ground the gateway ramp is cut into.
   */
  function sheepFieldOk(x, z) {
    if (!east || !inEast(x, z, 3)) return false;
    const w = pad.east.wall;
    if (w && z < w.z + 2.5) return false;
    for (const [tx, tz] of pad.east.thorns) if (Math.hypot(x - tx, z - tz) < 2) return false;
    return x > laneRect.maxX + 5;
  }

  /** Up the hill past its foot (a few metres beyond the stream), where the girls won't take a quad. */
  const pastFoot = (x, z) => inPasture(x, z) && z > farEdge(x) + hill.foot;

  /** Where a girl following you pulls up to wait when you go on up the hill: just through the ford, off the lane's line. */
  const waitSpot = { x: lane.x + 3, z: farEdge(lane.x) + 2.5 };

  const setRise = (metres) => {
    rise = Math.max(0, metres);
  };
  /** How far (x, z) is from a field: its outline's distance when it has one, else the rectangle's. */
  const outsideField = (r, x, z) => (r.points ? outsidePolygon(r.points, x, z, r.edges) : outside(r, x, z));
  const outsideHill = (x, z) => Math.min(outsideField(pasture, x, z), outside(laneRect, x, z), west ? outsideField(west, x, z) : Infinity, east ? outsideField(east, x, z) : Infinity, riverside ? outside(riverside, x, z) : Infinity);
  return {
    lane, pasture, stream, laneRect, west, east, riverside, gates, pond, terraces, top, total, waitSpot,
    streamZ, halfAt, depthAt, waterDepthAt, farEdge, westCut, climb, climbSlope, sinkAt, channelAt, profile, weight,
    setRise, get rise() { return rise; },
    waterAt, mudAt, sheepFieldOk, pondCut, terraceLift, terraceSlope, lineDistance, brackenAt, gorseAt, inPasture, nearHut, inLane, inWest, inEast, inPaddock, inWood, pastFoot, outside: outsideHill,
  };
}
