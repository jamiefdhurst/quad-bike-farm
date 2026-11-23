import * as THREE from 'three';
import { PART_MAT, box, rustedGalvanised, strawStained, addChain } from './trailerParts.js';
import { rod } from './quadGeometry.js';

// The neighbour's tipping trailer (#925): the farm's own tipper left out in her yard, the same model with what a working dairy farm does to one. Rusting
// galvanised steel with drop-side hinges and catches, straw half filling the tub (stained with silage juice), a tarp tied over the front, the
// jockey wheel wound down onto the concrete and a rear lamp with a cracked lens. `look` is what the farm seed dealt (neighbourFarm.js `dealNeighbourVehicles`):
// { rust 0..1, straw 0..1 (how full of the 0.4 m sides), tarp (a colour), dropSide (-1 or 1: the side let down on its hinges, lying out flat on its chains), seed }. All of it is on top of the model, which the player's trailer is unchanged by.

const REST = 0.45; // radians above level the let-down side rests at, on the mudguard's arc (0.09 m above the tub floor at the guard's outer edge)
export const JOCKEY_DOWN = 0.095; // `addJockeyWheel`'s lift with its little wheel on the ground (its radius 0.065, and 0.03 of hub below its centre)

/** The model's materials with its steel and its tub gone to rust, as clones: the player's trailer keeps the shared ones. */
export function farmTrailerMaterials(base, look) {
  const tub = rustedGalvanised(look.rust, look.seed);
  const tubInner = rustedGalvanised(Math.min(1, look.rust + 0.25), look.seed + 3);
  const steel = base.steel.clone();
  steel.color.lerp(new THREE.Color(0x6a4a36), 0.35 * look.rust); // the black-grey tubes' paint gone, rust through it
  return { ...base, tub, tubInner, steel };
}

/** A tarp laid over a load at the front of the tub, hanging down over the sides: a sheet swept along z, wrinkled, its far edge sloping down. */
function tarpGeometry(halfWidth, sideHeight, z0, z1, seed) {
  const hw = halfWidth;
  // The section across, from the left side's outside, up over the load and down the right: [x, y above the rolled top edge].
  const section = [[-hw - 0.05, -0.16], [-hw - 0.045, -0.03], [-hw + 0.01, 0.07], [-0.34, 0.19], [0, 0.23], [0.34, 0.19], [hw - 0.01, 0.07], [hw + 0.045, -0.03], [hw + 0.05, -0.16]];
  const rows = 9;
  let n = seed * 7919 || 1;
  const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  const positions = [];
  for (let j = 0; j <= rows; j++) {
    const t = j / rows;
    const z = z0 + (z1 - z0) * t;
    const slope = t < 0.8 ? 0 : (t - 0.8) / 0.2; // the back edge falls away over the straw
    for (const [x, y] of section) {
      const high = Math.max(0, y);
      positions.push(x, sideHeight + y - high * 0.55 * slope * slope + (rand() - 0.5) * 0.018, z);
    }
  }
  const per = section.length;
  const index = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < per - 1; i++) {
      const a = j * per + i;
      index.push(a, a + per, a + 1, a + 1, a + per, a + per + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A heap of straw in the tub, between z0 and z1 (tub frame), rising to `height` at its middle and lower at the edges, lumpy on top. */
function strawGeometry(halfWidth, z0, z1, height, seed) {
  const g = new THREE.BoxGeometry(halfWidth * 2, height, z1 - z0, 9, 2, 12);
  let n = seed * 104729 || 1;
  const rand = () => ((n = (n * 16807) % 2147483647) / 2147483647);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < 0) continue;
    const u = p.getX(i) / halfWidth;
    const v = (p.getZ(i) / ((z1 - z0) / 2));
    p.setY(i, p.getY(i) - height * 0.25 * (u * u + 0.3 * v * v * v * v) + (rand() - 0.5) * height * 0.28);
  }
  g.computeVertexNormals();
  g.translate(0, height / 2, (z0 + z1) / 2);
  return g;
}

/**
 * Wears the trailer: `body` is its chassis group, `tub` the tipping tub (tub-local metres, z from the pivot at the back), `lights` the group `addRearLights` made.
 * `hz` turns a trailer-frame z into the tub's, as the model does.
 */
