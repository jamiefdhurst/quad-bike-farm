// The bust as a written target (#1143), in the body frame figure.js works in: the hips bone at 0, x to her left, y up, z to her
// front, one unit the hips-to-neck length (about 42 cm on Amy, 40 on Jess). Each breast is drawn over an oval on her chest wall:
// an upper slope that leaves her chest flat just under her collarbone and turns round into the fullness, the fullest point at about
// mid upper arm, a full round lower curve that hangs over the fold under it. bustPatch.js replaces her chest round each breast with
// rings drawn on it. Agreed with Jamie by eye over five passes; the issue's comments have each. Pure.

export const BUST_SHAPE = {
  // At bust 1 (Amy). Heights are body-frame y: her collarbone is at about 0.97, her shoulder joint 0.9, mid upper arm about 0.65.
  x: 0.15, // each breast's middle, from hers
  inner: 0.14, // its base's half-width towards her middle: they nearly meet there
  outer: 0.16, // and out towards her arm
  top: 0.94, // where the upper slope starts, just under her collarbone, so it runs down from her chest gently to the fullest point
  // (started 10 cm lower, the slope stood out 7 cm in 3 and met her chest at a hard angle: Jamie, "a hard angle between the bust and
  // the top of the chest"; at 0.93 it still rose sharply out of her chest)
  fold: 0.51, // the fold under it, against her ribs
  middle: 0.735, // the base's middle, between fold and top: the furthest forward point sits a little below it once it hangs
  project: 0.255, // how far it stands out from her chest wall, at its fullest (the wall rounds forward under it, `wallRound`: 0.285
  // on an upright wall stood out as far)
  upper: 1.0, // the upper slope's power: 1 is full and round (Jamie, on the first pass: "slightly rounder on the top"); over 1
  // it leaves her chest gently and goes flat or hollow
  lower: 0.6, // the lower curve's: under 1 it is full and round, turning in sharply at the fold
  side: 0.75, // across, at its sides
  taper: 0.55, // its outline narrows towards the top by this share of its width (a teardrop from the front, too), so the top rises in
  // the middle and keeps out of the crease of her armpit
  blendTop: 0.7, // over most of the upper slope (this share of 1 - r²) it rises from flat out of her chest, so the skin joins her chest
  // with no line (Jamie: "the skin should join fairly seamlessly to the chest"); less round her sides (`blendSide`) and none at the
  // fold, which is a crease
  blendSide: 0.2,
  hang: 0.15, // it hangs: each point moves down this much per unit it stands out
  droop: 0.1, // and its front this much more (times how far out it is, squared, over `project`)
  tuck: 0.16, // and its underside this much of `project` more, most half way out, so the lower curve hangs below the fold and turns
  // back up into it
  spill: 0.08, // its outer side spills sideways this much per unit it stands out, so a big bust is wide from the front without
  // its base climbing under her arm
  // A bigger bust (over 1) is bigger every way: these are the fraction more per unit over 1.
  growWide: 0.75, // across, out towards her arm (towards her middle a third of this: they already nearly meet)
  growSpill: 3.75,
  growTall: 0.2,
  growOut: 1.05, // (0.9 on an upright chest wall: rounded forward under it, Jess's stood 6 mm less far out)
  growLow: 0.06, // and its middle sits this much lower per unit over 1
  maxOut: 0.32, // its outer edge never past this: her side, where her chest turns back to her arm (further, the chest wall here stands
  // in front of her real side and the collar round it folds)
  wallMiddle: 0.24, // her chest wall's z down her middle at the fold's height, under the model's own small bust
  wallSlope: -0.07, // how much further back it is per unit higher (her ribs slope back to her collarbone)
  wallCurve: 1.0, // how it curves back round to her sides at the fold (z drops by this times x squared)
  wallCurveHigh: 0.45, // and at the top of the bust, where her ribcage is rounder under her arms
  wallCurveShoulder: 0.75, // and above it, where her chest falls back into the hollow in front of her shoulder
  wallRound: 1.0, // her ribcage rounding forward from her collarbone (chestWall): above `wallRoundFrom` it falls back by this times
  wallRoundFrom: 0.75, // the square of the height above it, meeting the wall's line at `wallRoundTop`, where her upper chest slopes
  wallRoundTop: 0.94, // forward at about 0.4, as her own does; below it, back to the wall's line by the fold
  wallRoundIn: 0.3, // all of it this far either side of her middle, none from `wallRoundOut`
  wallRoundOut: 0.55,
  wallUnder: 0.45, // below the fold her front draws in to her waist: back this much per unit under `wallUnderFrom`
  wallUnderFrom: 0.48,
};

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** How much narrower the outline is at height v (the oval's own units): none at its middle and below, `taper` at its top. */
const narrow = (v, s) => 1 - s.taper * Math.min(1, Math.max(0, v)) ** 2;

/** Her chest wall's z at body-frame (x, y): the surface the bust stands on, without the model's own bust. */
export function chestWall(x, y, s = BUST_SHAPE) {
  const curve =
    s.wallCurve + (s.wallCurveHigh - s.wallCurve) * smoothstep(s.fold, 0.75, y) + (s.wallCurveShoulder - s.wallCurveHigh) * smoothstep(0.75, 0.9, y);
  const under = Math.max(0, s.wallUnderFrom - y);
  // Her ribcage rounding forward from her collarbone: under it her chest slopes as her own upper chest does, turning upright by the
  // bust's middle, back to the wall's line at the fold. (Upright all the way up, her chest just above the bust was pressed back
  // flat and the bust rose sharply out of a dip there.)
  const above = y - s.wallRoundFrom;
  const most = s.wallRound * (s.wallRoundTop - s.wallRoundFrom) ** 2;
  // Across her front only: towards her sides her chest falls back into the hollow in front of her shoulder, and rounded forward there
  // the bust's edge stood proud of it.
  const across = 1 - smoothstep(s.wallRoundIn, s.wallRoundOut, Math.abs(x));
  const round = across * (above > 0 ? most - s.wallRound * above * above : most * smoothstep(s.fold, s.wallRoundFrom, y));
  return s.wallMiddle + s.wallSlope * (y - s.fold) - curve * x * x - s.wallUnder * under * under * 10 + round;
}

/** The left breast's outline on her chest for a bust size (1 is Amy's): its middle and half-widths, all body-frame. */
export function bustOutline(size = 1, s = BUST_SHAPE) {
  const over = size - 1;
  const wide = 1 + s.growWide * over;
  const tall = 1 + s.growTall * over;
  const low = s.growLow * over;
  const inner = s.inner * (1 + (s.growWide / 3) * over);
  const cx = Math.max(s.x, inner + 0.012); // its inner edge stays just off her middle, so the two never cross
  const outer = Math.min(s.outer * wide, s.maxOut - cx);
  const cy = s.middle - low;
  return {
    cx,
    cy,
    inner,
    outer,
    up: (s.top - s.middle) * tall,
    down: (s.middle - s.fold) * tall + low * 0.5,
    project: s.project * (1 + s.growOut * over),
    spill: s.spill * (1 + s.growSpill * over),
  };
}

/**
 * Where a point of the base oval goes on the breast. `u`, `v`: across (out positive) and up, in the oval's half-widths, so the
 * oval's edge is u² + v² = 1 and the middle 0. Returns body-frame { x, y, z } for the left breast (mirror x for the right), and
 * `h`, how far out from her chest wall it stands, and `xBase`, `yBase`, where on her chest wall it stands. Outside the oval it lies on
 * the wall.
 */
export function bustPoint(u, v, size = 1, s = BUST_SHAPE, o = bustOutline(size, s)) {
  const xBase = o.cx + u * (u > 0 ? o.outer : o.inner) * narrow(v, s);
  const yBase = o.cy + v * (v > 0 ? o.up : o.down);
  const r2 = u * u + v * v;
  let h = 0;
  if (r2 < 1) {
    // The power eases from the lower curve's, round the sides, to the upper slope's, by how far up the oval the point is.
    const r = Math.sqrt(r2) || 1;
    const sin = r2 > 0 ? v / r : 0;
    const around = sin < 0 ? s.side + (s.lower - s.side) * smoothstep(0, 1, -sin) : s.side + (s.upper - s.side) * smoothstep(0, 1, sin);
    // Towards the front the power is the same every way round, or the turn from one to the next left a point at its tip.
    const a = (s.upper + s.lower + 2 * s.side) / 4 + (around - (s.upper + s.lower + 2 * s.side) / 4) * smoothstep(0, 0.6, r);
    const blend = sin > 0 ? s.blendSide + (s.blendTop - s.blendSide) * sin : s.blendSide * (1 + sin);
    // On top the lead-in is the whole smoothstep, flat where it leaves her chest; round her sides its square root, a shorter one.
    const lead = blend > 0 ? smoothstep(0, blend, 1 - r2) ** (0.5 + 0.5 * Math.max(0, sin)) : 1;
    const dome = (1 - r2) ** a * lead;
    // Above, a slope that leaves her chest wall level with it (the wall already slopes forward under her collarbone as her chest does,
    // so the bust carries straight on from her chest) and steepens steadily into the fullness, turning round at the tip. Eased in from
    // her sides.
    const t = 1 - Math.sqrt(r2);
    const slope = t * t * (3 - 2 * t);
    h = o.project * (dome + (slope - dome) * smoothstep(0, 1, Math.max(0, sin)) * smoothstep(0, 0.35, Math.sqrt(r2)));
  }
  const out = h / o.project;
  const under = v < 0 ? smoothstep(0, 0.6, -v) : 0;
  const y = yBase - s.hang * h - s.droop * o.project * out * out - s.tuck * o.project * 4 * out * (1 - out) * under;
  const x = xBase + o.spill * h * smoothstep(0.1, 0.9, u);
  return { x, y, z: chestWall(xBase, yBase, s) + h, h, xBase, yBase };
}

/** The oval coordinates (u, v) of a body-frame point on her left (|x|), and r² = u² + v²: under 1 inside the outline. */
export function bustUV(x, y, o, s = BUST_SHAPE) {
  const across = Math.abs(x) - o.cx;
  const up = y - o.cy;
  const v = up / (up > 0 ? o.up : o.down);
  const u = across / ((across > 0 ? o.outer : o.inner) * narrow(v, s));
  return { u, v, r2: u * u + v * v };
}
