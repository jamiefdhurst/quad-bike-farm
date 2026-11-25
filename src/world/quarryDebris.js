// What is dumped by the pit's pond: steel drums and tyres (each one geometry, drawn instanced), and the danger signs along the fence. The geometry is
// pure; `scatterClear` deals out places for the pile so that nothing in it overlaps anything else.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drumTexture, rustedDrumTexture, tyreTexture, SIGN_SIZE, TYRE_UV } from './quarryTextures.js';
import { seeded } from './propStreams.js';

export const DRUM = { radius: 0.295, height: 0.88 };
export const TYRE = { radius: 0.312, width: 0.2 };

/**
 * A 205 litre steel drum, centred on its middle with its axis up: a rolled chime at each end, two rolling hoops round the body, a lip round the top
 * and a recessed lid with two bungs.
 */
export function drumGeometry(segments = 18) {
  const h = DRUM.height;
  const y0 = -h / 2;
  const prof = [[0, 0], [0.25, 0], [0.272, 0.014], [0.285, 0.034], [0.28, 0.06]];
  for (const y of [0.3, 0.57]) prof.push([0.28, y - 0.03], [0.295, y - 0.012], [0.295, y + 0.012], [0.28, y + 0.03]);
  prof.push([0.28, 0.82], [0.29, 0.84], [0.29, 0.866], [0.268, 0.88], [0.26, 0.862], [0.245, 0.85], [0, 0.85]);
  const body = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y0 + y)), segments);
  const bungs = [[0.1, 0.035, 0.02], [-0.12, 0.025, 0.08]].map(([x, r, z]) => new THREE.CylinderGeometry(r, r, 0.024, 8).translate(x, y0 + 0.86, z));
  return mergeGeometries([body, ...bungs], false);
}

/**
 * A car tyre lying flat, centred on its middle with its axis up (#1004): its section is a closed loop round the rubber, from the bottom bead out over the
 * tread to the top bead and back down the inner liner, so you see the liner looking into it and never through it. The tread's blocks and grooves, the
 * sidewalls' moulding and the liner are in its texture (quarryTextures.js `tyreTexture`, laid by `TYRE_UV`), not in geometry: 864 triangles where it
 * was 1,900.
 */
export function tyreGeometry(segments = 18) {
  const { radius: R } = TYRE;
  const [o0, o1] = TYRE_UV.outer;
  const [i0, i1] = TYRE_UV.inner;
  // The outside, top bead to bottom, with where each point falls along the texture (0..1 of the outside's share).
  const outer = [[0.19, 0.075, 0], [0.2, 0.093, 0.05], [0.24, 0.1, 0.15], [0.275, 0.095, 0.24], [0.298, 0.082, 0.3], [R - 0.006, 0.065, 0.34], [R, 0.05, 0.375],
    [R, 0, 0.5], [R, -0.05, 0.625], [R - 0.006, -0.065, 0.66], [0.298, -0.082, 0.7], [0.275, -0.095, 0.76], [0.24, -0.1, 0.85], [0.2, -0.093, 0.95], [0.19, -0.075, 1]];
  // The inner liner, a centimetre in from the outside, bottom bead to top.
  const inner = [[0.2, -0.066, 0], [0.24, -0.088, 0.15], [0.278, -0.08, 0.3], [0.296, -0.045, 0.42], [0.3, 0, 0.5], [0.296, 0.045, 0.58], [0.278, 0.08, 0.7], [0.24, 0.088, 0.85], [0.2, 0.066, 1]];
  // Round the rubber the one way: up the outside (the lathe faces a section whose y rises outwards), then down the liner, closing at the bottom bead.
  const loop = [...outer].reverse().map(([r, y, t]) => [r, y, o0 + (1 - t) * (o1 - o0)]);
  loop.push(...[...inner].reverse().map(([r, y, t]) => [r, y, i0 + (1 - t) * (i1 - i0)]));
  loop.push(loop[0]);
  const geo = new THREE.LatheGeometry(loop.map(([r, y]) => new THREE.Vector2(r, y)), segments);
  const uv = geo.attributes.uv;
  const n = loop.length;
  for (let i = 0; i <= segments; i++) for (let j = 0; j < n; j++) uv.setY(i * n + j, 1 - loop[j][2]); // the canvas is drawn top down
  return geo;
}

/**
 * Deals `count` places from `pick()` (each `{ x, z }`), each with the radius `radius(i)`, keeping those `ok(x, z)` allows and not within `gap` of
 * another (the ones already in `existing` included). Gives up on a place after `tries` goes, so it may return fewer.
 */
export function scatterClear(count, { pick, radius, ok = () => true, existing = [], gap = 0.1, tries = 24 }) {
  const placed = [...existing];
  const fresh = [];
  for (let i = 0; i < count; i++) {
    const r = radius(i);
    for (let t = 0; t < tries; t++) {
      const p = pick(i);
      if (!ok(p.x, p.z) || placed.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < q.r + r + gap)) continue;
      const spot = { x: p.x, z: p.z, r, i };
      placed.push(spot);
      fresh.push(spot);
      break;
    }
  }
  return fresh;
}

/** The drums' paints, as they were: blue, green, red, brown and grey. */
export const DRUM_PAINTS = ['#3a68a8', '#4a8a52', '#b04a36', '#93684a', '#888d90'];

