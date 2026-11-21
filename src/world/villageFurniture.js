// The village's street furniture (world/villageProps.js): cast-iron lamp posts, the speed limit and village signs, the red telephone kiosk and a street bench. Each
// piece is joined to what it stands on or hangs from (#539, #537): a lamp's head is hung from its arm and the arm sunk into the post, a sign's plate is clamped
// to its post, a bench's seat and back are bolted to its ends. All procedural, with colliders; `ctx` is the village's (villageProps.js).

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { villageSignTexture, limitSignTexture, fasciaTexture, noticeTexture } from './villageTextures.js';
import { nationalLimitTexture } from './roadSigns.js';
import { signMaterial } from './villageBuildings.js';
import { approachSignSpecs } from './village.js';

/** A mesh at (px, py, pz) in group `g`. */
const put = (g, geo, mat, px, py, pz) => {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(px, py, pz);
  g.add(o);
  return o;
};

/** A thin rod of `r` radius from local point `a` to local point `b` in group `g`. */
function rod(g, mat, a, b, r) {
  const d = new THREE.Vector3().subVectors(new THREE.Vector3(...b), new THREE.Vector3(...a));
  const mid = new THREE.Vector3(...a).add(d.clone().multiplyScalar(0.5));
  const o = put(g, new THREE.CylinderGeometry(r, r, d.length(), 6), mat, mid.x, mid.y, mid.z);
  o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return o;
}

/**
 * A cast-iron lamp post at (x, z) with its arm over the road: a fluted base, a tapering post that runs up through the arm's root, a strut under the arm, and the lantern
 * hung from the arm's end on a rod, with a cap over it. Nothing hangs in the air: the arm is sunk into the post, the rod into the arm and the lantern's cap.
 */
export function lampPost(ctx, x, z, towards) {
  const { M, heights } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.atan2(towards.x - x, towards.z - z);
  put(g, new THREE.CylinderGeometry(0.17, 0.2, 0.8, 8), M.iron, 0, 0.3, 0); // the base, sunk 0.1 below the ground
  put(g, new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), M.iron, 0, 0.72, 0);
  put(g, new THREE.CylinderGeometry(0.06, 0.11, 3.5, 8), M.iron, 0, 2.45, 0); // the post, 0.7 to 4.2
  put(g, new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8), M.iron, 0, 4.2, 0); // its cap
  put(g, new THREE.SphereGeometry(0.06, 8, 6), M.iron, 0, 4.26, 0);
  const armY = 3.95;
  const reach = 0.9;
  rod(g, M.iron, [0, armY, 0], [0, armY, reach + 0.04], 0.025); // the arm, starting inside the post
  rod(g, M.iron, [0, armY - 0.55, 0], [0, armY - 0.02, reach * 0.62], 0.022); // the strut from the post up under the arm
  rod(g, M.iron, [0, armY - 0.2, reach], [0, armY + 0.02, reach], 0.014); // the hanger from the arm down to the lantern's cap
  put(g, new THREE.ConeGeometry(0.2, 0.15, 6), M.iron, 0, armY - 0.27, reach); // the cap, over the lantern
  put(g, new THREE.CylinderGeometry(0.14, 0.09, 0.3, 6), M.lampGlow, 0, armY - 0.44, reach); // the lantern, its top under the cap's rim
  put(g, new THREE.CylinderGeometry(0.1, 0.1, 0.03, 6), M.iron, 0, armY - 0.6, reach); // its foot
  ctx.furniture.add(g);
  ctx.fixedBox(x, y + 1.6, z, 0.14, 1.6, 0.14);
}

/**
 * A sign on a post at (x, z), its face turned to look along `yaw` (0 looks south, +z): a round limit sign, a board or a roadside notice. The plate is clamped to the
 * post by two straps, and `back` is what the other side shows (the national speed limit on a limit sign, for traffic leaving), the grey metal if none.
 */
