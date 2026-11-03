// What is dumped by the pit's pond: steel drums and tyres (each one geometry, drawn instanced), and the danger signs along the fence. The geometry is
// pure; `scatterClear` deals out places for the pile so that nothing in it overlaps anything else.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drumTexture, SIGN_SIZE } from './quarryTextures.js';

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

/** A car tyre lying flat, centred on its middle with its axis up: a rounded sidewall, three grooves round the tread and lugs on each shoulder. */
export function tyreGeometry(segments = 24, lugs = 28) {
  const { radius: R } = TYRE;
  // The cross-section from the top bead round the tread to the bottom one; reversed for the lathe, which wants y rising to face outwards.
  const prof = [[0.19, 0.075], [0.2, 0.093], [0.24, 0.1], [0.275, 0.095], [0.298, 0.082], [R - 0.006, 0.065], [R, 0.058]];
  for (const y of [0.032, 0, -0.032]) prof.push([R, y + 0.012], [R - 0.011, y + 0.008], [R - 0.011, y - 0.008], [R, y - 0.012]);
  prof.push([R, -0.058], [R - 0.006, -0.065], [0.298, -0.082], [0.275, -0.095], [0.24, -0.1], [0.2, -0.093], [0.19, -0.075]);
  const geos = [new THREE.LatheGeometry(prof.reverse().map(([r, y]) => new THREE.Vector2(r, y)), segments)];
  for (let i = 0; i < lugs; i++) {
    const a = (i / lugs) * Math.PI * 2;
    for (const y of [0.045, -0.045]) geos.push(new THREE.BoxGeometry(0.02, 0.02, 0.034).applyMatrix4(new THREE.Matrix4().makeRotationY(-a).setPosition(Math.cos(a) * (R + 0.002), y, Math.sin(a) * (R + 0.002))));
  }
  return mergeGeometries(geos, false);
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

/** The pile's materials: drums in a handful of faded colours, and a tyre's black rubber. */
export function debrisMaterials(random) {
  const map = drumTexture(random);
  const drum = (color) => new THREE.MeshStandardMaterial({ map, color, roughness: 0.6, metalness: 0.25 });
  return {
    drums: [drum(0x3a68a8), drum(0x4a8a52), drum(0xb04a36), drum(0x93684a), drum(0x888d90)],
    tyre: new THREE.MeshStandardMaterial({ color: 0x1d1d1c, roughness: 0.95 }),
  };
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
