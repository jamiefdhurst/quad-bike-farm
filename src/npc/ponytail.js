// A ponytail: some days a girl ties her hair back. Dealt for each day of the farm from a stream of its own (so nobody's outfit moved),
// with each girl's chance in characters.js (ponytailChance). Her own hair is pulled in tight to her head (outfit.js), and the band, the
// tail and a few loose strands are built here as plain arrays: the tail in a frame of its own, x to her right, y up and z back from
// the band. It swings on a damped spring driven by how her head moves (swingStep). Pure. docs/decisions/girls.md, "A ponytail (#488)".

/** The elastic: black most days, now and then a colour. */
export const BAND_COLOURS = ['#151515', '#151515', '#151515', '#b8326a', '#2f6db0', '#d8b64a'];

export const DEFAULT_PONYTAIL_PARAMS = {
  stiffness: 40, // how hard the tail is pulled back to hanging (per second squared): about one swing a second
  damping: 3.5, // how quickly a swing dies away (per second)
  response: 0.12, // radians of swing a metre per second squared of her head's jolt throws it
  maxSwing: 0.6, // radians: the furthest it swings out from her back or to the side
  intoBack: 0.06, // radians: how far it may swing in towards her back before it lies on it
};

export const PONYTAIL_PARAM_RANGES = {
  stiffness: [5, 120, 1],
  damping: [0.5, 12, 0.1],
  response: [0, 0.5, 0.01],
  maxSwing: [0.1, 1.2, 0.05],
  intoBack: [0, 0.3, 0.01],
};

/** The tail's shape, in metres. */
export const TAIL = {
  lift: 0.04, // how far it rises back out of the band before it falls
  liftAngle: 0.8, // radians above level it leaves the band at
  gathered: 0.009, // its radius under the band
  full: 0.024, // its radius at its thickest, just past the band
  end: 0.003, // its radius at the end
  wide: 1.15, // across against deep: a tail lies a little flat
  deep: 0.8,
  clear: 0.004, // metres it keeps off her back
  rings: 22,
  sides: 10,
  wisps: 4, // thin strands splaying out of its end
  wispFrom: 0.7, // how far down the tail they start
};

/**
 * Today's ponytail for a girl: whether she has one, and the band's colour. One draw each, always, so one girl's deal doesn't move
 * the other's.
 */
export function dealPonytail(random, chance = 0) {
  const on = random() < chance;
  const band = BAND_COLOURS[Math.min(BAND_COLOURS.length - 1, Math.floor(random() * BAND_COLOURS.length))];
  return { ponytail: on, band };
}

const lerp = (a, b, t) => a + (b - a) * t;
const smooth01 = (x) => {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
};

/** The tail's radius `u` of the way down it (0 at the band, 1 at its end): gathered under the band, full just past it, then tapering. */
export function tailRadius(u, p = TAIL) {
  u = Math.max(0, Math.min(1, u));
  if (u < 0.08) return lerp(p.gathered, p.full * 0.9, smooth01(u / 0.08));
  if (u < 0.16) return lerp(p.full * 0.9, p.full, (u - 0.08) / 0.08);
  return lerp(p.end, p.full, Math.pow(1 - (u - 0.16) / 0.84, 0.85));
}

/**
 * The tail's middle line in its own frame ([0, y, z] points, 0 at the band): rising back out of the band at `liftAngle`, then falling
 * `drop` metres. `backAt(d)`, `d` metres below the band, is how far back her body's surface is there (null where there's none); the
 * line keeps its radius and `clear` off it, so it lies down her back rather than through it.
 */
export function tailPath(drop, backAt = () => null, p = TAIL) {
  const n = p.rings;
  const c = [p.lift * Math.cos(p.liftAngle), p.lift * Math.sin(p.liftAngle)];
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // A cubic from the band, out along the lift, to hanging straight down a little way back.
    const P = [[0, 0], c, [0.06, -drop * 0.3], [0, -drop]];
    const k = [(1 - t) ** 3, 3 * t * (1 - t) ** 2, 3 * t * t * (1 - t), t ** 3];
    const z = P.reduce((s, q, j) => s + q[0] * k[j], 0);
    const y = P.reduce((s, q, j) => s + q[1] * k[j], 0);
    pts.push([0, y, z]);
  }
  // Off her back, then evened out so a push at one ring doesn't kink it, keeping clear after.
  const floor = pts.map(([, y], i) => {
    const b = backAt(-y);
    return b == null ? -Infinity : b + tailRadius(i / n, p) * p.deep + p.clear;
  });
  for (let i = 1; i <= n; i++) pts[i][2] = Math.max(pts[i][2], floor[i]);
  for (let pass = 0; pass < 3; pass++) {
    const z = pts.map((q) => q[2]);
    for (let i = 1; i < n; i++) pts[i][2] = Math.max(floor[i], (z[i - 1] + 2 * z[i] + z[i + 1]) / 4);
  }
  return pts;
}