export function signPost(ctx, x, z, yaw, texture, w, h, { height = 2.1, round = false, back = null } = {}) {
  const { M, heights } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  put(g, new THREE.CylinderGeometry(0.035, 0.04, height + 0.3, 8), M.lead, 0, (height + 0.3) / 2 - 0.1, 0);
  const cy = height - h / 2 + 0.1;
  const geo = () => (round ? new THREE.CircleGeometry(w / 2, 24) : new THREE.PlaneGeometry(w, h));
  const faceMat = (tex) => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: 0.1 });
  put(g, geo(), faceMat(texture), 0, cy, 0.047);
  const rear = put(g, geo(), back ? faceMat(back) : M.lead, 0, cy, -0.047);
  rear.rotation.y = Math.PI;
  put(g, round ? new THREE.CylinderGeometry(w / 2 + 0.012, w / 2 + 0.012, 0.09, 28) : new THREE.BoxGeometry(w + 0.024, h + 0.024, 0.09), M.lead, 0, cy, 0).rotation.x = round ? Math.PI / 2 : 0; // the plate's body
  for (const dy of [-h * 0.25, h * 0.25]) put(g, new THREE.BoxGeometry(0.1, 0.035, 0.12), M.lead, 0, cy + dy, 0); // the straps clamping it to the post
  ctx.furniture.add(g);
  ctx.fixedBox(x, y + 1, z, 0.08, 1.1, 0.08);
}

/**
 * The village sign at (x, z), its face looking along `yaw`: a painted board hung between two posts under a little pitched roof that sits on their tops, with a stone
 * planter of flowers in front (the flowers are #540's). The board's lettering is fitted to it (`villageSignTexture`).
 */
export function villageSignAt(ctx, x, z, yaw) {
  const { M, S, heights, random } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const box = (w, h, d, mat, px, py, pz) => put(g, worldBox(w, h, d, 0.6), mat, px, py, pz);
  for (const sx of [-1, 1]) {
    box(0.14, 3.5, 0.14, M.timber, sx * 1.1, 1.75, 0); // the posts, up into the roof's ridge board
    box(0.22, 0.1, 0.22, M.stone, sx * 1.1, 0.05, 0); // a stone footing
  }
  box(2.5, 0.16, 0.16, M.timber, 0, 2.6, 0); // the head rail the board hangs from
  box(2.5, 0.12, 0.16, M.timber, 0, 0.7, 0); // and the sill under it
  box(2.1, 1.4, 0.12, M.paintDark, 0, 1.65, 0); // the board's frame
  for (const s of [-1, 1]) {
    const face = put(g, new THREE.PlaneGeometry(1.95, 1.3), signMaterial(ctx, villageSignTexture(random, S.name), 0.2), 0, 1.65, s * 0.063);
    if (s < 0) face.rotation.y = Math.PI;
  }
  // The roof: two boards in a ridge, each from the ridge down to an eave over the posts, the posts' tops inside them, with a ridge board and the gable boards.
  const rise = 0.55;
  const half = 0.62;
  const ang = Math.atan2(rise, half);
  const slope = Math.hypot(half, rise) + 0.1;
  for (const s of [-1, 1]) {
    const slab = put(g, worldBox(2.9, 0.07, slope, 1), M.clay, 0, 2.95 + rise / 2 - 0.02, s * half / 2);
    slab.rotation.x = s * ang;
  }
  put(g, new THREE.BoxGeometry(2.95, 0.1, 0.1), M.timber, 0, 2.95 + rise + 0.02, 0);
  for (const sx of [-1, 1]) {
    const gable = new THREE.Shape([new THREE.Vector2(-half, 0), new THREE.Vector2(half, 0), new THREE.Vector2(0, rise)]);
    const geo = new THREE.ExtrudeGeometry(gable, { depth: 0.05, bevelEnabled: false });
    put(g, geo, M.timber, sx * 1.4, 2.93, 0).rotation.y = Math.PI / 2;
  }
  // The planter: a stone trough of soil with a rim, the plants sunk in it.
  box(2.4, 0.34, 0.8, M.stone, 0, 0.17, 0.95);
  box(2.2, 0.08, 0.6, M.bark, 0, 0.36, 0.95);
  for (let k = 0; k < 9; k++) put(g, new THREE.IcosahedronGeometry(0.17, 0), M.leaf, -1 + k * 0.25, 0.46, 0.95 + ((k % 2) - 0.5) * 0.25);
  for (let k = 0; k < 14; k++) put(g, new THREE.IcosahedronGeometry(0.08, 0), M.blooms[k % 4], -1 + (k * 2) / 13, 0.58 + (k % 3) * 0.04, 0.95 + ((k % 2) - 0.5) * 0.2);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 0.8, z, 1.3, 0.8, 0.9);
}

