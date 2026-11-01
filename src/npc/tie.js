// The tie worn with a work shirt (SHIRT in polo.js): a narrow four-in-hand knot at the collar with a dimple under it, and a blade
// widening to about 8 cm down her front to the waistband. Far narrower than her triangles, so it is laid on the finished shirt by
// rays, as the crop-top's straps are laid on her: from in front as she stands (her front is +z, her left +x), flat across each
// row so it bridges the dip between her breasts, and falling off her bust rather than following her in under it. The collar is
// laid over it afterwards (collar.js), so its points cover the knot's sides. Loosened, the knot is pulled down below the open
// buttons and its two ends run up from it into the collar either side of the open neck. Pure, on plain data (garmentMesh.js).

import { rayHit, inTriangle, unskin } from './garmentMesh.js';

const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

export const TIE = {
  knotHeight: 0.03,
  knotTop: 0.034, // the knot's width across its top
  knotBottom: 0.02, // and at its bottom, where the blade comes out under it
  knotDepth: 0.014, // how far it stands out at its fullest, near the top
  knotUp: 0.017, // done right up, its top this far above where the shirt meets her neck, up in the collar's stand
  blade: 0.08, // the blade at its widest, just above the point
  tip: 0.035, // the point at its bottom, this long
  toWaist: 0.004, // the point this far above the top of her shorts
  lift: 0.005, // the blade's face off what's under it down its middle, clear of the shirt's buttons as she moves
  edgeLift: 0.003, // and at its edges, so it's a little rounded across
  dimple: 0.028, // the dimple under the knot: this long
  dimpleDepth: 0.0018,
  dimpleShade: 0.7,
  hangSlope: 0.55, // below her bust it falls back towards her no faster than this per metre down
  settle: 0.07, // and over this far above its point it comes back to rest against her at the waistband
  strand: 0.011, // loosened, the width of each end running up into the collar
  wrapShade: 0.72, // the crease where the knot's last turn wraps across it
  knotUnder: 0.78, // the knot's bottom, tucking in, a shade darker
  sideShade: 0.6, // its sides, down to the shirt
  step: 0.003, // rows this far apart
};

/**
 * Builds the tie. `top`: the height where the shirt meets her neck at the middle of her front (the placket's top); `ground`: the
 * meshes it can lie on, as she stands (the shirt, its placket, and in an open neck her skin or the polo under it); `loose` and
 * `drop`: loosened, the knot's top this far below `top`, over the bottom of the open neck `vee` (from buildTop).
 * Returns { verts, tris, shade, knotTop } or null if it found nothing to lie on; verts carry bind, rest, weights, skin and normal
 * from what each lies on.
 */
export function buildTie(body, { top, ground, loose = false, drop = 0.05, vee = null }, p = TIE) {
  const neck = body.bones.Neck;
  const x0 = neck[0];
  const near = (v) => Math.abs(v.rest[0] - x0) < 0.09 && v.rest[2] > neck[2] - 0.02 && v.rest[1] > body.waist - 0.06 && v.rest[1] < top + 0.06;
  const front = { verts: [], tris: [] };
  for (const m of ground) {
    const base = front.verts.length;
    front.verts.push(...m.verts);
    for (const t of m.tris) if (t.some((i) => near(m.verts[i]))) front.tris.push(t.map((i) => i + base));
  }
  // What's under a point, from in front: at the very top or the open neck's edge a ray can just miss, so step down and out a little
  // (done right up, the knot's top corners are above the neckline as it curves down round her neck: only how far out it is matters).
  const hitAt = (x, y) => {
    for (let down = 0; down <= 0.045; down += 0.001) {
      for (let out = 0; out < 0.006; out += 0.001) {
        const h = rayHit(front, [x + 1e-6 + Math.sign(x - x0) * out, y - down, neck[2] + 0.6], [0, 0, -1]);
        if (h) return inTriangle(front, h.tri, h.bary);
      }
    }
    return null;
  };

  const knotTop = loose ? top - drop : top + p.knotUp; // loosened, over the bottom of the open neck
  const knotBottom = knotTop - p.knotHeight;
  const tipEnd = body.waist + p.toWaist;
  if (tipEnd > knotBottom - 0.05) return null;

  const out = { verts: [], tris: [], shade: [] };
  const rowsBetween = (y0, y1) => {
    const n = Math.max(2, Math.ceil((y0 - y1) / p.step));
    return Array.from({ length: n + 1 }, (_, r) => y0 - ((y0 - y1) * r) / n);
  };

  // The blade, starting under the knot so it comes out from behind it.
  const bladeTop = knotTop - p.knotHeight * 0.5;
  const halfBlade = (y) => {
    const t = (bladeTop - y) / (bladeTop - (tipEnd + p.tip));
    const w = p.knotBottom * 0.33 + (p.blade / 2 - p.knotBottom * 0.33) * Math.min(1, t) ** 1.3;
    return y < tipEnd + p.tip ? w * Math.max(0, (y - tipEnd) / p.tip) : w;
  };
  const dimpleOf = (y) => {
    const s = (knotBottom - y) / p.dimple; // 0 just under the knot, 1 at its end
    return s < 0 || s > 1 ? 0 : 1 - smooth01(s);
  };
  const ok = ribbon(out, hitAt, {
    ys: rowsBetween(bladeTop, tipEnd),
    across: (y) => [x0 - halfBlade(y), x0 + halfBlade(y)],
    n: 7,
    raise: (y, u) => p.edgeLift + (p.lift - p.edgeLift) * (1 - u * u) - p.dimpleDepth * dimpleOf(y) * Math.exp(-((u / 0.3) ** 2)),
    shadeAt: (y, u) => 1 - (1 - p.dimpleShade) * dimpleOf(y) * Math.exp(-((u / 0.3) ** 2)),
    hang: p.hangSlope,
    settle: { below: tipEnd + p.settle, over: p.settle },
    side: p.sideShade,
  });
  if (!ok) return null;

  // The knot: an upturned trapezoid, fullest near its top and tucking in at its bottom, with the crease of its last turn wrapped
  // across it from her right at the top to her left lower down.
  const halfKnot = (y) => {
    const t = (knotTop - y) / p.knotHeight;
    return (p.knotTop + (p.knotBottom - p.knotTop) * t) / 2;
  };
  const knotOk = ribbon(out, hitAt, {
    ys: rowsBetween(knotTop, knotBottom),
    across: (y) => [x0 - halfKnot(y), x0 + halfKnot(y)],
    n: 9,
    raise: (y, u) => {
      const t = (knotTop - y) / p.knotHeight;
      const full = (1 - 0.45 * t) * (1 - smooth01((t - 0.85) / 0.15) * 0.75);
      return p.edgeLift + p.lift * 0.5 + p.knotDepth * full * Math.sqrt(Math.max(0, 1 - u * u));
    },
    shadeAt: (y, u) => {
      const t = (knotTop - y) / p.knotHeight;
      const crease = Math.abs(u - (-0.7 + 1.3 * t));
      const wrap = crease < 0.16 ? p.wrapShade + (1 - p.wrapShade) * (crease / 0.16) : 1;
      return wrap * (1 - (1 - p.knotUnder) * smooth01((t - 0.55) / 0.45)) * (1 - 0.12 * u * u);
    },
    hang: 0,
    side: p.sideShade,
    caps: ['top', 'bottom'],
  });
  if (!knotOk) return null;

  // Loosened, its two ends from the knot's top corners up into the collar at the top corners of the open neck.
  if (loose) {
    const reach = vee ? Math.max(0, vee.halfWidth(vee.top)) : 0.012;
    for (const side of [1, -1]) {
      const fromX = x0 + side * p.knotTop * 0.28;
      const toX = x0 + side * (reach + p.strand * 0.3);
      const upTo = top + 0.006;
      const centre = (y) => fromX + (toX - fromX) * smooth01((y - knotTop) / (upTo - knotTop));
      const strandOk = ribbon(out, hitAt, {
        ys: rowsBetween(upTo, knotTop - 0.004),
        across: (y) => [centre(y) - p.strand / 2, centre(y) + p.strand / 2],
        n: 3,
        raise: (y, u) => p.edgeLift + 0.001 * (1 - u * u),
        shadeAt: () => 0.92,
        hang: 0,
        side: p.sideShade,
      });
      if (!strandOk) return null;
    }
  }
  return { ...out, knotTop };
}

