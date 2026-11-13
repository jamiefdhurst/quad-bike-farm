import * as THREE from 'three';
import { cabMats, merge, mesh, rounded } from './parts.js';
import { loftGeometry, sweepGeometry } from '../quadGeometry.js';

// Seats (TODO 340): a car's bucket, a bench in pleats, and a tractor's pressed-steel pan on its spring. The sizes and where the
// pleats and piping go are pure (`seatDims`, tested). A seat's origin is the middle of the cushion's top, at its front-to-back
// middle; +Z is forward, the back stands up behind at -Z. The vehicle keeps its own seat points (seatLeft, riderAnchor...) where
// they are and puts the seat under them.

export const SEAT_KINDS = {
  bucket: { width: 0.5, depth: 0.5, thick: 0.12, back: 0.62, bolster: 0.06, pleats: 3 }, // a car's front seat: bolsters each side, pleated middle
  bench: { width: 1.3, depth: 0.48, thick: 0.13, back: 0.45, bolster: 0, pleats: 7 }, // a Tor's or Crag's or a UTV's bench, pleated across
  single: { width: 0.48, depth: 0.46, thick: 0.12, back: 0.45, bolster: 0, pleats: 4 }, // a cab's plain single seat
  pan: { width: 0.44, depth: 0.4, thick: 0.03, back: 0.16, bolster: 0, pleats: 0 }, // a tractor's: a dished steel pan, a low lip behind
};

/**
 * A seat's numbers: `width`, `depth`, `thick` (the cushion), `back` (its height), `bolster` (each side's height above the middle),
 * `pleats` and `pleatXs` (each pleat's middle, across), `pipingY` (the piping round the cushion's top edge). Options override the kind's.
 */
export function seatDims(kind, opts = {}) {
  const k = SEAT_KINDS[kind];
  if (!k) throw new Error(`Unknown seat kind: ${kind}`);
  const d = { ...k, ...opts };
  const inner = d.width - (d.bolster ? 0.16 : 0.03); // the pleated middle, inside any bolsters
  const pitch = d.pleats ? inner / d.pleats : 0;
  d.pleatW = pitch;
  d.pleatXs = Array.from({ length: d.pleats }, (_, i) => -inner / 2 + pitch * (i + 0.5));
  d.pipingY = 0;
  return d;
}

/** One pleat or bolster: a soft rounded bar along Z, `w` wide, `h` thick, `len` long, its top at y = 0. */
function pad(w, h, len, x, y = 0, crown = 0.012) {
  const stations = [];
  const n = 6;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const z = len / 2 - len * t;
    const sag = crown * Math.sin(Math.PI * t); // a little dish where you sit
    stations.push({ z, w, y0: y - h, y1: y - sag * 0.5 + (t < 0.15 ? -0.01 * (1 - t / 0.15) : 0), x, e: 3 });
  }
  return loftGeometry(stations, { segments: 16, exponent: 3 });
}

/**
 * A seat of `kind` ('bucket', 'bench', 'single' or 'pan'). Upholstered seats are pleats side by side with a narrow gap between
 * (the seams, which the wear layer finds as nooks), piping along the cushion's front and the back's top, a frame under them.
 * Returns a group with 'cushion' and 'back' groups; mats: `cover` (the vinyl or cloth), `piping`, `frame`.
 */
export function buildSeat(kind, opts = {}) {
  const d = seatDims(kind, opts);
  const m = { ...cabMats(), ...(opts.mats ?? {}) };
  const cover = opts.mats?.cover ?? m.vinyl;
  const group = new THREE.Group();
  group.name = `seat_${kind}`;
  const cushion = new THREE.Group();
  cushion.name = 'cushion';
  const back = new THREE.Group();
  back.name = 'back';
  group.add(cushion, back);
  if (kind === 'pan') {
    // A pressed pan, dished, with a rolled lip, on a flat spring running forward to the pivot.
    const pts = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(t * d.width * 0.5, -0.03 * (1 - t * t) + (t > 0.85 ? (t - 0.85) * 0.25 : 0)));
    }
    const pan = new THREE.LatheGeometry(pts, 28);
    pan.scale(1, 1, d.depth / d.width);
    pan.deleteAttribute('uv');
    mesh(pan, opts.mats?.cover ?? m.paintedSteel, cushion, 'seatPan');
    const lip = new THREE.CylinderGeometry(d.width * 0.5, d.width * 0.5, d.back, 24, 1, true, Math.PI * 0.62, Math.PI * 0.76);
    lip.translate(0, d.back / 2, 0).scale(1, 1, d.depth / d.width);
    mesh(lip, opts.mats?.cover ?? m.paintedSteel, back, 'seatPanLip');
    const holes = [];
    for (const [x, z] of [[-0.08, 0], [0.08, 0], [0, 0.07], [0, -0.07]]) holes.push(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 8).translate(x, -0.028, z));
    mesh(merge(holes), m.dark, cushion, 'seatPanHoles');
    mesh(rounded(0.05, 0.012, 0.42, 0.004).translate(0, -0.05, 0.12), opts.mats?.frame ?? m.steel, cushion, 'seatSpring');
    return group;
  }
  const gap = 0.004;
  const pleats = d.pleatXs.map((x) => pad(d.pleatW - gap, d.thick, d.depth, x));
  if (d.bolster) for (const s of [-1, 1]) pleats.push(pad(0.08 - gap, d.thick + d.bolster, d.depth * 0.95, s * (d.width / 2 - 0.04), d.bolster, 0));
  mesh(merge(pleats), cover, cushion, 'seatCushion');
  // The back, built lying along Z like the cushion and stood up, leaning back a little.
  const backPleats = d.pleatXs.map((x) => pad(d.pleatW - gap, 0.08, d.back, x, 0, 0.006));
  if (d.bolster) for (const s of [-1, 1]) backPleats.push(pad(0.08 - gap, 0.08 + d.bolster, d.back * 0.9, s * (d.width / 2 - 0.04), d.bolster, 0));
  const lean = opts.lean ?? 0.22;
  const backGeo = merge(backPleats);
  backGeo.rotateX(-Math.PI / 2 + lean);
  backGeo.translate(0, d.back / 2 + 0.02, -d.depth / 2 - 0.02);
  mesh(backGeo, cover, back, 'seatBack');
  if (opts.headrest) mesh(rounded(0.26, 0.18, 0.08, 0.035).translate(0, d.back + 0.14, -d.depth / 2 - 0.1 - Math.sin(lean) * d.back), cover, back, 'headrest');
  // Piping along the cushion's front edge and across the back's top: a thin roll of the cover, a shade darker.
  const piping = opts.mats?.piping ?? cover;
  const half = d.width / 2 - 0.01;
  mesh(sweepGeometry([[-half, -0.01, d.depth / 2], [half, -0.01, d.depth / 2]], 0.006, { radial: 6 }), piping, cushion, 'seatPiping');
  const topZ = -d.depth / 2 - 0.02 - Math.sin(lean) * d.back;
  mesh(sweepGeometry([[-half, d.back + 0.02, topZ], [half, d.back + 0.02, topZ]], 0.006, { radial: 6 }), piping, back, 'seatBackPiping');
  // The frame: a tube runner each side under the cushion.
  const frame = [];
  for (const s of [-1, 1]) frame.push(sweepGeometry([[s * (half - 0.04), -d.thick - 0.02, d.depth / 2 - 0.03], [s * (half - 0.04), -d.thick - 0.02, -d.depth / 2]], 0.01, { radial: 6 }));
  mesh(merge(frame), opts.mats?.frame ?? m.steel, cushion, 'seatFrame');
  return group;
}