export function addFarmTrailerWear({ body, tub, lights, S, look, mat, hz }) {
  const sideZ0 = hz(S.rearZ) + 0.1;
  const sideZ1 = hz(S.frontZ) - 0.06;
  // Straw, half filling it, rising a little to the front where the tarp goes over.
  const strawMat = strawStained(look.seed);
  const depth = 0.06 + 0.3 * look.straw;
  const straw = new THREE.Mesh(strawGeometry(S.halfWidth - 0.05, sideZ0 + 0.05, sideZ1 - 0.5, depth, look.seed), strawMat);
  straw.name = 'straw';
  tub.add(straw);
  const heap = new THREE.Mesh(strawGeometry(S.halfWidth - 0.056, sideZ1 - 0.56, sideZ1, depth + 0.12, look.seed + 1), strawMat); // the load under the tarp
  heap.name = 'strawHeap';
  tub.add(heap);
  // The tarp over the front, and the baler twine that ties it down: a loop over it each side of the middle, tied off to the sides' rolled top edges.
  const tarpMat = new THREE.MeshStandardMaterial({ color: look.tarp, roughness: 0.85, side: THREE.DoubleSide });
  const tarp = new THREE.Mesh(tarpGeometry(S.halfWidth + 0.01, S.sideHeight + 0.035, sideZ1 - 0.5, sideZ1 + 0.015, look.seed), tarpMat);
  tarp.name = 'tarp';
  tarp.castShadow = true;
  tub.add(tarp);
  const twine = new THREE.MeshStandardMaterial({ color: 0xc86a1c, roughness: 0.9 });
  for (const z of [sideZ1 - 0.36, sideZ1 - 0.12]) {
    const hw = S.halfWidth;
    const top = S.sideHeight + 0.035;
    const pts = [[-hw - 0.03, top - 0.03, z], [-hw + 0.02, top + 0.07, z], [-0.34, top + 0.19, z], [0, top + 0.235, z], [0.34, top + 0.19, z], [hw - 0.02, top + 0.07, z], [hw + 0.03, top - 0.03, z]];
    for (let i = 0; i < pts.length - 1; i++) {
      const m = new THREE.Mesh(rod(pts[i], pts[i + 1], 0.006, 5), twine);
      m.name = 'twine';
      tub.add(m);
    }
  }
  // The drop side let down: the side the model leaves out, hung on the bottom hinge and lying out flat just below it (a few degrees past level) held by a chain to its corner
  // post at each end, with its rolled edge and ribs as the wall's, so it is the wall laid down and not a plank.
  const drop = look.dropSide ?? 0;
  if (drop) {
    const hinge = new THREE.Group();
    hinge.name = 'dropSide';
    hinge.position.set(drop * (S.halfWidth + 0.013), 0.035, (sideZ0 + sideZ1) / 2); // on the hinge's knuckles
    hinge.rotation.z = -drop * (Math.PI / 2 - REST); // propped up on the mudguard, which is above the tub floor: a flat side would cut through wheel and guard
    const len = sideZ1 - sideZ0 + 0.16;
    box(0.04, S.sideHeight, len, mat.tub, 0, S.sideHeight / 2, 0, hinge);
    box(0.07, 0.04, len + 0.04, mat.steel, 0, S.sideHeight, 0, hinge); // a little longer than the wall, as the standing wall's edge is, so their ends share no plane
    for (const y of [0.12, 0.26]) box(0.012, 0.03, len - 0.1, mat.tubInner, drop * 0.022, y, 0, hinge);
    tub.add(hinge);
    for (const z of [sideZ0 + 0.04, sideZ1 - 0.04]) addChain(tub, [drop * (S.halfWidth + 0.013 + 0.4 * Math.cos(REST)), 0.035 + 0.4 * Math.sin(REST), z], [drop * (S.halfWidth + 0.03), S.sideHeight - 0.12, z], 6, 0.03);
  }
  // Drop sides: a hinge along the bottom of each side's outside (three knuckles on a pin), and an over-centre catch at each end of its top edge.
  for (const s of [-1, 1]) {
    const x = s * (S.halfWidth + 0.013); // the knuckles' inner faces are 2 mm into the wall
    tub.add(new THREE.Mesh(rod([x, 0.035, sideZ0], [x, 0.035, sideZ1], 0.007, 6), mat.steel));
    for (const z of [sideZ0 + 0.14, (sideZ0 + sideZ1) / 2, sideZ1 - 0.14]) box(0.03, 0.045, 0.09, mat.steel, x, 0.035, z, tub);
    for (const z of s === drop ? [] : [sideZ0 + 0.02, sideZ1 - 0.02]) { // the let-down side has nothing to catch
      box(0.022, 0.07, 0.044, mat.steel, x - s * 0.004, S.sideHeight - 0.075, z, tub); // the catch's body on the corner post
      box(0.016, 0.012, 0.075, PART_MAT.nut, x + s * 0.012, S.sideHeight - 0.02, z, tub); // and its lever across, over the body's top (clear of its faces)
    }
  }
  // A cracked rear lamp lens each side: pale lines across the clear plastic, and a strip of tape over the left one.
  const crack = new THREE.MeshStandardMaterial({ color: 0xe6dfd2, roughness: 0.4, transparent: true, opacity: 0.85 });
  const tape = new THREE.MeshStandardMaterial({ color: 0x8e8e8a, roughness: 0.5, metalness: 0.4 });
  for (const s of [-1, 1]) {
    const at = [s * (S.halfWidth - 0.12), 0.015, -0.048];
    for (const [dx, dy, a] of [[0, 0, 0.5], [0.025, 0.01, -0.9], [-0.03, -0.008, 1.3], [0.01, -0.016, 0.1]]) {
      const line = box(0.06, 0.003, 0.002, crack, at[0] + dx, at[1] + dy, at[2], lights);
      line.rotation.z = a;
      line.name = 'lampCrack';
    }
  }
  const strip = box(0.1, 0.02, 0.004, tape, -(S.halfWidth - 0.12) - 0.02, 0.02, -0.046, lights);
  strip.rotation.z = 0.35;
  strip.name = 'lampTape';
}
