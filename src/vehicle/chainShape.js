// The shape of a drive chain and its sprockets (#48), pure so a test can check it: where the chain runs between two sprockets, how it hangs
// as it stretches, where its links sit, what a worn sprocket's teeth look like and what a chain's fault level says about all of it.
// detail/chainDrive.js turns these into meshes. Points are { z, y } in the plane of the chain (z forward, y up), in metres.

/** A 428 motorcycle chain, which is what the small bikes and quads run, and how far the picture of a worn one is pushed. */
export const CHAIN_LOOK = {
  pitch: 0.0127, // between one roller and the next
  sagSnug: 0.012, // of a run's length that even a good chain hangs at its lower run
  sagSlack: 0.11, // more of it at full slack (it grows with the square of the slack, so the first bit of stretch hardly shows)
  sagTopFrom: 0.3, // slack at which the top run starts to hang too
  sagTop: 0.08, // of a run's length the top run hangs at full slack
  hookFrom: 0.35, // slack at which the teeth start to hook
  hookTo: 0.9, // and at which they are fully shark-finned
  looseDrop: 0.06, // how far below the front sprocket a chain that has come off hangs
  slackStep: 0.04, // the slack that is shown changes in steps this big, so the chain is only rebuilt a few times as it stretches
  hookStep: 0.1,
};

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (x) => Math.max(0, Math.min(1, x));

/** How many teeth a sprocket whose rollers sit on a circle of radius `r` has. */
export function teethFor(r, pitch = CHAIN_LOOK.pitch) {
  return Math.max(8, Math.round(Math.PI / Math.asin(Math.min(1, pitch / (2 * r)))));
}

/** What a quad's faults say the chain looks like: how slack, how worn the teeth are, whether it has come off and how dry. */
export function chainWear(faults) {
  const slack = faults.started.chain ? faults.levels.chain : 0;
  return { slack, hook: hookFor(slack), off: !!faults.kept.chainOff, dry: faults.chainDryness };
}

/** 0 for good teeth to 1 for worn right down to hooks, as the chain stretches (a stretched chain wears the teeth it runs on). */
export function hookFor(slack, look = CHAIN_LOOK) {
  const t = clamp01((slack - look.hookFrom) / (look.hookTo - look.hookFrom));
  return t * t * (3 - 2 * t);
}

/** The slack and hook as drawn, held to steps so a rebuild only happens when the picture really changes. */
export function shownWear(wear, look = CHAIN_LOOK) {
  const q = (v, step) => Math.round(v / step) * step;
  return { slack: q(clamp01(wear.slack), look.slackStep), hook: q(clamp01(wear.hook), look.hookStep), off: !!wear.off, dry: wear.dry };
}

/** How far a run of length `len` hangs at the middle: the lower run first, the top one only once it is properly loose. */
export function sagOf(len, slack, top, look = CHAIN_LOOK) {
  if (top) return len * look.sagTop * clamp01((slack - look.sagTopFrom) / (1 - look.sagTopFrom)) ** 2;
  return len * (look.sagSnug + look.sagSlack * slack * slack);
}

/** The outer tangent lines between two circles: the unit normals of the upper and lower runs, and the unit vector from the front to the rear. */
export function tangents(front, rear) {
  const dz = rear.z - front.z;
  const dy = rear.y - front.y;
  const D = Math.hypot(dz, dy);
  const d = { z: dz / D, y: dy / D };
  const k = (front.r - rear.r) / D; // the normal's share along the line between the centres
  const s = Math.sqrt(Math.max(0, 1 - k * k));
  let p = { z: -d.y, y: d.z };
  if (p.y < 0) p = { z: -p.z, y: -p.y };
  const at = (sign) => ({ z: d.z * k + sign * p.z * s, y: d.y * k + sign * p.y * s });
  return { d, D, upper: at(1), lower: at(-1) };
}

function arc(c, n0, n1, through, steps) {
  const a0 = Math.atan2(n0.y, n0.z);
  let da = Math.atan2(n1.y, n1.z) - a0;
  while (da > Math.PI) da -= 2 * Math.PI;
  while (da <= -Math.PI) da += 2 * Math.PI;
  const mid = a0 + da / 2;
  if (Math.cos(mid) * through.z + Math.sin(mid) * through.y < 0) da += da > 0 ? -2 * Math.PI : 2 * Math.PI;
  const out = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + (da * i) / steps;
    out.push({ z: c.z + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a) });
  }
  return out;
}

