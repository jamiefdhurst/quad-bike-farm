import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { lathe, taperedBox } from '../quadGeometry.js';

// Tyre tread for every vehicle (TODO 87): one carcass profile and one block layout per kind of tyre, so a quad's chevrons, a pit
// bike's knobs and a Fergie's bar lugs are each drawn the way the real ones are. The layout is pure numbers (tested); `treadTyre`
// turns it into geometry with the axle along X and the tops of the tread exactly on `radius`, so it still matches the physics wheel.

// Which way the chevrons point (Jamie, on the trailers): the V's apex leads in the direction the tyre turns, so seen from the front of the tyre it points UP
// (and at the top of the tyre it points backwards, at the ground forwards, as a tractor's drive tyre is fitted). They pointed down: the arms' yaw
// ran the other way round. Chevron kinds (atv, balloon, tractor, allTerrain) all use the one sign.
const CHEVRON = 0.5;

/**
 * What each kind looks like. `section` is how square the carcass is (2 round, 6 square), `depth` the tread depth as a share of the
 * section height, `count` blocks (or pairs) round the tyre. `crown` adds ribs (d > 0) or grooves (d < 0) to the carcass across its
 * crown, as fractions of the half width.
 */
export const TREAD_KINDS = {
  atv: { section: 3, depth: 0.16, count: 18 }, // a directional chevron, the arms meeting in a V on the centre line, and shoulder blocks
  farm: { section: 5, depth: 0.2, count: 16 }, // an old farm ATV tyre: square blocks in three rows and big shoulder blocks
  knobbly: { section: 2.2, depth: 0.28, count: 24 }, // a dirt bike's: separate square knobs, centre then pairs, and shoulder knobs
  balloon: { section: 2.2, depth: 0.08, count: 22 }, // a three-wheeler's fat soft tyre: low short bars in a shallow chevron
  trike: { section: 2.4, depth: 0.2, count: 20 }, // an old three-wheeler's: fat and round, chunky square blocks in staggered rows with big shoulder blocks
  tractor: { section: 5, depth: 0.32, count: 22 }, // a tractor rear: tall bar lugs from each shoulder, angled, open in the middle
  rib: { section: 3, depth: 0, count: 0, crown: [{ x: -0.42, w: 0.16, d: 0.12 }, { x: 0, w: 0.16, d: 0.12 }, { x: 0.42, w: 0.16, d: 0.12 }] }, // a tractor front: three ribs
  allTerrain: { section: 4, depth: 0.14, count: 26 }, // a Tor's or Crag's or a UTV's: two staggered rows of blocks with a zigzag between, and shoulders
  road: { section: 5, depth: 0.05, count: 40, crown: [{ x: -0.32, w: 0.09, d: -0.06 }, { x: 0.32, w: 0.09, d: -0.06 }] }, // a car's: grooves round it, sipes on the shoulders
};

/**
 * The carcass's half section as [[r, x], ...] from the bead on the -x side over the crown to the bead on the +x side, for a lathe.
 * `crown` is where the carcass tops out: the radius less the tread's depth. Ribs and grooves (`kind.crown`) are cut into it.
 */
export function carcassProfile(kind, { radius, width, rimR }) {
  const k = TREAD_KINDS[kind];
  const h = width / 2;
  const sectionH = radius - rimR;
  const crownR = radius - k.depth * sectionH - (k.crown?.some((c) => c.d > 0) ? Math.max(...k.crown.map((c) => c.d)) * sectionH : 0);
  const mid = rimR + sectionH * 0.42; // the widest point of the sidewall
  const e = k.section;
  const half = [];
  half.push([rimR + 0.004, -h * 0.8], [rimR + sectionH * 0.15, -h * 0.94]);
  // The upper sidewall and shoulder: a superellipse from the widest point round to the crown.
  const steps = 7;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * (Math.PI / 2) * 0.82;
    const c = Math.cos(a);
    const s = Math.sin(a);
    half.push([mid + (crownR - mid) * Math.pow(s, 2 / e), -h * Math.pow(c, 2 / e)]);
  }
  // Across the crown, with any ribs or grooves.
  const xEdge = -half[half.length - 1][1];
  const across = [];
  const n = k.crown ? 15 : 3;
  for (let i = 0; i <= n; i++) {
    const x = -xEdge + (2 * xEdge * i) / n;
    let r = crownR;
    for (const c of k.crown ?? []) {
      const t = 1 - Math.min(1, Math.abs(x / h - c.x) / c.w);
      r += c.d * sectionH * Math.min(1, t * 2.5);
    }
    across.push([r, x]);
  }
  const back = half.map(([r, x]) => [r, -x]).reverse();
  return [...half, ...across.slice(1, -1), ...back];
}