/**
 * The pile's materials: drums in a handful of faded colours, and a tyre's black rubber. With `wear` (#1003) each drum is rusted through with the
 * label gone (`rustedDrumTexture`, its colour in it); the old texture is still made from `random`, so everything dealt after it stands where it did.
 */
export function debrisMaterials(random, wear = null) {
  const map = drumTexture(random);
  const drum = (color) => new THREE.MeshStandardMaterial({ map, color, roughness: 0.6, metalness: 0.25 });
  const rusted = (paint) => new THREE.MeshStandardMaterial({ map: rustedDrumTexture(wear, paint), roughness: 0.9, metalness: 0.15 });
  return {
    drums: wear ? DRUM_PAINTS.map(rusted) : DRUM_PAINTS.map((p) => drum(new THREE.Color(p).getHex())),
    tyre: new THREE.MeshStandardMaterial({ map: tyreTexture(seeded(1004)), roughness: 0.92 }), // its own fixed stream, so the pit's draws are as they were
  };
}

/** A pallet's sizes (#1004): a 1.2 by 1.0 m one, its bearers along its length and its deck boards across them. */
export const PALLET = { length: 1.2, width: 1.0, bearer: { w: 0.1, h: 0.08 }, board: { w: 0.12, t: 0.022 }, top: 7, bottom: 3 };

/**
 * An old pallet into `parts` (parts.js), standing on y = 0 with its length along x (#1004): three bearers, the deck boards across them and resting on
 * them (each board's underside 2 mm into its bearers' tops, so nothing floats or flickers), three bottom boards under the bearers, a board split, one
 * gone and one sprung loose at an end, and a nail head over every bearer. `random` says which.
 */
export function addPallet(parts, wood, random, nail) {
  const P = PALLET;
  const b = P.bearer;
  const t = P.board.t;
  const y0 = t; // the bearers sit on the bottom boards
  // The bearers a few millimetres in from the deck's edges and ends, so no face of one lies in the plane of a board's.
  const zs = [-(P.width / 2 - b.w / 2 - 0.005), 0, P.width / 2 - b.w / 2 - 0.005];
  for (const z of zs) parts.box(wood, P.length - 0.012, b.h, b.w, 0, y0 + b.h / 2, z, 0, 1);
  for (const x of [-(P.length / 2 - P.board.w / 2), 0, P.length / 2 - P.board.w / 2]) parts.box(wood, P.board.w, t, P.width, x, t / 2 - 0.002, 0, 0, 1);
  const top = y0 + b.h - 0.002; // the top boards' undersides, just into the bearers
  const gone = 1 + Math.floor(random() * (P.top - 2));
  const loose = random() < 0.5 ? 0 : P.top - 1;
  for (let i = 0; i < P.top; i++) {
    if (i === gone) continue;
    const x = -P.length / 2 + P.board.w / 2 + (i * (P.length - P.board.w)) / (P.top - 1);
    if (i === loose) {
      parts.add(wood, new THREE.BoxGeometry(P.board.w, t, P.width), x, top + t / 2 + 0.017, 0, 0.065, 0, 0); // sprung off one bearer at its end, still nailed at the other
      continue;
    }
    const split = random() < 0.3;
    const w = split ? P.board.w * 0.55 : P.board.w;
    parts.box(wood, w, t, P.width, x - (P.board.w - w) / 2, top + t / 2, 0, 0, 1);
    if (split) parts.box(wood, P.board.w * 0.4, t, P.width * 0.7, x + P.board.w * 0.3, top + t / 2, -P.width * 0.15, 0, 1);
    if (nail) for (const z of zs) parts.add(nail, new THREE.CylinderGeometry(0.006, 0.006, 0.004, 6), x, top + t + 0.001, z);
  }
}

/**
 * A danger sign on its post: a board with the lettered front facing +z and a plain galvanised back, held off the post by two bolted straps. The
 * board, its edges, straps and bolts are one mesh in one material (the texture's lettered part for the front, its galvanised strip for all the rest),
 * so a sign is two draw calls, the post and this. `wood` is the post's material. Returns a group standing on y = 0.
 */
export function buildSign(front, wood) {
  const group = new THREE.Group();
  group.name = 'quarrySign';
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), wood);
  post.position.y = 0.9;
  const lettered = (SIGN_SIZE.h - SIGN_SIZE.face) / SIGN_SIZE.h; // v of the bottom of the lettered part
  const grey = (v) => (geo) => {
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.1 + uv.getX(i) * 0.8, 0.02 + uv.getY(i) * (lettered - 0.04) * v);
    return geo;
  };
  const board = new THREE.BoxGeometry(0.9, 0.63, 0.03);
  const uv = board.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) {
    const face = i >= 16 && i < 20; // +z, the front
    if (face) uv.setY(i, lettered + uv.getY(i) * (1 - lettered));
    else uv.setXY(i, 0.1 + uv.getX(i) * 0.8, 0.02 + uv.getY(i) * (lettered - 0.04));
  }
  board.translate(0, 1.55, 0.085);
  const parts = [board];
  for (const y of [1.4, 1.7]) {
    parts.push(grey(1)(new THREE.BoxGeometry(0.16, 0.05, 0.04)).translate(0, y, 0.062));
    for (const x of [-0.05, 0.05]) parts.push(grey(1)(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6)).rotateX(Math.PI / 2).translate(x, y, 0.084));
  }
  const face = new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshStandardMaterial({ map: front, roughness: 0.55, metalness: 0.1 }));
  face.name = 'quarrySignBoard';
  group.add(post, face);
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
