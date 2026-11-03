// The pit's steel container: a 20 foot shipping container, long left in the field and gone green and rusty, on three railway sleepers. Built in a
// local frame with its length along x, the doors on the +x end (the left one ajar), standing on y = 0, so a caller can turn it to any heading.

import * as THREE from 'three';
import { Parts, placement } from './parts.js';
import { paintedSteelTexture, rustTexture, plateTexture, stencilTexture } from './quarryTextures.js';
import { woodTexture } from './neighbourTextures.js';

export const CONTAINER = { length: 6.06, width: 2.44, height: 2.59, lift: 0.2 };

/**
 * Corrugated sheet as a solid: wave along x from 0 to `length`, up y from 0 to `height`, the crests `depth` out along `crest` (+1 or -1 in z) from the
 * trough's face at z = 0, a `thick` sheet. `steps` divides it along its height, for something to dent.
 */
export function corrugatedGeometry(length, height, { crest = 1, pitch = 0.22, depth = 0.04, thick = 0.012, steps = 1 } = {}) {
  const n = Math.max(1, Math.round(length / pitch));
  const p = length / n;
  const outer = [];
  for (let k = 0; k < n; k++) {
    const x = k * p;
    outer.push([x, 0], [x + 0.2 * p, 0], [x + 0.3 * p, depth], [x + 0.7 * p, depth], [x + 0.8 * p, 0]);
  }
  outer.push([length, 0]);
  const pts = [...outer, ...outer.map(([x, z]) => [x, z - thick]).reverse()];
  const shape = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z * crest)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps });
  geo.rotateX(Math.PI / 2); // the shape's y becomes z, its extrusion runs down y
  geo.translate(0, height, 0);
  return geo;
}

/** Pushes a round dent into a corrugated sheet: vertices near (x, y) go `amount` along z in the direction `inward` (+1 or -1), falling off smoothly over `radius`. */
export function dentGeometry(geo, x, y, radius, amount, inward) {
  const pos = geo.attributes.position;
  const sigma = radius / 2;
  for (let i = 0; i < pos.count; i++) {
    const r2 = (pos.getX(i) - x) ** 2 + (pos.getY(i) - y) ** 2;
    pos.setZ(i, pos.getZ(i) + inward * amount * Math.exp(-r2 / (2 * sigma * sigma)));
  }
  geo.computeVertexNormals();
  return geo;
}

/** A copy of `tex` stretched so one tile covers a corrugated sheet `h` metres tall, whose v runs from 1 - h at its foot to 1 at its top. */
function tallSheet(tex, h) {
  const t = tex.clone();
  t.repeat.set(1, 1 / h);
  t.offset.set(0, (h - 1) / h);
  t.needsUpdate = true;
  return t;
}

export const WALL_HEIGHT = CONTAINER.lift + CONTAINER.height - 0.12 - (CONTAINER.lift + 0.16) + 0.02; // the side walls' sheet, between the rails
export const LEAF_HEIGHT = 2.17; // a door leaf's sheet