/**
 * The red telephone kiosk (a K6): a cast frame on a concrete base with three columns of eight small panes on each face, a red kick panel, a top panel with the lit
 * TELEPHONE sign and a crown, a domed top, a door with its long handle, and inside a shelf, the handset on its cord and a notice. The door faces `faces` (0 south).
 */
export function phoneBox(ctx, at, faces = Math.PI) {
  const { M, heights, random } = ctx;
  const { x, z } = at;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = faces;
  const w = 0.95;
  const h = 2.4;
  const half = w / 2;
  put(g, worldBox(w + 0.14, 0.2, w + 0.14, 1), M.concrete, 0, 0.0, 0); // the base, sunk
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) put(g, new THREE.BoxGeometry(0.08, h, 0.08), M.red, sx * half, h / 2 + 0.05, sz * half); // the corner columns
  const sign = signMaterial(ctx, fasciaTexture(random, { text: 'TELEPHONE', bg: '#f3eedb', fg: '#202020', accent: '#b4141b', width: 512, height: 128, font: 'bold 64px Arial, Helvetica, sans-serif' }), 0.8);
  for (let side = 0; side < 4; side++) {
    const f = new THREE.Group();
    f.rotation.y = (side * Math.PI) / 2;
    g.add(f);
    const o = half - 0.01;
    put(f, new THREE.BoxGeometry(w, 0.3, 0.05), M.red, 0, 0.3, o); // the kick panel
    put(f, new THREE.BoxGeometry(w, 0.38, 0.06), M.red, 0, 2.17, o); // the top panel
    put(f, new THREE.BoxGeometry(w, 0.06, 0.05), M.red, 0, 0.5, o); // the bottom rail of the glazing
    put(f, new THREE.PlaneGeometry(w - 0.1, 1.64), M.clear, 0, 1.32, o - 0.02); // the glass
    for (const bx of [-w / 6, w / 6]) put(f, new THREE.BoxGeometry(0.025, 1.64, 0.035), M.red, bx, 1.32, o); // the two inner columns
    for (let r = 1; r < 8; r++) put(f, new THREE.BoxGeometry(w - 0.06, 0.02, 0.03), M.red, 0, 0.5 + (1.64 / 8) * r + 0.0, o); // the glazing bars
    const plate = put(f, new THREE.PlaneGeometry(0.6, 0.15), sign, 0, 2.2, o + 0.035);
    plate.userData.lit = true;
    // The crown over the sign: a little band with three points, in brass.
    put(f, new THREE.BoxGeometry(0.2, 0.04, 0.02), M.brass, 0, 2.32, o + 0.035);
    for (const cx of [-0.07, 0, 0.07]) put(f, new THREE.ConeGeometry(0.025, 0.07, 4), M.brass, cx, 2.37, o + 0.035);
  }
  // The door on the front face: the frame is on the face above; its long handle stands off the edge on two stays.
  put(g, new THREE.CylinderGeometry(0.014, 0.014, 0.55, 6), M.brass, half - 0.1, 1.15, half + 0.08);
  for (const hy of [0.9, 1.4]) put(g, new THREE.BoxGeometry(0.02, 0.02, 0.08), M.brass, half - 0.1, hy, half + 0.04);
  put(g, new THREE.BoxGeometry(w + 0.2, 0.14, w + 0.2), M.red, 0, h + 0.05, 0); // the cornice
  const dome = put(g, new THREE.SphereGeometry(0.66, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.red, 0, h + 0.1, 0);
  dome.scale.set(1, 0.28, 1);
  // Inside: the shelf, the telephone, its handset and cord, and a notice.
  put(g, new THREE.BoxGeometry(0.5, 0.04, 0.2), M.iron, 0, 1.0, -half + 0.1); // the shelf, its back edge in the wall's glazing bars
  put(g, new THREE.BoxGeometry(0.22, 0.22, 0.1), M.iron, 0, 1.12, -half + 0.08); // the telephone's body on it
  put(g, new THREE.BoxGeometry(0.05, 0.2, 0.05), M.iron, -0.15, 1.2, -half + 0.08); // the handset on its cradle
  put(g, new THREE.TorusGeometry(0.06, 0.008, 4, 10, Math.PI), M.iron, -0.15, 1.1, -half + 0.08); // and its cord, looped down to the shelf
  put(g, new THREE.PlaneGeometry(0.25, 0.3), new THREE.MeshStandardMaterial({ map: noticeTexture(random, 'EMERGENCY', 4), roughness: 0.6 }), 0.28, 1.5, -half + 0.025);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1.25, z, 0.5, 1.25, 0.5);
}

