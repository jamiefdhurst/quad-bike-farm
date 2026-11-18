// The woodpile's scenery at Hollow Wood's gate (#683): an old stack of split logs under a timber lean-to against the south hedge, and the chopping block
// with its axe and the chips round it. It stands on every farm that has the wood, tractor or not; the working stack, the rounds and the splitter
// (items/logSplitter.js) are the tractor's and are added to the same yard when it is there. Placed from `layout.logYard.scenery`, which is the lean-to
// (`x`, `z` its middle against the hedge, `length` along the hedge, `depth` out from it) and the block, as offsets from the yard's anchor.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { enableShadows } from './assets.js';
import { corrugatedTexture, worldBox } from './outbuildingProps.js';
import { barkTexture, logEndTexture, woodTexture } from './neighbourTextures.js';

const BACK_HEIGHT = 2.55; // m: the lean-to's back plate, against the hedge
const FRONT_HEIGHT = 2.0; // m: its front plate, on the open side
const POST_R = 0.07;
const LOG_LENGTH = 0.33; // m, the same as the working stack's logs (items/logSplitter.js `STACK_SHAPE`)

/** The roof plane's height at `z` (the plates' line: the back plate is at -z, against the hedge) in a lean-to `depth` m deep. */
const roofY = (z, depth) => (BACK_HEIGHT + FRONT_HEIGHT) / 2 - (z * (BACK_HEIGHT - FRONT_HEIGHT)) / depth;

const tinted = (geo, rgb) => {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set(rgb, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
};

/** A round post or a stick from a to b (Vector3s), `sides` faces round. */
function stick(a, b, r0, r1 = r0, sides = 7) {
  const len = a.distanceTo(b);
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}

/** A sawn timber box `w` by `h` by `d` at (x, y, z), turned `rx` about x and `ry` about y. */
function timber(w, h, d, x, y, z, rx = 0, ry = 0) {
  const geo = worldBox(w, h, d, 1);
  if (rx) geo.rotateX(rx);
  if (ry) geo.rotateY(ry);
  return geo.translate(x, y, z);
}

/**
 * A split log with its ends towards +z: five or six sides, a rough wedge, `r` m across. Returns the `side` (bark) and the two `caps` (the cut ends, in the
 * cut-wood texture) as separate geometries, since a merged mesh can't tell its logs' ends from their sides (three's merge numbers a group per geometry);
 * `tint` greys it for how long it has lain.
 */
function splitLog(random, x, y, z, r, tint) {
  const radial = 5 + (random() < 0.4 ? 1 : 0);
  const len = LOG_LENGTH * (0.85 + random() * 0.3);
  const rTop = r * (0.85 + random() * 0.3);
  const spin = random() * Math.PI * 2;
  const side = new THREE.CylinderGeometry(rTop, r, len, radial, 1, true).rotateX(Math.PI / 2).rotateZ(spin);
  const front = new THREE.CircleGeometry(rTop, radial).rotateZ(spin).translate(0, 0, len / 2 + 0.002);
  const back = new THREE.CircleGeometry(r, radial).rotateY(Math.PI).rotateZ(spin).translate(0, 0, -len / 2 - 0.002);
  const caps = mergeGeometries([front, back]);
  return { side: tinted(side, tint).translate(x, y, z), caps: tinted(caps, tint).translate(x, y, z) };
}

/** The old stack's faces of logs laid in rows on its core: `side` and `caps` geometries, for the bark's material and the cut wood's. */
function oldStack(random, { width, height, z, y0 }) {
  const sides = [];
  const caps = [];
  const spacing = 0.185;
  const cols = Math.floor(width / spacing);
  const rows = Math.floor(height / spacing);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const stagger = row % 2 ? spacing / 2 : 0;
      const x = (col - (cols - 1) / 2) * spacing + stagger - spacing / 4 + (random() - 0.5) * 0.03;
      const age = 0.55 + random() * 0.4;
      const grey = [age * (0.9 + random() * 0.1), age * 0.92, age * (0.8 + random() * 0.1)];
      const log = splitLog(random, x, y0 + 0.1 + row * spacing * 0.95, z + (random() - 0.5) * 0.06, 0.06 + random() * 0.04, grey);
      sides.push(log.side);
      caps.push(log.caps);
    }
  }
  return { side: mergeGeometries(sides), caps: mergeGeometries(caps) };
}