/**
 * The tread blocks of one tyre, as boxes in the tread's own frame: `th` the angle round the tyre, `x` across it (the axle), `w`
 * wide across, `l` long round it, `h` tall, `yaw` turned in the tread's plane, `lean` tilted down the shoulder (sign = which side),
 * `out` how far the block's top sits inside `radius` (0 for the main blocks), and `taper` how much smaller its top is than its foot.
 */
export function treadBlocks(kind, { radius, width, rimR, count }) {
  const k = TREAD_KINDS[kind];
  const W = width;
  const n = count ?? k.count;
  const depth = k.depth * (radius - rimR);
  const blocks = [];
  const block = (i, frac, b) => blocks.push({ th: ((i + frac) / n) * Math.PI * 2, yaw: 0, lean: 0, out: 0, taper: 0.85, h: depth, ...b });
  for (let i = 0; i < n; i++) {
    for (const s of [-1, 1]) {
      switch (kind) {
        case 'atv':
          block(i, 0, { x: s * W * 0.19, w: W * 0.42, l: depth * 1.5, yaw: -s * CHEVRON });
          block(i, 0.5, { x: s * W * 0.43, w: W * 0.16, l: depth * 1.9, lean: s * 0.7, out: depth * 0.4, taper: 0.8 });
          break;
        case 'farm':
          if (s < 0) block(i, 0, { x: 0, w: W * 0.2, l: depth * 2.4 });
          block(i, 0.5, { x: s * W * 0.26, w: W * 0.2, l: depth * 2.4 });
          block(i, 0, { x: s * W * 0.41, w: W * 0.18, l: depth * 2.6, lean: s * 0.55, out: depth * 0.3 });
          break;
        case 'knobbly':
          if (s < 0 && i % 2 === 0) block(i, 0, { x: 0, w: W * 0.3, l: W * 0.28 });
          if (i % 2 === 1) block(i, 0, { x: s * W * 0.27, w: W * 0.24, l: W * 0.24, lean: s * 0.35, out: depth * 0.15 });
          if (i % 2 === 0) block(i, 0.5, { x: s * W * 0.35, w: W * 0.18, l: W * 0.24, lean: s * 0.8, out: depth * 0.6 });
          break;
        case 'balloon':
          block(i, s > 0 ? 0 : 0.5, { x: s * W * 0.18, w: W * 0.4, l: depth * 2.2, yaw: -s * 0.35 * CHEVRON * 2, taper: 0.9 });
          break;
        case 'trike':
          // A centre row and two inner rows half a pitch apart, and a bigger block on each shoulder.
          if (s < 0) block(i, 0, { x: 0, w: W * 0.19, l: depth * 2.6 });
          block(i, 0.5, { x: s * W * 0.22, w: W * 0.19, l: depth * 2.6 });
          block(i, 0, { x: s * W * 0.4, w: W * 0.2, l: depth * 3, lean: s * 0.6, out: depth * 0.3 });
          break;
        case 'tractor':
          // An R1 bar lug: from the shoulder, angled forwards, just past the middle; the two sides half a pitch apart.
          block(i, s > 0 ? 0 : 0.5, { x: s * W * 0.2, w: W * 0.6, l: depth * 0.75, yaw: -s * 0.6, taper: 0.8 });
          break;
        case 'allTerrain':
          block(i, s > 0 ? 0 : 0.5, { x: s * W * 0.15, w: W * 0.26, l: depth * 3.2, yaw: -s * 0.18 });
          block(i, s > 0 ? 0.5 : 0, { x: s * W * 0.38, w: W * 0.2, l: depth * 3.4, lean: s * 0.45, out: depth * 0.25 });
          break;
        case 'road':
          block(i, 0, { x: s * W * 0.43, w: W * 0.16, l: ((Math.PI * 2 * radius) / n) * 0.7, lean: s * 0.5, out: depth * 0.3, taper: 0.95 });
          break;
        default:
          break;
      }
    }
  }
  return blocks;
}