function run(a, b, sag, steps) {
  const out = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    out.push({ z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t) - 4 * t * (1 - t) * sag });
  }
  return out;
}

function bezier(a, c, b, steps) {
  const out = [];
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    out.push({ z: u * u * a.z + 2 * u * t * c.z + t * t * b.z, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y });
  }
  return out;
}

/**
 * The closed line the chain's rollers follow round `front` and `rear` ({ z, y, r } with r the radius the rollers sit at): the top run, round the
 * rear, the lower run, round the front. Slack hangs the runs. A chain that is `off` has come off the front sprocket: it stays wrapped round the
 * rear one and both runs hang from it to a loose end below the front, as a chain does when it lies across the swingarm.
 */
export function chainLoop(front, rear, { slack = 0, off = false } = {}, look = CHAIN_LOOK) {
  const { d, D, upper, lower } = tangents(front, rear);
  const pt = (c, n) => ({ z: c.z + c.r * n.z, y: c.y + c.r * n.y });
  const fU = pt(front, upper);
  const rU = pt(rear, upper);
  const rL = pt(rear, lower);
  const fL = pt(front, lower);
  const rearArc = arc(rear, upper, lower, d, 14);
  if (off) {
    const end = { z: front.z, y: front.y - front.r - look.looseDrop };
    const mid = (a, b) => ({ z: (a.z + b.z) / 2, y: (a.y + b.y) / 2 - D * 0.18 });
    return [...rearArc, ...bezier(rL, mid(rL, end), end, 10), end, ...bezier(end, mid(end, rU), rU, 10)];
  }
  const runLen = Math.hypot(rU.z - fU.z, rU.y - fU.y);
  const frontArc = arc(front, lower, upper, { z: -d.z, y: -d.y }, 8);
  return [
    ...rearArc,
    ...run(rL, fL, sagOf(runLen, slack, false, look), 14),
    ...frontArc,
    ...run(fU, rU, sagOf(runLen, slack, true, look), 14),
  ];
}

/** Total length round a closed line of points. */
export function loopLength(points) {
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    total += Math.hypot(b.z - a.z, b.y - a.y);
  }
  return total;
}

/** Where each link sits: a whole number of them spaced evenly round the closed line, with the angle each points along it (0 is forward). */
export function linkPlaces(points, pitch = CHAIN_LOOK.pitch) {
  const total = loopLength(points);
  const n = Math.max(3, Math.round(total / pitch));
  const step = total / n;
  const out = [];
  let seg = 0;
  let segStart = 0;
  for (let i = 0; i < n; i++) {
    const s = i * step;
    for (;;) {
      const a = points[seg % points.length];
      const b = points[(seg + 1) % points.length];
      const len = Math.hypot(b.z - a.z, b.y - a.y);
      if (s <= segStart + len || seg > points.length * 2) {
        const t = len > 0 ? (s - segStart) / len : 0;
        out.push({ z: lerp(a.z, b.z, t), y: lerp(a.y, b.y, t), angle: Math.atan2(b.y - a.y, b.z - a.z) });
        break;
      }
      segStart += len;
      seg++;
    }
  }
  return { places: out, pitch: step };
}

/**
 * The outline of a sprocket as [angle, radius] pairs round it, centred on 0: `teeth` teeth with their valleys at `r` less a roller's seat, and
 * with `hook` from 0 to 1 each tooth worn from a stubby trapezoid to a thin fin leaning the way it turns, as a sprocket's do after a long time
 * on a stretched chain.
 */
export function sprocketOutline(r, teeth, hook = 0, look = CHAIN_LOOK) {
  const A = (2 * Math.PI) / teeth;
  const valley = r - look.pitch * 0.33;
  const tip = r + look.pitch * (0.3 - 0.06 * hook);
  const out = [];
  for (let i = 0; i < teeth; i++) {
    const a0 = i * A;
    const flat = 0.075 * A * (1 - hook);
    const lean = hook * 0.3 * A;
    out.push([a0 - 0.36 * A, valley]);
    out.push([a0 - 0.12 * A - flat + lean, tip]);
    out.push([a0 + 0.12 * A * (1 - hook * 0.4) + flat + lean, tip]);
    out.push([a0 + 0.36 * A, valley]);
  }
  return out;
}