/** Corrugated roof sheets laid across the rafters, lapped, with the front one overhanging the open side. */
function roofSheets(random, length, depth, slope) {
  const parts = [];
  const sheets = Math.ceil(length / 1.1);
  const span = depth / Math.cos(slope) + 0.6;
  const sheetW = length / sheets + 0.12;
  for (let i = 0; i < sheets; i++) {
    const x = -length / 2 + (i + 0.5) * (length / sheets);
    const geo = worldBox(sheetW, 0.03, span, 1.2, 3);
    geo.rotateX(slope);
    // Each sheet a few millimetres above the one before it where they lap, so the laps don't flicker.
    parts.push(geo.translate(x, roofY(0.05, depth) + 0.175 + (i % 2) * 0.012, 0.05));
  }
  return mergeGeometries(parts);
}

/** The lean-to's frame: posts, plates, rafters, purlins, bracing and a front board; one mesh of timber. */
function leanToFrame(random, length, depth) {
  const parts = [];
  const xs = [-length / 2, 0, length / 2];
  const back = -depth / 2;
  const front = depth / 2;
  for (const x of xs) {
    parts.push(stick(new THREE.Vector3(x, -0.35, back), new THREE.Vector3(x, BACK_HEIGHT, back), POST_R * 1.1, POST_R));
    if (x !== 0) parts.push(stick(new THREE.Vector3(x, -0.35, front), new THREE.Vector3(x, FRONT_HEIGHT, front), POST_R * 1.1, POST_R));
  }
  parts.push(timber(length + 0.3, 0.1, 0.1, 0, BACK_HEIGHT - 0.02, back)); // the plates along the top of each row of posts
  parts.push(timber(length + 0.3, 0.1, 0.1, 0, FRONT_HEIGHT - 0.02, front));
  const slope = Math.atan2(BACK_HEIGHT - FRONT_HEIGHT, depth);
  const rafterLen = depth / Math.cos(slope) + 0.5;
  for (let i = 0; i < 5; i++) {
    const x = -length / 2 + (i * length) / 4;
    parts.push(timber(0.06, 0.1, rafterLen, x, roofY(0.1, depth) + 0.06, 0.1, slope));
  }
  for (let i = 0; i < 3; i++) {
    const z = -depth / 2 + 0.1 + (i * (depth - 0.2)) / 2;
    parts.push(timber(length + 0.3, 0.05, 0.07, 0, roofY(z, depth) + 0.135, z)); // purlins across the rafters
  }
  for (const x of [-length / 2, length / 2]) {
    const sign = x < 0 ? 1 : -1;
    parts.push(stick(new THREE.Vector3(x, BACK_HEIGHT - 0.6, back + 0.02), new THREE.Vector3(x + sign * 0.55, BACK_HEIGHT - 0.02, back + 0.02), 0.035)); // corner braces to the plate
    parts.push(stick(new THREE.Vector3(x, FRONT_HEIGHT - 0.55, front + 0.02), new THREE.Vector3(x + sign * 0.5, FRONT_HEIGHT - 0.02, front + 0.02), 0.035));
  }
  parts.push(timber(length + 0.4, 0.16, 0.025, 0, FRONT_HEIGHT + 0.03, front + 0.3)); // the board along the eaves
  return mergeGeometries(parts);
}