const _m = new THREE.Matrix4();
const _r = new THREE.Matrix4();

/**
 * A whole tyre: the carcass lathed from `carcassProfile` and every block from `treadBlocks`, merged into one indexed geometry with
 * the axle along X. `segments` is the lathe's sides (more for a big tyre). The geometry remembers how it was made (`userData.tyre`)
 * so `wornTyre` can make the same tyre with its tread worn down.
 */
export function treadTyre(kind, { radius, width, rimR, count, segments = 40 }) {
  const opts = { radius, width, rimR, count, segments };
  const geo = buildTyre(kind, opts, 0, null);
  geo.userData.tyre = { kind, opts, k: geo.userData.k, base: geo, variants: [] };
  return geo;
}

function buildTyre(kind, opts, wear, fixedK) {
  const { radius, width, rimR, count, segments } = opts;
  if (!TREAD_KINDS[kind]) throw new Error(`Unknown tread kind: ${kind}`);
  const carcass = lathe(carcassProfile(kind, { radius, width, rimR }), segments).rotateZ(-Math.PI / 2);
  carcass.deleteAttribute('uv');
  const parts = [carcass];
  for (const b of treadBlocks(kind, { radius, width, rimR, count })) {
    // A block twice its height, half of it buried, so its foot is always in the carcass whatever the carcass's curve there.
    const g = taperedBox(b.w, b.h * 2, b.l, b.taper);
    g.deleteAttribute('uv');
    g.applyMatrix4(_r.makeRotationY(b.yaw));
    g.applyMatrix4(_r.makeRotationZ(-b.lean));
    g.applyMatrix4(_m.makeTranslation(b.x, radius - b.out - b.h - b.h * wear, 0)); // worn: the top sits lower by the share of its height worn off
    g.applyMatrix4(_r.makeRotationX(b.th));
    parts.push(g);
  }
  // The blocks' flat tops and leaning corners stand a few millimetres proud of where they were aimed: scale the lot so the outermost
  // point is exactly on the radius. (A worn copy uses the new tyre's scale, so it is not stretched back out to the radius.)
  const geo = mergeGeometries(parts);
  const k = fixedK ?? radius / outerRadius(geo);
  geo.scale(1, k, k);
  geo.userData.k = k;
  return geo;
}

/** How much of the tread's depth each look has worn off, from new (0) to bald (3). */
export const WEAR_LOOKS = [0, 0.4, 0.75, 0.92];

/** Which look a tyre with this much tread (0 bald, 1 new) has. */
export function wearLook(tread) {
  return tread >= 0.7 ? 0 : tread >= 0.4 ? 1 : tread >= 0.15 ? 2 : 3;
}

/** The same tyre as `geo` (made by `treadTyre`) with the look's wear, built once and shared. A geometry not made by it comes back as it was. */
export function wornTyre(geo, look) {
  const spec = geo.userData.tyre;
  if (!spec) return geo;
  if (look === 0) return spec.base;
  if (!spec.variants[look]) {
    const g = buildTyre(spec.kind, spec.opts, WEAR_LOOKS[look], spec.k);
    g.userData.tyre = spec;
    spec.variants[look] = g;
  }
  return spec.variants[look];
}

/** The furthest any part of a geometry reaches from the axle (X): for checking a tyre against its wheel radius. */
export function outerRadius(geo) {
  const p = geo.attributes.position;
  let r = 0;
  for (let i = 0; i < p.count; i++) r = Math.max(r, Math.hypot(p.getY(i), p.getZ(i)));
  return r;
}
