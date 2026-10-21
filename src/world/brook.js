// The brook (layout.hill.brook): the hill pasture's stream carried on east, out under the pasture's east hedge and across the open country to
// the neighbour's, where it runs past the south of her yard and goes under the public lane in a culvert, then wanders on to a spring in the
// field beyond. The water flows west, downhill: the land rises all the way from the pasture's bottom (about -2 m) to the lane (about 6 m).
// Pure: its line, how deep it is cut, where the water stands and where the culvert is, for the terrain, the water's drawing, the map and
// how wet a quad gets.

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const smoothstep = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Null when the layout has no brook (or no hill for it to leave). */
export function createBrook(layout) {
  const b = layout.hill?.brook;
  const hill = layout.hill;
  if (!b || !hill) return null;
  const lane = layout.publicLane;
  // It starts exactly where the pasture's stream is at the hedge, so the two join with no step.
  const startX = hill.pasture.maxX;
  const startZ = hill.stream.z + hill.stream.wander * Math.sin(startX * 0.05 + 1.1);
  const pts = [[startX, startZ], ...b.points];
  const minX = startX;
  const maxX = pts[pts.length - 1][0];
  const half0 = b.halfWidth ?? hill.stream.halfWidth;
  const depth0 = b.depth ?? hill.stream.depth;
  const water0 = b.water ?? hill.stream.water;

  /** The brook's middle line at x: smooth steps between its waypoints, with a little wander of its own once it is away from the hedge. */
  function zAt(x) {
    const xc = clamp(x, minX, maxX);
    let i = 0;
    while (i < pts.length - 2 && xc > pts[i + 1][0]) i++;
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const t = smoothstep(x0, x1, xc);
    return z0 + (z1 - z0) * t + b.wander * Math.sin(xc * 0.11 + 0.7) * smoothstep(minX, minX + 25, xc);
  }

  // Where it goes under the lane: no channel across the tarmac and its verges (`culvert.half` either side of the lane's middle), so the road is
  // as level as it was, and the channel deepens back to full over `culvert.ease` m either side.
  const culvert = lane ? { x: lane.x, half: lane.halfWidth + 2.2, ease: 4 } : null;
  const sourceReach = b.source ?? 16; // m before its end it shallows out to a spring

  /** 0..1 how much of its full depth the channel has at x. */
  function fullness(x) {
    if (x < minX || x > maxX) return 0;
    let k = 1 - smoothstep(maxX - sourceReach, maxX, x);
    if (culvert) k *= smoothstep(0, culvert.ease, Math.abs(x - culvert.x) - culvert.half);
    return k;
  }
  const depthAt = (x) => depth0 * fullness(x);
  const halfAt = (x) => half0 * (0.55 + 0.45 * fullness(x));
  /** How deep the water stands in the channel at x (before any rise after rain). */
  const waterDepthAt = (x) => water0 * fullness(x);

  /** Metres the channel is cut into the ground at (x, z). */
  function cutAt(x, z) {
    if (x < minX || x > maxX) return 0;
    const half = halfAt(x);
    const r = Math.abs(z - zAt(x));
    if (r > half + 1.2) return 0;
    return depthAt(x) * (1 - smoothstep(half * 0.4, half + 1.2, r));
  }

  /** 0..1 how much water stands at (x, z): the channel where it is cut deeper than the water stands. */
  function waterAt(x, z) {
    const wd = waterDepthAt(x);
    if (wd < 0.03) return 0;
    const dry = depthAt(x) - wd;
    return clamp((cutAt(x, z) - dry) / (wd * 0.5), 0, 1);
  }

  /** The two mouths of the culvert (west, east): where the water goes in and comes out, facing along x. */
  const mouths = culvert
    ? [-1, 1].map((side) => {
        const x = culvert.x + side * culvert.half;
        return { x, z: zAt(x), side };
      })
    : [];

  /** Points along the line every `step` m, for the map and the water. */
  function line(step = 2) {
    const out = [];
    for (let x = minX; x <= maxX + 1e-6; x += step) out.push({ x, z: zAt(x), half: halfAt(x) });
    return out;
  }

  return { minX, maxX, zAt, depthAt, halfAt, waterDepthAt, cutAt, waterAt, fullness, culvert, mouths, line, half: half0, depth: depth0, water: water0 };
}
