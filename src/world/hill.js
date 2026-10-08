// The hill through the south gate (layout.hill): the sunk green lane, the stream and its ford, and the rough pasture climbing in banks
// beyond. Pure: the shape of the ground, where the water is, and where things are, used by the terrain, the fields, the props and the girls.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const inRect = (r, x, z, margin = 0) => x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin;
const outside = (r, x, z) => Math.hypot(Math.max(r.minX - x, 0, x - r.maxX), Math.max(r.minZ - z, 0, z - r.maxZ));

/** Null when the layout has no hill. */
export function createHill(layout) {
  const hill = layout.hill;
  if (!hill) return null;
  const { lane, pasture, stream, banks } = hill;
  const ford = stream.ford;
  const farm = layout.farm ?? { minX: -layout.fieldHalf, maxX: layout.fieldHalf, minZ: -layout.fieldHalf, maxZ: layout.fieldHalf };
  const top = layout.fieldHalf; // the grass field's south hedge, where the gate is
  const laneRect = { minX: lane.x - lane.hedgeOff, maxX: lane.x + lane.hedgeOff, minZ: top, maxZ: lane.toZ };

  /** The stream's middle line at x. */
  const streamZ = (x) => stream.z + stream.wander * Math.sin(x * 0.05 + 1.1);
  /** 1 at the ford (where the lane crosses), 0 along the rest of the stream. */
  const fordK = (x) => 1 - smoothstep(lane.halfWidth + 1, lane.halfWidth + ford.reach, Math.abs(x - lane.x));
  const halfAt = (x) => stream.halfWidth + (ford.halfWidth - stream.halfWidth) * fordK(x);
  const depthAt = (x) => stream.depth + (ford.depth - stream.depth) * fordK(x);
  /** How deep the water stands in the channel at x: shallower over the ford, in the same proportion as the channel. */
  const waterDepthAt = (x) => (stream.water * depthAt(x)) / stream.depth;
  /** The stream's far (south) edge at x: where the climb starts. */
  const farEdge = (x) => streamZ(x) + halfAt(x);

  // The banks wander a few metres up and down the hill with x, and spread out towards the east end, the gentle way up.
  const shift = (x) => 3 * Math.sin(x * 0.045 + 0.8);
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
    const across = 1 - smoothstep(lane.halfWidth, lane.hedgeOff - 0.3, Math.abs(x - lane.x));
    return across > 0 ? across * Math.max(0, land(x, z) - bedAt(z)) : 0;
  }

  /** Metres the stream's channel is cut into the ground at (x, z). */
  function channelAt(x, z) {
    const r = Math.abs(z - streamZ(x));
    const half = halfAt(x);
    if (r > half + 1.2) return 0;
    return depthAt(x) * (1 - smoothstep(half * 0.4, half + 1.2, r));
  }

  /**
   * The hill's ground at (x, z), relative to the farm's gentle rolling (terrainHeight.js adds it to baseHeight): down the valley from the
   * gate to the stream, the lane sunk into it, the stream's channel, then the banks up the pasture with tussocky rough on them.
   */
  function profile(x, z) {
    let h = land(x, z) + climb(x, z);
    h -= sinkAt(x, z);
    h -= channelAt(x, z);
    // Tussocks and old anthills: rough ground, kept off the lane and out of the stream.
    const rough = inPasture(x, z) ? smoothstep(1, 4, Math.abs(z - streamZ(x)) - halfAt(x)) : 0;
    if (rough > 0) h += rough * 0.09 * Math.sin(x * 0.93 + z * 0.31) * Math.sin(z * 0.81 - x * 0.27);
    return h;
  }

  /**
   * 0..1 how much of the ground at (x, z) is the hill's own (profile) rather than the neighbouring farmland: all of it in the lane and the
   * pasture, fading out over 40 m beyond their hedges (and over 30 m round the lane) so the hill rolls away into the country round it.
   */
  function weight(x, z) {
    if (inRect(farm, x, z)) return 0;
    return Math.max(1 - smoothstep(0, 40, outside(pasture, x, z)), 1 - smoothstep(0, 30, outside(laneRect, x, z)));
  }

  /** 0..1 how much water stands at (x, z): the stream, its edges where the channel is cut deeper than the water stands. */
  function waterAt(x, z) {
    if (x < pasture.minX - 2 || x > pasture.maxX + 2) return 0;
    const cut = channelAt(x, z);
    const water = waterDepthAt(x);
    const dry = depthAt(x) - water; // the cut above the water's surface
    return clamp((cut - dry) / (water * 0.5), 0, 1);
  }

  /** 0..1 mud on the ford's approaches: churned by every quad and tractor that's crossed it. */
  function mudAt(x, z) {
    const onLane = 1 - smoothstep(lane.halfWidth, lane.halfWidth + 3, Math.abs(x - lane.x));
    if (onLane <= 0) return 0;
    const fromWater = Math.abs(z - streamZ(x)) - halfAt(x) * 0.6;
    return 0.8 * onLane * (1 - smoothstep(0.5, 6, fromWater));
  }

  const inPasture = (x, z, margin = 0) => inRect(pasture, x, z, margin);
  const inLane = (x, z, margin = 0) => inRect(laneRect, x, z, margin);
  const inWood = (x, z, margin = 0) => inRect(hill.wood, x, z, margin);

  /** The climb's slope up the hill at (x, z), rise over run along z: the banks' steepness, without the rough. */
  const climbSlope = (x, z) => Math.abs(climb(x, z + 0.5) - climb(x, z - 0.5));

  // Patches a few tens of metres across, for where the bracken and the gorse grow.
  const patch = (x, z, k) => 0.5 + 0.25 * Math.sin(x * 0.071 + z * 0.047 + k) + 0.25 * Math.sin(z * 0.113 - x * 0.043 + 1.3 * k);

  /** 0..1 how thick bracken grows at (x, z): in patches over the rough, not in the wood, the lane, the stream or by the ford. */
  function brackenAt(x, z) {
    if (!inPasture(x, z, 1.5) || inWood(x, z, -2)) return 0;
    if (z < farEdge(x) + hill.foot) return 0;
    return smoothstep(0.58, 0.72, patch(x, z, 0.4));
  }

  /** 0..1 how thick gorse grows at (x, z): in clumps on the steep banks, where nobody's mowed or grazed it, and on the patchy tops. */
  function gorseAt(x, z) {
    if (!inPasture(x, z, 2) || inWood(x, z, -3)) return 0;
    if (z < farEdge(x) + hill.foot) return 0;
    const steep = smoothstep(0.3, 0.55, climbSlope(x, z));
    return steep * smoothstep(0.42, 0.6, patch(x * 1.7, z * 1.7, 2.1));
  }

  /** Up the hill past its foot (a few metres beyond the stream), where the girls won't take a quad. */
  const pastFoot = (x, z) => inPasture(x, z) && z > farEdge(x) + hill.foot;

  /** Where a girl following you pulls up to wait when you go on up the hill: just through the ford, off the lane's line. */
  const waitSpot = { x: lane.x + 3, z: farEdge(lane.x) + 2.5 };

  const outsideHill = (x, z) => Math.min(outside(pasture, x, z), outside(laneRect, x, z));
  return {
    lane, pasture, stream, laneRect, top, total, waitSpot,
    streamZ, halfAt, depthAt, waterDepthAt, farEdge, climb, climbSlope, sinkAt, channelAt, profile, weight,
    waterAt, mudAt, brackenAt, gorseAt, inPasture, inLane, inWood, pastFoot, outside: outsideHill,
  };
}