/** A street bench at (x, z) facing along `yaw` (0 south): two cast ends running from the ground up to the backrest, a slatted seat and back bolted through them. */
export function streetBench(ctx, at, yaw = 0) {
  const { M, heights } = ctx;
  const { x, z } = at;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  for (const sx of [-1, 1]) {
    put(g, new THREE.BoxGeometry(0.06, 0.5, 0.5), M.iron, sx * 0.78, 0.2, 0); // the leg and seat support
    put(g, new THREE.BoxGeometry(0.06, 0.5, 0.06), M.iron, sx * 0.78, 0.62, -0.22).rotation.x = -0.18; // the back's upright, leaning
    put(g, new THREE.BoxGeometry(0.06, 0.06, 0.5), M.iron, sx * 0.78, 0.46, 0); // the arm rest/seat rail
    put(g, new THREE.BoxGeometry(0.12, 0.04, 0.5), M.iron, sx * 0.78, -0.03, 0); // the foot
  }
  for (const dz of [-0.17, 0, 0.17]) put(g, worldBox(1.7, 0.04, 0.14, 0.6), M.weathered, 0, 0.5, dz);
  for (const dy of [0.68, 0.84]) {
    const slat = put(g, worldBox(1.7, 0.12, 0.03, 0.6), M.weathered, 0, dy, -0.25 - (dy - 0.5) * 0.18);
    slat.rotation.x = -0.18;
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 0.45, z, 0.9, 0.45, 0.3);
}

/** A limit disc on a post: `front` and `back` are mph, or 'national' for the national speed limit disc. */
export function limitPost(ctx, spec) {
  const tex = (v) => (v === 'national' ? nationalLimitTexture() : limitSignTexture(v));
  signPost(ctx, spec.x, spec.z, spec.yaw, tex(spec.front), 0.75, 0.75, { round: true, height: 2.2, back: tex(spec.back) });
}

/** The 30 mph signs and the village signs on the lane's approach to Nether Thornby (`approachSignSpecs`). */
export function approachSigns(ctx) {
  for (const s of approachSignSpecs(ctx.S.v)) {
    if (s.village) villageSignAt(ctx, s.x, s.z, s.yaw);
    else limitPost(ctx, s);
  }
}
