// The brook (layout.hill.brook): the hill pasture's stream carried on east, out under the pasture's east hedge and across the open country to
// the neighbour's, where it runs past the south of her yard and goes under the public lane in a culvert, then wanders on to a spring in the
// field beyond. On today's farm the water flows west, downhill: the land rises all the way from the pasture's bottom (about -2 m) to the lane
// (about 6 m). On the new farm (#565) the land falls east, so the river runs east with it, in bends (`river.bends`), a width that varies
// (`river.vary`), a surface that only ever falls (`useGround`) and drinking places (`river.drinks`), to the lane, which crosses it on the village's
// bridge (`brook.bridge`, brookProps.js: the culvert's span, no channel across the tarmac), and on east past the north of the village (#688) to a spring.
// Pure: its line, how deep it is cut, where the water stands and where the culvert is, for the terrain, the water's drawing, the map and
// how wet a quad gets.
//
// Its western reach, just beyond the pasture's hedge, is the river (`layout.hill.river`): the brook widened and deepened (a ramp up from the
// hedge, full for a while, a ramp back down) with a shallow crossing across it. It is the same channel, so it still runs on east to the
// culvert and the spring, and never meets the edge of the map.

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
  const river = hill.river ?? null;
  const cross = river?.crossing ?? null;

  /** 0..1 how much of the river it is at x: widening from `fromX`, full, then narrowing back to the brook by `toX`. */
  const riverK = (x) => (river ? smoothstep(river.fromX, river.fromX + river.rampIn, x) * (1 - smoothstep(river.toX - river.rampOut, river.toX, x)) : 0);
  /** 0..1 how much of the crossing it is at x: the raised bed, with a short ramp down to the deep either side. */
  const crossK = (x) => (cross ? riverK(x) * (1 - smoothstep(cross.half, cross.half + cross.ramp, Math.abs(x - cross.x))) : 0);
  const mix = (a, c, k) => a + (c - a) * k;
  const bends = river?.bends ?? null;
  const vary = river?.vary ?? null;
  // The banks shaped from the bends (#999, the new farm's `river.banks`): the full river is cut `deepen` m deeper so the water stands `freeboard` m under
  // the field, with a steep wall on the outside of each bend and a gravel bar built up on the inside. Today's farm has none and is as it was.
  const banks = river?.banks ?? null;
  const deepen = banks ? Math.max(0, banks.freeboard - (river.depth - river.water)) : 0;
  const brookBanks = banks?.brook ?? null;

  /** The brook's middle line at x: smooth steps between its waypoints, with a little wander of its own once it is away from the hedge. */
  function zAt(x) {
    const xc = clamp(x, minX, maxX);
    let i = 0;
    while (i < pts.length - 2 && xc > pts[i + 1][0]) i++;
    const [x0, z0] = pts[i];
    const [x1, z1] = pts[i + 1];
    const t = smoothstep(x0, x1, xc);
    const sway = bends ? bends.amp * Math.sin(xc * bends.k + bends.phase) * riverK(xc) : 0;
    return z0 + (z1 - z0) * t + b.wander * Math.sin(xc * 0.11 + 0.7) * smoothstep(minX, minX + 25, xc) + sway;
  }

  // Where it goes under the lane: no channel across the tarmac and its verges (`culvert.half` either side of the lane's middle), so the road is
  // as level as it was, and the channel deepens back to full over `culvert.ease` m either side.
  const culvert = lane && !b.noCulvert ? { x: lane.x, half: lane.halfWidth + 2.2, ease: 4 } : null;
  const sourceReach = b.source ?? 16; // m before its end it shallows out to a spring

  /** 0..1 how much of its full depth the channel has at x. */
  function fullness(x) {
    if (x < minX || x > maxX) return 0;
    let k = sourceReach > 0 ? 1 - smoothstep(maxX - sourceReach, maxX, x) : 1;
    if (culvert) k *= smoothstep(0, culvert.ease, Math.abs(x - culvert.x) - culvert.half);
    return k;
  }
  // The river keeps the surface where it was and deepens the bed under it; the crossing raises the bed again until `cross.water` m stand over it.
  const riverDepth = (x) => mix(depth0, river.depth + deepen, riverK(x));
  const riverWater = (x) => mix(water0, river.water, riverK(x));
  const baseDepthAt = (x) => {
    if (!river) return depth0 * fullness(x);
    const d = riverDepth(x);
    return (cross ? mix(d, d - riverWater(x) + cross.water, crossK(x)) : d) * fullness(x);
  };
  // Where the land rises downstream the water would run uphill (the surface is the ground at its middle less the cut plus the water standing). With
  // the ground along the line (`useGround`, from terrainHeight.js) on a river that runs east (`river.eastward`, the new farm's) the channel is cut that much deeper there, so its surface only ever falls (#565).
  let ground = null;
  let lower = null;
  const surfaceAt = (x) => ground(x) - baseDepthAt(x) + waterDepthAt(x);
  function lowerAt(x) {
    if (!ground || x <= minX + 1 || x >= maxX) return 0;
    if (!lower) {
      // From a metre past the pasture's hedge: at `minX` the ground still has the stream's own channel in it (hill.js).
      lower = [];
      let low = Infinity;
      for (let xx = minX + 1; xx <= maxX; xx++) {
        const s = surfaceAt(xx);
        low = Math.min(low, s);
        lower.push(s - low);
      }
    }
    const f = x - (minX + 1);
    const i = Math.min(lower.length - 2, Math.floor(f));
    return lower[i] + (lower[i + 1] - lower[i]) * (f - i);
  }
  const depthAt = (x) => baseDepthAt(x) + lowerAt(x);
  const halfAt = (x) => (half0 * (0.55 + 0.45 * fullness(x))) * (river ? mix(1, river.halfWidth / half0, riverK(x)) : 1) * (vary ? 1 + vary.amount * Math.sin(x * vary.k + vary.phase) * riverK(x) : 1);
  /** How deep the water stands in the channel at x (before any rise after rain). */
  const waterDepthAt = (x) => (river ? (cross ? mix(riverWater(x), cross.water, crossK(x)) : riverWater(x)) : water0) * fullness(x);

  /**
   * The bend at x (#999): `out` the side its outside is on (-1 north, 1 south: the line bulges that way, `sway` is a sine), and `s` 0..1 how much of a
   * bend it is, none in the straight between two bends, on the river's ramps or by the crossing, whose banks are its landings.
   */
  function bendAt(x) {
    if (!banks || !bends) return { out: 1, s: 0 };
    const sn = Math.sin(x * bends.k + bends.phase);
    const clear = cross ? smoothstep(cross.half + cross.ramp, cross.half + cross.ramp + 4, Math.abs(x - cross.x)) : 1;
    return { out: sn < 0 ? -1 : 1, s: smoothstep(banks.from, banks.full, Math.abs(sn)) * Math.min(1, riverK(x) / 0.6) * clear }; // a bend on the ramps is full once the river is
  }

  /** Every bend of the river where it is the river (at least half its width): its apex's x and middle, and the side its outside is on. */
  function bends_() {
    if (!banks || !bends) return [];
    const out = [];
    for (let n = -20; n <= 20; n++) {
      const x = (Math.PI / 2 + n * Math.PI - bends.phase) / bends.k;
      if (x <= minX || x >= maxX || riverK(x) < 0.5) continue;
      out.push({ x, z: zAt(x), out: bendAt(x).out });
    }
    return out;
  }

  /**
   * 0..1 how much the bank at (x, z) is trodden or cut down to a ramp: the crossing's landings on both banks, and each drinking place on its own side. In it
   * the ground slopes from just above the water at the edge up to the field `reach` m back (`banks.landing`, `banks.drink`).
   */
  function notchAt(x, z) {
    if (!banks) return { k: 0, reach: 1 };
    let k = 0;
    let reach = banks.drink;
    if (cross) {
      const across = 1 - smoothstep(cross.half - 0.5, cross.half + 2, Math.abs(x - cross.x));
      if (across > k) { k = across; reach = banks.landing; }
    }
    for (const d of drinks) {
      if ((z - zAt(x)) * d.side < 0) continue;
      const kd = 1 - smoothstep(1.5, 4, Math.abs(x - d.x));
      if (kd > k) { k = kd; reach = banks.drink; }
    }
    return { k, reach };
  }

  /** Metres the channel is cut into the ground at (x, z). */
  function cutAt(x, z) {
    if (x <= minX || x > maxX) return 0; // at `minX` itself it is still the pasture's stream cut (hill.js), or the two cut there and leave a pit
    const half = halfAt(x);
    const dz = z - zAt(x);
    const r = Math.abs(dz);
    if (!banks || (riverK(x) <= 0 && x > (brookBanks?.to ?? -Infinity))) {
      if (r > half + 1.2) return 0;
      return depthAt(x) * (1 - smoothstep(half * 0.4, half + 1.2, r));
    }
    if (r > half + Math.max(banks.landing, banks.bar.reach) + 1) return 0;
    const d = depthAt(x);
    const dry = d - waterDepthAt(x); // the cut at which the water's surface stands
    const k = riverK(x);
    // Banks either side: the river's (`banks.wall` m from the bed's edge to the field) and, past the meadow, the brook's own steep little banks.
    // The brook's wall stands a little further out than the river's, so its water is as wide as it was (#999 only steepens the bank above it).
    const wall = mix(brookBanks?.wall ?? 1.6, banks.wall, k);
    const inner = mix(0.45, 0.75, k);
    let cut = d * (1 - smoothstep(half - wall * inner, half + wall * (1 - inner), r));
    const { out, s } = bendAt(x);
    if (s > 0) {
      const u = dz * out; // + towards the bend's outside
      if (u > 0) cut = mix(cut, d * (1 - smoothstep(half - banks.cut, half + 0.2, r)), s); // the cut bank: a steeper wall
      else {
        // The point bar: the bed shelves up from the deep to just under the water at `bar.from` of the half-width, comes out of it as gravel and runs
        // gently on up to the field `bar.reach` m beyond the edge.
        const a = half * 0.3;
        const bFrom = half * banks.bar.from;
        const c = half + banks.bar.reach;
        const shelf = dry + 0.06;
        const bar = r <= a ? d : r <= bFrom ? mix(d, shelf, smoothstep(a, bFrom, r)) : r >= c ? 0 : shelf * (1 - ((r - bFrom) / (c - bFrom)) ** 1.6); // flat by the water, steeper to the field
        cut = mix(cut, bar, s);
      }
    }
    // The crossing's landings and the drinking places: the bank sloped from just above the water at the edge to the field `reach` m back.
    const notch = notchAt(x, z);
    // The ramp runs on a metre into the water, 0.1 m under it there, and the bed shelves on down from it at 1 in 2, so it is one slope through the edge.
    if (notch.k > 0) {
      const ramp = (dry + 0.1) * clamp(1 - (r - (half - 1)) / (notch.reach + 1), 0, 1);
      const shelf = r < half - 1 ? Math.min(cut, dry + 0.1 + (half - 1 - r) * 0.5) : 0;
      cut = mix(cut, Math.max(ramp, shelf), notch.k);
    }
    // Its first 4 m past the pasture's hedge keep the stream's own gentle profile, so there is no step at the seam where hill.js's cut ends.
    const seam = smoothstep(minX, minX + 4, x);
    if (seam < 1) cut = mix(r > half + 1.2 ? 0 : d * (1 - smoothstep(half * 0.4, half + 1.2, r)), cut, seam);
    return Math.max(0, cut);
  }

  /** 0..1 how much of a gravel bar (x, z) is on: the shelf on the inside of a bend, out of the water and up the slope, for the ground's paint. */
  function barAt(x, z) {
    const { out, s } = bendAt(x);
    if (s <= 0.05) return 0;
    const half = halfAt(x);
    const u = -(z - zAt(x)) * out - half * banks.bar.from;
    if (u < -0.5) return 0;
    return s * (1 - smoothstep(half * (1 - banks.bar.from) + banks.bar.reach * 0.5, half * (1 - banks.bar.from) + banks.bar.reach, u));
  }

  /**
   * Metres of low hummocks on the banks at (x, z) (#999): a few centimetres of rise and hollow from a metre and a half off the water out to a dozen metres,
   * so the field by the river is not a lawn. On the river and on the brook past the meadow (`banks.brook.to` its east end), nowhere else.
   */
  function reliefAt(x, z) {
    if (!banks || x <= minX + 2 || x > maxX) return 0;
    const k = Math.max(riverK(x), brookBanks ? 1 - smoothstep(brookBanks.to - 6, brookBanks.to, x) : 0);
    if (k <= 0) return 0;
    const half = halfAt(x);
    const r = Math.abs(z - zAt(x));
    const band = smoothstep(half + 1.2, half + 3, r) * (1 - smoothstep(half + 9, half + 14, r));
    if (band <= 0) return 0;
    const n = 0.55 * Math.sin(x * 0.93 + z * 0.41) + 0.45 * Math.sin(x * 0.37 - z * 1.13 + 1.3) + 0.35 * Math.sin(x * 1.71 + z * 0.77 + 4.2);
    return banks.relief * k * band * (1 - notchAt(x, z).k) * n / 1.35;
  }

  /** 0..1 how much water stands at (x, z): the channel where it is cut deeper than the water stands. */
  function waterAt(x, z) {
    const wd = waterDepthAt(x);
    if (wd < 0.03) return 0;
    const dry = depthAt(x) - wd;
    const d = cutAt(x, z) - dry;
    const w = clamp(d / (wd * 0.5), 0, 1);
    // In the river only deep water counts as deep: over the crossing it is a wade (under the engine's gulp threshold), in the deep it drowns.
    const k = riverK(x);
    return k > 0 ? w * mix(1, clamp((d - 0.05) / river.deepFrom, 0, 1), k) : w;
  }

  /** 0..1 how much of the river's deep water is at (x, z): only the river's own, and not over the crossing's shallows. */
  function deepAt(x, z) {
    const k = riverK(x);
    return k > 0.3 ? clamp((waterAt(x, z) - 0.8) / 0.2, 0, 1) : 0;
  }

  /**
   * 0..1 how much the ground at (x, z) is levelled across the river to the ground at its middle, so a wide river has level banks and the
   * water sits in them (terrainHeight.js blends the ground at its middle across the valley).
   */
  function levelK(x, z) {
    const k = riverK(x);
    if (k <= 0) return 0;
    const r = Math.abs(z - zAt(x));
    if (!banks) return k * (1 - smoothstep(halfAt(x) + 1, halfAt(x) + (river.level ?? 7), r));
    // With shaped banks (#999) only the water's edge is held level, and the land comes back to its own lie over a reach that changes along the river
    // (between 60% and all of `river.level`), so the field beside it rolls instead of lying in a plane.
    const reach = (river.level ?? 7) * (0.6 + 0.2 * (1 + Math.sin(x * 0.083 + 2.1)));
    return k * (1 - smoothstep(halfAt(x) + 0.3, halfAt(x) + reach, r));
  }

  /** The poached drinking places (`river.drinks`: [x, side], side -1 north and 1 south): where the cattle come down to the water, a trodden patch of mud; and `river.worn` ([x, z, r]) the gateways'. */
  const drinks = (river?.drinks ?? []).map(([x, side]) => ({ x, side }));
  function drinkMud(x, z) {
    let m = 0;
    for (const d of drinks) {
      if (Math.abs(x - d.x) > 7) continue;
      const out = (z - zAt(d.x)) * d.side - halfAt(d.x);
      if (out < -0.8 || out > 5) continue;
      m = Math.max(m, 0.8 * (1 - smoothstep(2.5, 6.5, Math.hypot(x - d.x, out - 0.8))));
    }
    for (const [wx, wz, wr] of river?.worn ?? []) m = Math.max(m, 0.7 * (1 - smoothstep(wr * 0.4, wr, Math.hypot(x - wx, z - wz)))); // the trodden ground at the gateways
    return m;
  }

  /** 0..1 how muddy the ground is at (x, z): the worn landing where the tyres come down to the crossing, on each bank, and the cattle's drinking places. */
  function mudAt(x, z) {
    if (!cross) return 0;
    const drink = drinkMud(x, z);
    const across = clamp(1 - (Math.abs(x - cross.x) - cross.half) / 1.5, 0, 1);
    if (across <= 0) return drink;
    const out = Math.abs(z - zAt(x)) - halfAt(x);
    // With shaped banks the landing is the whole ramp down to the water (`banks.landing` m), muddiest at its foot.
    const reach = banks ? banks.landing : 3.5;
    return Math.max(drink, out < -0.5 || out > reach ? 0 : clamp(1 - Math.abs(out - 1.2) / (reach - 1.1), 0, 1) * across);
  }

  /** The two mouths of the culvert (west, east): where the water goes in and comes out, facing along x. */
  const mouths = culvert
    ? [-1, 1].map((side) => {
        const x = culvert.x + side * culvert.half;
        return { x, z: zAt(x), side };
      })
    : [];

  /**
   * The crossing's one anchor (#999): its x is `layout.hill.river.crossing.x` and nothing else, its middle on the river's line, and `landing(side, out)` a
   * point `out` m beyond the water's edge on the north (-1) or south (1) bank. The posts, the gravel, the ruts, the map's label, `tp me to river` and the
   * frame budget's spot all stand from it. Null with no crossing.
   */
  let anchor;
  function crossing() {
    if (!cross) return null;
    if (anchor) return anchor; // worked out once: the sound asks for it every frame
    const z = zAt(cross.x);
    const half = halfAt(cross.x);
    anchor = { x: cross.x, z, half, reach: cross.half, landing: (side, out = 0) => ({ x: cross.x, z: z + side * (half + out) }) };
    return anchor;
  }

  /** Points along the line every `step` m, for the map and the water. */
  function line(step = 2) {
    const out = [];
    for (let x = minX; x <= maxX + 1e-6; x += step) out.push({ x, z: zAt(x), half: halfAt(x) });
    return out;
  }

  return { minX, maxX, bridge: !!(culvert && b.bridge), zAt, depthAt, halfAt, waterDepthAt, cutAt, waterAt, fullness, culvert, mouths, line, crossing, bends: bends_, bendAt, barAt, reliefAt, notchAt, banks, half: half0, depth: depth0, water: water0, river, riverK, crossK, levelK, mudAt, deepAt, drinks, useGround: (fn) => { ground = river?.eastward ? fn : null; lower = null; } };
}