/**
 * One piece of the tie: rows from the top down (`ys`), each from `across(y)` ([xL, xR]) in `n` points, lying flat across the
 * highest of what's under the row and `raise(y, u)` off it (u from -1 at her right edge to 1 at her left), and, with `hang`,
 * falling back from the row above no faster than that per metre. Its two long sides go down to what's under them, and `caps`
 * ('top', 'bottom') close its ends. Adds to `out`; false if a row found nothing to lie on.
 */
function ribbon(out, hitAt, { ys, across, n, raise, shadeAt, hang = 0, settle = null, side = 0.6, caps = [] }) {
  const rows = [];
  let prev = null;
  for (const y of ys) {
    const [xL, xR] = across(y);
    const xs = Array.from({ length: n }, (_, k) => xL + ((xR - xL) * k) / (n - 1));
    const under = xs.map((x) => hitAt(x, y));
    if (under.some((v) => !v)) return false;
    const ground = Math.max(...under.map((v) => v.rest[2]));
    let base = ground;
    if (prev && hang) base = Math.max(base, prev.base - hang * (prev.y - y));
    prev = { y, base };
    // Towards its bottom it comes back in to lie on what's under it (never further in than that).
    if (settle) base += (ground - base) * smooth01((settle.below - y) / settle.over);
    rows.push({ y, xs, under, base });
  }
  const put = (v, rest, k) => {
    out.verts.push({ bind: unskin(v.skin, rest), rest, weights: v.weights, skin: v.skin, normal: v.normal });
    out.shade.push(k);
    return out.verts.length - 1;
  };
  const face = rows.map(({ y, xs, under, base }) =>
    xs.map((x, k) => {
      const u = (2 * k) / (n - 1) - 1;
      return put(under[k], [x, y, base + raise(y, u)], shadeAt(y, u));
    }),
  );
  const foot = rows.map(({ y, xs, under }) => [0, n - 1].map((k) => put(under[k], [xs[k], y, under[k].rest[2] + 0.0004], side)));
  const quad = (a, b, c, d) => out.tris.push([a, c, b], [b, c, d]);
  const last = rows.length - 1;
  for (let r = 0; r < last; r++) {
    for (let k = 0; k < n - 1; k++) quad(face[r][k], face[r][k + 1], face[r + 1][k], face[r + 1][k + 1]);
    quad(foot[r][0], face[r][0], foot[r + 1][0], face[r + 1][0]);
    quad(face[r][n - 1], foot[r][1], face[r + 1][n - 1], foot[r + 1][1]);
  }
  // An end: a fan from one foot across the arched face to the other foot.
  const cap = (r) => {
    for (let k = 0; k < n - 1; k++) out.tris.push([foot[r][0], face[r][k], face[r][k + 1]]);
    out.tris.push([foot[r][0], face[r][n - 1], foot[r][1]]);
  };
  if (caps.includes('top')) cap(0);
  if (caps.includes('bottom')) cap(last);
  return true;
}
