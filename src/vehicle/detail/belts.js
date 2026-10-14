import * as THREE from 'three';
import { cabMats, mesh, merge, rounded } from './parts.js';
import { cablePath } from './cables.js';

// Seat belts (TODO 340): webbing as a flat strip, the inertia reel low on the pillar, the D-loop at the shoulder, the tongue, and the
// buckle on its stalk. A belt group has a `stowed` and a `worn` child, as the game's belt poser (poseUtvBelts) expects; the pure
// part is where the webbing runs across someone sat in the seat (`beltRun`, tested).

/**
 * Where a worn belt runs, from the shoulder mount `top` across the chest to the `buckle`, and the lap part from the sill anchor
 * `low` to the buckle: points [x, y, z] in the vehicle's frame, laid over a person sat with their hips at `hip` (the seat point).
 * Returns { diagonal, lap }.
 */
export function beltRun({ top, low, buckle, hip }) {
  const [hx, hy, hz] = hip;
  const across = (t) => low[0] + (buckle[0] - low[0]) * t;
  // Over the shoulder (forward of the mount and down), across the chest to the far hip; the lap over the thighs.
  const diagonal = [top, [top[0] + (hx - top[0]) * 0.35, hy + 0.58, hz + 0.08], [hx, hy + 0.42, hz + 0.17], [buckle[0] * 0.6 + hx * 0.4, hy + 0.2, hz + 0.15], buckle];
  const lap = [low, [across(0.3), hy + 0.1, hz + 0.12], [across(0.7), hy + 0.1, hz + 0.13], buckle];
  return { diagonal: cablePath(diagonal, { sag: 0, steps: 4 }), lap: cablePath(lap, { sag: 0, steps: 4 }) };
}

/**
 * A flat strip `width` wide and `thick` thick along `points`, its flat face turned towards `face` ([x, y, z]: the way it lies,
 * forward for a belt across a chest). Webbing, straps, a fan belt.
 */
export function ribbonGeometry(points, width, thick, face = [0, 0, 1]) {
  const pts = points.map((p) => new THREE.Vector3(...p));
  const f = new THREE.Vector3(...face).normalize();
  const pos = [];
  const idx = [];
  const T = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    T.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(T, f);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(side, T).normalize();
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = pts[i].clone().addScaledVector(side, (a * width) / 2).addScaledVector(up, (b * thick) / 2);
      pos.push(p.x, p.y, p.z);
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      idx.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A lap-and-diagonal belt for one seat, named `belt_<name>` with `stowed` (hanging down the pillar from the D-loop, the tongue
 * loose at the reel) and `worn` (across the person) children, the worn one hidden. `top`: the D-loop on the pillar; `low`: the
 * reel and sill anchor; `buckle`: the buckle's top on the seat's inner side; `hip`: the seat point. `lapOnly` gives a plain lap belt
 * (a back seat's middle, an old Land Rover's). The D-loop, reel and buckle are added to the group itself, outside both.
 */
export function buildSeatBelt(name, { top, low, buckle, hip, lapOnly = false, mats = {} }) {
  const m = { ...cabMats(), ...mats };
  const web = mats.webbing ?? m.webbing;
  const group = new THREE.Group();
  group.name = `belt_${name}`;
  group.userData.keep = true;
  const stowed = new THREE.Group();
  stowed.name = 'stowed';
  const worn = new THREE.Group();
  worn.name = 'worn';
  worn.visible = false;
  group.add(stowed, worn);
  const out = Math.sign(top[0] - hip[0]) || 1; // which way the pillar is
  const face = [out, 0, 0]; // hanging down the pillar it lies flat against it
  if (!lapOnly) mesh(ribbonGeometry([top, [low[0], low[1] + 0.08, low[2]]], 0.046, 0.003, face), web, stowed, 'beltWebbing');
  mesh(rounded(0.03, 0.05, 0.008, 0.003).translate(low[0] - out * 0.01, low[1] + 0.1, low[2]), m.steel, stowed, 'beltTongue');
  const run = beltRun({ top, low, buckle, hip });
  const worns = [ribbonGeometry(run.lap, 0.046, 0.003, [0, 1, 0.4])];
  if (!lapOnly) worns.push(ribbonGeometry(run.diagonal, 0.046, 0.003, [0, 0.3, 1]));
  mesh(merge(worns), web, worn, 'beltWorn');
  // The fixed parts: the D-loop at the shoulder, the reel at the bottom of the pillar, the buckle on its stalk.
  if (!lapOnly) mesh(rounded(0.05, 0.03, 0.02, 0.008).translate(...top), m.plastic, group, 'beltLoop');
  mesh(rounded(0.06, 0.09, 0.05, 0.01).translate(low[0], low[1], low[2]), m.plastic, group, 'beltReel');
  mesh(rounded(0.035, 0.07, 0.03, 0.008).translate(buckle[0], buckle[1] - 0.03, buckle[2]), m.plastic, group, 'beltBuckle');
  mesh(rounded(0.024, 0.012, 0.022, 0.004).translate(buckle[0], buckle[1] + 0.008, buckle[2]), mats.button ?? m.red, group, 'beltButton');
  mesh(ribbonGeometry([[buckle[0], buckle[1] - 0.06, buckle[2]], [buckle[0], buckle[1] - 0.16, buckle[2] - 0.02]], 0.03, 0.004, [out, 0, 0]), m.plastic, group, 'beltStalk');
  return group;
}