/**
 * A tube along `path` ([x, y, z] points), its radius `radius(u)` (u 0 to 1 along it), `wide` across (x) and `deep` the other way.
 * `shade(a, u)` darkens it round and along (grooves of hair). Returns { points, tris, shade } with each ring `sides` points and the end
 * closed to a point.
 */
export function tube(path, radius, { sides = 8, wide = 1, deep = 1, shade = () => 1, side = [1, 0, 0] } = {}) {
  const points = [];
  const shades = [];
  const tris = [];
  const n = path.length - 1;
  for (let i = 0; i <= n; i++) {
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(n, i + 1)];
    const t = norm([b[0] - a[0], b[1] - a[1], b[2] - a[2]]);
    // Across the tube: `side` made square to the line; the other way, square to both.
    const s = norm(sub(side, scale(t, dot(side, t))));
    const q = cross(t, s);
    const r = radius(i / n);
    for (let k = 0; k < sides; k++) {
      const ang = (k / sides) * Math.PI * 2;
      const cx = Math.cos(ang) * r * wide;
      const cy = Math.sin(ang) * r * deep;
      points.push([path[i][0] + s[0] * cx + q[0] * cy, path[i][1] + s[1] * cx + q[1] * cy, path[i][2] + s[2] * cx + q[2] * cy]);
      shades.push(shade(ang, i / n));
    }
  }
  for (let i = 0; i < n; i++) {
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      tris.push([a, a + sides, b], [b, a + sides, b + sides]);
    }
  }
  // Closed at both ends: a point in the middle of each end ring.
  for (const [i, flip] of [[0, true], [n, false]]) {
    const mid = points.length;
    points.push([...path[i]]);
    shades.push(shade(0, i / n));
    for (let k = 0; k < sides; k++) {
      const a = i * sides + k;
      const b = i * sides + ((k + 1) % sides);
      tris.push(flip ? [mid, b, a] : [mid, a, b]);
    }
  }
  return { points, tris, shade: shades };
}

/** Several tubes as one: { points, tris, shade }. */
export function merge(parts) {
  const out = { points: [], tris: [], shade: [] };
  for (const part of parts) {
    const base = out.points.length;
    out.points.push(...part.points);
    out.shade.push(...part.shade);
    for (const t of part.tris) out.tris.push(t.map((i) => i + base));
  }
  return out;
}

/** Grooves of hair down a tube: darker every so often round it, a little lighter towards the end. */
export function hairShade(ang, u) {
  return 0.8 + 0.14 * (0.5 + 0.5 * Math.cos(ang * 5 + u * 3)) + 0.06 * u;
}

/**
 * The tail, its wisps and the band, in the tail's frame. `drop`: metres from the band to its end; `backAt` as tailPath. Returns
 * { hair: { points, tris, shade }, band: { points, tris, shade }, path }.
 */