/** The container's materials, made once. */
export function containerMaterials(random) {
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.8, ...o });
  const paint = paintedSteelTexture(random, '#4d6a58', 0.6);
  const m = {
    wall: lit({ map: tallSheet(paint, WALL_HEIGHT), roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
    leaf: lit({ map: tallSheet(paint, LEAF_HEIGHT), roughness: 0.7, metalness: 0.2, side: THREE.DoubleSide }),
    frame: lit({ map: paintedSteelTexture(random, '#3d5546', 0.9), roughness: 0.75, metalness: 0.2 }),
    rust: lit({ map: rustTexture(random), roughness: 0.9 }),
    dark: lit({ color: 0x1f1f1d, roughness: 0.9 }),
    bar: lit({ color: 0x8b8e90, metalness: 0.7, roughness: 0.45 }),
    wood: lit({ map: woodTexture(random, [92, 76, 58]), roughness: 0.95 }),
    stencil: lit({ map: stencilTexture(['GRVL 204118 6', '22G1']), roughness: 0.8, transparent: true, depthWrite: false }),
    plate: lit({ map: plateTexture(['CSC SAFETY', 'APPROVAL', 'GB/6047']), roughness: 0.5, metalness: 0.4 }),
  };
  for (const [k, v] of Object.entries(m)) v.name = k;
  return m;
}

const DEPTH = 0.04;
const HINGE_INSET = 0.05;

/** One door leaf's parts in its own frame: the hinge's axis up the y axis through the origin, the leaf running `dir` (+1 or -1) along z, its face towards +x. */
function buildLeaf(m, dir, { hasp }) {
  const p = new Parts();
  const w = CONTAINER.width / 2 - HINGE_INSET - 0.01;
  const y0 = CONTAINER.lift + 0.21;
  const y1 = y0 + LEAF_HEIGHT;
  const h = LEAF_HEIGHT;
  const px = -0.03 - DEPTH; // the sheet's trough plane, so its crests stand at x = -0.03
  const sheet = corrugatedGeometry(w, h, { crest: dir > 0 ? -1 : 1, steps: 1 });
  sheet.rotateY(dir > 0 ? -Math.PI / 2 : Math.PI / 2);
  p.add(m.leaf, sheet, px, y0, 0);
  // The frame round the leaf, standing a little proud of the sheet (each bar from `back` to `front` in x, every one different so none shares a plane
  // with the sheet's crests or each other).
  const zc = (u) => dir * u; // a distance along the leaf, in z
  const bar = (mat, back, front, w, hh, y, u) => p.box(mat, front - back, hh, w, (back + front) / 2, y, zc(u));
  bar(m.frame, -0.056, 0.012, 0.07, h - 0.04, y0 + h / 2, 0.025);
  bar(m.frame, -0.05, 0.006, 0.057, h - 0.04, y0 + h / 2, w - 0.0345);
  bar(m.frame, -0.062, 0.018, w - 0.02, 0.07, y0 + 0.023, w / 2);
  bar(m.frame, -0.047, 0.024, w - 0.02, 0.07, y1 - 0.023, w / 2);
  // Two locking bars with their guides, cams top and bottom, and a handle on each folding into a keeper.
  for (const [i, u] of [0.22, 0.85].entries()) {
    const bx = 0.015;
    p.rod(m.bar, [bx, y0 - 0.02, zc(u)], [bx, y1 + 0.02, zc(u)], 0.017);
    for (const y of [y0 + 0.4, y0 + 1.1, y1 - 0.4]) bar(m.dark, -0.052, 0.027, 0.06, 0.06, y, u);
    for (const y of [y0 - 0.01, y1 + 0.01]) p.box(m.bar, 0.07, 0.045, 0.11, bx, y, zc(u));
    const hy = y0 + 0.95 + i * 0.25;
    const out = i === 0 ? dir : -dir; // the first handle folds away from the hinge, the second towards it
    const end = zc(u) + out * 0.34;
    p.rod(m.bar, [bx, hy, zc(u)], [bx + 0.05, hy, zc(u) + out * 0.05], 0.014);
    p.rod(m.bar, [bx + 0.05, hy, zc(u) + out * 0.05], [bx + 0.05, hy, end], 0.014);
    p.box(m.dark, 0.04, 0.04, 0.05, bx + 0.05, hy, end + out * 0.01); // its grip
    p.box(m.dark, 0.066, 0.08, 0.06, -0.0165, hy, end + out * 0.01); // the keeper it folds into
    if (hasp && i === 1) {
      // A hasp on the keeper and a padlock through it.
      p.box(m.rust, 0.012, 0.16, 0.07, 0.036, hy - 0.04, end + out * 0.01);
      p.box(m.bar, 0.03, 0.075, 0.06, 0.05, hy - 0.16, end + out * 0.01);
      p.add(m.bar, new THREE.TorusGeometry(0.025, 0.007, 5, 10, Math.PI), 0.05, hy - 0.12, end + out * 0.01, 0, Math.PI / 2, 0);
    }
  }
  // The hinge: three knuckles on the axis, each with a strap to the leaf.
  p.rod(m.bar, [0, y0 + 0.05, 0], [0, y1 - 0.05, 0], 0.013);
  for (const y of [y0 + 0.25, y0 + h / 2, y1 - 0.25]) {
    p.rod(m.dark, [0, y - 0.08, 0], [0, y + 0.08, 0], 0.032);
    p.box(m.dark, 0.032, 0.12, 0.13, -0.034, y, zc(0.075));
  }
  return p;
}

/**
 * The container: `{ group, boxes }`. `boxes` are its colliders in its own frame ([x, y, z, half x, half y, half z]).
 * `random` deals the dents' places.
 */
export function buildContainer(m, random = Math.random) {
  const { length: L, width: W, height: H, lift } = CONTAINER;
  const top = lift + H;
  const p = new Parts();
  // Sleepers it stands on (sunk into the ground below).
  for (const x of [-2.3, 0, 2.3]) p.box(m.wood, 0.24, 0.55, W + 0.3, x, lift - 0.27, 0, 0, 0.6);
  // The frame: bottom side rails, top side rails (both between the posts), the end sills and headers, and the corner posts with their castings.
  for (const s of [-1, 1]) {
    p.box(m.frame, L - 0.28, 0.16, 0.12, 0, lift + 0.08, s * (W / 2 - 0.06), 0, 1.2);
    p.box(m.frame, L - 0.28, 0.12, 0.12, 0, top - 0.06, s * (W / 2 - 0.06), 0, 1.2);
    for (const e of [-1, 1]) {
      p.box(m.frame, 0.14, H, 0.14, e * (L / 2 - 0.07), lift + H / 2, s * (W / 2 - 0.07), 0, 1.2);
      for (const y of [lift + 0.08, top - 0.08]) {
        p.box(m.frame, 0.2, 0.18, 0.2, e * (L / 2 - 0.09), y, s * (W / 2 - 0.09)); // a corner casting, standing a centimetre proud of the post
        p.box(m.dark, 0.234, 0.07, 0.09, e * (L / 2 - 0.1), y, s * (W / 2 - 0.09)); // its slot
      }
    }
  }
  for (const e of [-1, 1]) {
    p.box(m.frame, 0.14, 0.16, W - 0.28, e * (L / 2 - 0.07), lift + 0.08, 0, 0, 1.2);
    p.box(m.frame, 0.14, 0.2, W - 0.28, e * (L / 2 - 0.07), top - 0.1, 0, 0, 1.2);
  }
  // Cross members under the floor, then the floor itself.
  for (let i = 0; i < 9; i++) p.box(m.dark, 0.1, 0.1, W - 0.2, -L / 2 + 0.5 + i * 0.64, lift + 0.11, 0);
  p.box(m.wood, L - 0.2, 0.05, W - 0.2, 0, lift + 0.185, 0, 0, 1.2);
  // The roof sheet with its pressed ribs, and a rusty patch.
  p.box(m.frame, L - 0.2, 0.04, W - 0.2, 0, top - 0.03, 0, 0, 1.2);
  for (let i = 0; i < 7; i++) p.box(m.frame, 0.12, 0.025, W - 0.36, -L / 2 + 0.55 + i * 0.83, top - 0.0, 0, 0, 1.2);
  p.box(m.rust, 0.9, 0.012, 0.8, 0.7, top - 0.004, 0.3, 0, 1.2);
  // The corrugated walls: both sides (the near one dented), and the blind end.
  const wallH = WALL_HEIGHT;
  const yb = lift + 0.15;
  const side = L - 0.28 + 0.02;
  const nearSide = random() < 0.5 ? 1 : -1;
  for (const s of [-1, 1]) {
    const geo = corrugatedGeometry(side, wallH, { crest: s, steps: s === nearSide ? 14 : 1 });
    if (s === nearSide) {
      dentGeometry(geo, side * (0.2 + random() * 0.15), wallH * 0.5, 0.7, 0.05, -s);
      dentGeometry(geo, side * (0.75 + random() * 0.1), wallH * 0.12, 0.55, 0.07, -s);
    }
    geo.translate(-side / 2, yb, s * (W / 2 - 0.015) - s * DEPTH);
    p.add(m.wall, geo, 0, 0, 0);
  }
  const endH = wallH;
  const blind = corrugatedGeometry(W - 0.28 + 0.02, endH, { crest: 1 });
  blind.rotateY(-Math.PI / 2);
  blind.translate(-L / 2 + 0.015 + DEPTH, yb, -(W - 0.28 + 0.02) / 2);
  p.add(m.wall, blind, 0, 0, 0);
  // The stencilled code on the near side and the end; the approval plate by the doors.
  const stencil = (w, h, x, y, z, ry) => p.add(m.stencil, new THREE.PlaneGeometry(w, h), x, y, z, 0, ry, 0);
  stencil(1.5, 0.375, -1.6, top - 0.35, nearSide * (W / 2 - 0.015 + 0.004), nearSide > 0 ? 0 : Math.PI);
  stencil(1.5, 0.375, -1.6, top - 0.35, -nearSide * (W / 2 - 0.015 + 0.004), nearSide > 0 ? Math.PI : 0);
  stencil(1.1, 0.275, -L / 2 + 0.015 - 0.004, top - 0.5, 0.0, -Math.PI / 2);
  // The leaves hang on pins at each post, the one with the hasp shut, the other swung open; the keepers on the header are where the cams lock, and
  // the approval plate is by the shut leaf.
  const leaves = [
    { dir: -1, z: W / 2 - HINGE_INSET, open: -1.25, hasp: false },
    { dir: 1, z: -(W / 2 - HINGE_INSET), open: 0, hasp: true },
  ];
  for (const l of leaves) p.merge(buildLeaf(m, l.dir, { hasp: l.hasp }), placement(L / 2 + 0.01, 0, l.z, l.open));
  for (const z of [W / 2 - HINGE_INSET - 0.22, W / 2 - HINGE_INSET - 0.85, -(W / 2 - HINGE_INSET - 0.22), -(W / 2 - HINGE_INSET - 0.85)]) p.box(m.dark, 0.06, 0.05, 0.12, L / 2 + 0.01, top - 0.11, z);
  p.add(m.plate, new THREE.PlaneGeometry(0.3, 0.15), L / 2 + 0.036, lift + 0.9, -(W / 2 - HINGE_INSET - 0.5), 0, Math.PI / 2, 0);
  const group = p.build();
  group.name = 'container';
  const boxes = [[0, lift + H / 2 - 0.05, 0, L / 2, H / 2 + 0.05, W / 2]];
  return { group, boxes, nearSide, leaves: leaves.map((l) => l.open) };
}