/** The chopping block with its axe: a stump, its top split and scarred, the axe stood in it, chips and split logs round it. */
function choppingBlock(random, materials) {
  const group = new THREE.Group();
  const stump = tinted(new THREE.CylinderGeometry(0.26, 0.3, 0.55, 12, 1), [0.85, 0.82, 0.78]);
  const top = new THREE.Mesh(stump, [materials.bark, materials.end, materials.end]);
  top.position.y = 0.275;
  group.add(top);
  // The axe, head buried in the top and the helve leaning off it.
  const steel = new THREE.MeshStandardMaterial({ color: 0x5b5f63, roughness: 0.55, metalness: 0.7 });
  const helve = new THREE.Mesh(stick(new THREE.Vector3(0.02, 0.5, 0.0), new THREE.Vector3(0.62, 0.78, 0.18), 0.03, 0.022, 6), materials.helve);
  const head = new THREE.Mesh(timber(0.05, 0.12, 0.17, 0, 0, 0), steel);
  head.position.set(0.07, 0.5, 0.0);
  head.rotation.z = 0.22;
  group.add(helve, head);
  // Split logs lying where they fell, and chips of every size across the ground, some sunk in.
  const sides = [];
  const caps = [];
  for (let i = 0; i < 6; i++) {
    const a = random() * Math.PI * 2;
    const d = 0.6 + random() * 0.8;
    const log = splitLog(random, 0, 0.06, 0, 0.07 + random() * 0.03, [0.8, 0.76, 0.7]);
    const turn = random() * 3;
    for (const [geo, list] of [[log.side, sides], [log.caps, caps]]) list.push(geo.rotateY(turn).translate(Math.cos(a) * d, 0, Math.sin(a) * d));
  }
  for (const [geo, material] of [[mergeGeometries(sides), materials.bark], [mergeGeometries(caps), materials.end]]) {
    const lying = new THREE.Mesh(geo, material);
    lying.userData.noShadow = true;
    group.add(lying);
  }
  const chips = [];
  for (let i = 0; i < 46; i++) {
    const a = random() * Math.PI * 2;
    const d = 0.35 + random() * random() * 1.5;
    const s = 0.02 + random() * 0.04;
    const geo = new THREE.BoxGeometry(s * 2.4, s * 0.3, s);
    geo.rotateY(random() * Math.PI);
    const shade = 0.45 + random() * 0.3; // fresh chips go grey and brown on the ground within a week or two
    chips.push(tinted(geo, [shade * 0.95, shade * 0.72, shade * 0.46]).translate(Math.cos(a) * d, 0.012, Math.sin(a) * d));
  }
  const chipMesh = new THREE.Mesh(mergeGeometries(chips), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  chipMesh.userData.noShadow = true;
  group.add(chipMesh);
  return group;
}

/** Builds the scenery, a group named `logYardScenery`, with a collider for the stack, the posts and the block. `c` is the props context (props.js). */
export function buildLogYardScenery(c) {
  const spot = c.layout.logYard?.scenery;
  if (!spot) return null;
  const { scene, heights, fixedBox, random } = c;
  const group = new THREE.Group();
  group.name = 'logYardScenery';
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(random), roughness: 1, vertexColors: true });
  const end = new THREE.MeshStandardMaterial({ map: logEndTexture(random), roughness: 0.95, vertexColors: true });
  const dark = new THREE.MeshStandardMaterial({ map: woodTexture(random, [58, 42, 30]), roughness: 1, vertexColors: false });
  const plain = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 92, 64]), roughness: 1 });
  const sheet = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#8d8c86', 0.7), roughness: 0.75, metalness: 0.35 });
  const { leanTo, block } = spot;
  const L = leanTo.length;
  const D = leanTo.depth;
  const y0 = heights.heightAt(leanTo.x, leanTo.z);

  const shed = new THREE.Group();
  shed.position.set(leanTo.x, y0, leanTo.z);
  shed.rotation.y = leanTo.yaw;
  shed.add(new THREE.Mesh(leanToFrame(random, L, D), dark));
  shed.add(new THREE.Mesh(roofSheets(random, L, D, Math.atan2(BACK_HEIGHT - FRONT_HEIGHT, D)), sheet));
  // Two timber bearers the stack stands on, and the dark body of it behind its faces.
  const stackZ = -D / 2 + 0.95;
  const stackW = L - 0.7;
  const stackH = 1.55;
  shed.add(new THREE.Mesh(mergeGeometries([timber(stackW, 0.12, 0.14, 0, -0.04, stackZ - 0.45), timber(stackW, 0.12, 0.14, 0, -0.04, stackZ + 0.1)]), plain));
  shed.add(new THREE.Mesh(timber(stackW, stackH, 0.8, 0, 0.02 + stackH / 2, stackZ - 0.3, 0, 0), new THREE.MeshStandardMaterial({ map: barkTexture(random), roughness: 1, color: 0xb0a698 })));
  const faces = oldStack(random, { width: stackW, height: stackH, z: stackZ + 0.18, y0: 0 });
  shed.add(new THREE.Mesh(faces.side, bark), new THREE.Mesh(faces.caps, end));
  group.add(shed);

  const stump = choppingBlock(random, { bark, end, helve: plain });
  stump.position.set(block.x, heights.heightAt(block.x, block.z), block.z);
  stump.rotation.y = 0.5;
  group.add(stump);

  enableShadows(group);
  group.traverse((o) => {
    if (o.userData.noShadow) o.castShadow = false;
  });
  scene.add(group);

  // You can't ride through the stack, the lean-to's posts or the block.
  const cos = Math.cos(leanTo.yaw);
  const sin = Math.sin(leanTo.yaw);
  const at = (lx, lz) => [leanTo.x + lx * cos + lz * sin, leanTo.z - lx * sin + lz * cos];
  const [sx, sz] = at(0, stackZ - 0.2);
  fixedBox(sx, y0 + stackH / 2, sz, stackW / 2, stackH / 2, 0.5, leanTo.yaw);
  for (const [lx, lz] of [[-L / 2, -D / 2], [L / 2, -D / 2], [-L / 2, D / 2], [L / 2, D / 2]]) {
    const [px, pz] = at(lx, lz);
    fixedBox(px, y0 + 1, pz, POST_R, 1, POST_R, 0);
  }
  fixedBox(block.x, heights.heightAt(block.x, block.z) + 0.275, block.z, 0.27, 0.275, 0.27, 0);
  return group;
}