export function buildTail(drop, backAt, p = TAIL) {
  const path = tailPath(drop, backAt, p);
  const main = tube(path, (u) => tailRadius(u, p), { sides: p.sides, wide: p.wide, deep: p.deep, shade: hairShade });
  // The wisps: thin strands out of the tail's last third, splaying a little and running on past its end.
  const n = path.length - 1;
  const from = Math.round(p.wispFrom * n);
  const wisps = [];
  for (let w = 0; w < p.wisps; w++) {
    const across = (w / Math.max(1, p.wisps - 1) - 0.5) * 2; // -1 to 1
    const start = path[from];
    const r0 = tailRadius(p.wispFrom, p) * 0.55;
    const s = [start[0] + across * r0 * p.wide, start[1], start[2] + (w % 2 ? 1 : -1) * r0 * 0.4 * p.deep];
    const end = path[n];
    const tip = [end[0] + across * 0.014, end[1] - 0.02 - 0.008 * (w % 2), end[2] + 0.004 + 0.003 * (w % 3)];
    const line = [];
    for (let i = 0; i <= 6; i++) {
      const t = i / 6;
      const along = path[Math.min(n, from + Math.round(t * (n - from)))];
      const k = t * t;
      // Following the tail at first, then off towards the tip.
      line.push([lerp(s[0] + along[0] - start[0], tip[0], k), lerp(along[1], tip[1], k), lerp(s[2] + along[2] - start[2], tip[2], k)]);
    }
    wisps.push(tube(line, (u) => lerp(0.0028, 0.0006, u), { sides: 4, shade: (ang, u) => hairShade(ang, u) * 1.02 }));
  }
  // The band: a ring round the tail just past where it leaves her head.
  const at = Math.max(1, Math.round(0.03 * n));
  const centre = path[at];
  const tng = norm(sub(path[at + 1], path[at - 1]));
  const ring = [];
  const major = tailRadius(at / n, p) * 1.05 + 0.002;
  const s = [1, 0, 0];
  const q = cross(tng, s);
  for (let k = 0; k <= 14; k++) {
    const ang = (k / 14) * Math.PI * 2;
    const a = Math.cos(ang) * major * p.wide;
    const b = Math.sin(ang) * major * p.deep;
    ring.push([0, 1, 2].map((j) => centre[j] + s[j] * a + q[j] * b));
  }
  ring.push(ring[1]); // round once more, so the closed tube's ends meet inside itself
  const band = tube(ring, () => 0.0045, { sides: 6, side: tng, shade: (ang) => 0.85 + 0.15 * Math.cos(ang) });
  return { hair: merge([main, ...wisps]), band, path };
}

/**
 * A loose strand hanging from `root` ([x, y, z]) `length` metres, curling a little towards `curl` (a direction) as it falls, each
 * point kept at least `clear` outside `surface(pt)` (the distance it must be pushed out, or 0). Returns { points, tris, shade }.
 */
export function strand(root, down, curl, length, { r0 = 0.0022, r1 = 0.0005, steps = 6, out = () => [0, 0, 0] } = {}) {
  const line = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const pt = [root[0] + down[0] * length * t + curl[0] * length * t * t, root[1] + down[1] * length * t + curl[1] * length * t * t, root[2] + down[2] * length * t + curl[2] * length * t * t];
    const push = out(pt);
    line.push([pt[0] + push[0], pt[1] + push[1], pt[2] + push[2]]);
  }
  return tube(line, (u) => lerp(r0, r1, u), { sides: 4, shade: hairShade });
}

/**
 * One step of the tail's swing: a damped spring back to hanging, thrown by the band's acceleration `accel` ([x across, z back], metres
 * per second squared, in the tail's frame; it swings away from where the head is going). `s` { pitch, roll, vPitch, vRoll } in
 * radians: `pitch` its end swung out behind her (negative in towards her back), `roll` to her right. Returns the new state.
 */
export function swingStep(s, accel, dt, p = DEFAULT_PONYTAIL_PARAMS) {
  let { pitch, roll, vPitch, vRoll } = s;
  const steps = Math.max(1, Math.ceil(dt / (1 / 120)));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    vPitch += (-p.stiffness * pitch - p.damping * vPitch - (p.response * p.stiffness * accel[1]) / 9.81) * h;
    vRoll += (-p.stiffness * roll - p.damping * vRoll - (p.response * p.stiffness * accel[0]) / 9.81) * h;
    pitch += vPitch * h;
    roll += vRoll * h;
    // Against her back it stops; out at the limit it stops too.
    if (pitch < -p.intoBack) [pitch, vPitch] = [-p.intoBack, Math.max(0, vPitch)];
    if (pitch > p.maxSwing) [pitch, vPitch] = [p.maxSwing, Math.min(0, vPitch)];
    if (Math.abs(roll) > p.maxSwing) [roll, vRoll] = [Math.sign(roll) * p.maxSwing, 0];
  }
  return { pitch, roll, vPitch, vRoll };
}

export const STILL = { pitch: 0, roll: 0, vPitch: 0, vRoll: 0 };

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function scale(a, k) {
  return [a[0] * k, a[1] * k, a[2] * k];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a) {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
}
