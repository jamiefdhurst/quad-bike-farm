// The shepherd's hut as you see it (world/hut.js says where things are): a wheeled hut of painted boards under a rusty curved tin roof, on iron
// wheels with a drawbar propped on a stone, a half-stable door at the end with wooden steps, one small window, a stovepipe through the roof;
// inside, a bunk across the far end, a black cast-iron stove with a kettle on it, a shelf with a mug and a tin, and a rag rug. Procedural, with
// canvas textures from the kits, and colliders for the walls, floor, steps, wheels and drawbar. The hut's local frame is hut.js's: +z is the door end.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { worldBox, corrugatedTexture, canvasTexture } from './outbuildingProps.js';
import { woodTexture, paintedTexture } from './neighbourTextures.js';
import { HUT_INSIDE, hutShape } from './hut.js';
import { createRandom } from '../core/random.js';

const WALL = 0.07; // board thickness, with the framing behind it
const ROOF_RISE = 0.6; // how high the curved roof's middle stands above its eaves
const ROOF_HALF = 1.25; // half the roof's span: the walls are 1.1 either side, so it overhangs 0.15
const EAVES = 2.3; // the roof's edge above the ground
const END_GAP = 0.006; // the side walls stop this short of the end walls' outer faces, so their end faces are never on the same plane
const DOOR_W = 0.85;
const DOOR_H = 1.75; // above the floor
const WINDOW = { z: 0.45, w: 0.5, y0: 0.95, y1: 1.5 }; // on the -x wall: z along the hut, y above the floor

const mat = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.9, ...extra });
const plain = (color, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

/** The roof's height above the ground at `x` across the hut: an arc through the eaves (at ±ROOF_HALF) and the crown. */
export function roofY(x) {
  const a = ROOF_HALF;
  const r = (a * a + ROOF_RISE * ROOF_RISE) / (2 * ROOF_RISE);
  return EAVES + ROOF_RISE - r + Math.sqrt(r * r - x * x);
}

/** A curved sheet along z: the arc across x from -a to a at `lift` m below the roof, from z0 to z1. u runs along the arc, v along z, in metres. */
function arcSheet(a, lift, z0, z1, segments = 18) {
  const pos = [];
  const uv = [];
  const idx = [];
  let u = 0;
  let prev = null;
  for (let i = 0; i <= segments; i++) {
    const x = -a + (2 * a * i) / segments;
    const y = roofY(x) - lift;
    if (prev) u += Math.hypot(x - prev.x, y - prev.y);
    prev = { x, y };
    pos.push(x, y, z0, x, y, z1);
    uv.push(u / 1.2, z0 / 3, u / 1.2, z1 / 3);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k - 1, k, k - 1, k + 1, k);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

/** A band of timber following the roof's curve in the x-y plane (a fascia or a rib), `width` deep, `thick` front to back, at z. */
function arcBand(a, lift, width, thick, z, segments = 18) {
  const shape = new THREE.Shape();
  const top = [];
  const bottom = [];
  for (let i = 0; i <= segments; i++) {
    const x = -a + (2 * a * i) / segments;
    top.push([x, roofY(x) - lift]);
    bottom.push([x, roofY(x) - lift - width]);
  }
  shape.moveTo(...top[0]);
  for (const p of top) shape.lineTo(...p);
  for (const p of bottom.reverse()) shape.lineTo(...p);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  geo.translate(0, 0, z);
  return geo;
}

/** An end wall: the width of the hut, up to the roof's curve, with a doorway cut in it when `door`. Shape coordinates are metres, so textures tile per metre. */
function endWall(floor, door) {
  const hw = 1.1 - 0.008; // a hair inside the side walls' outer faces, so the two never share a plane
  const shape = new THREE.Shape();
  const n = 14;
  shape.moveTo(-hw, floor);
  shape.lineTo(hw, floor);
  for (let i = 0; i <= n; i++) {
    const x = hw - (2 * hw * i) / n;
    shape.lineTo(x, roofY(x) - 0.04);
  }
  shape.closePath();
  if (door) {
    const hole = new THREE.Path();
    const sill = floor + 0.01; // the doorway starts a hair above the wall's bottom edge (the door's sill covers it), or the two edges coincide and the wall's underside is triangulated across the doorway
    hole.moveTo(-DOOR_W / 2, sill);
    hole.lineTo(-DOOR_W / 2, floor + DOOR_H);
    hole.lineTo(DOOR_W / 2, floor + DOOR_H);
    hole.lineTo(DOOR_W / 2, sill);
    hole.closePath();
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: WALL, bevelEnabled: false });
  return geo;
}

function plank(w, h, d, tile = 0.5) {
  return worldBox(w, h, d, tile, tile);
}

/** A cylinder lying along the x axis (a tube/bar) between two points in the hut's frame. */
function bar(ax, ay, az, bx, by, bz, r, sides = 6) {
  const a = new THREE.Vector3(ax, ay, az);
  const b = new THREE.Vector3(bx, by, bz);
  const geo = new THREE.CylinderGeometry(r, r, a.distanceTo(b), sides, 1);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.add(b).multiplyScalar(0.5);
  return geo.translate(mid.x, mid.y, mid.z);
}

/**
 * A wellington boot, toe along +z: a leg with a calf and a curved back that tapers to the ankle, a rounded foot with a heel, a turned-over top
 * with a dark lining you can see into, and a black sole. Returns { body, liner, sole } as geometries placed at (x, z) turned `yaw`, standing
 * or `lying` on its side.
 */
function wellingtonBoot(x, z, yaw, lying) {
  // The leg: a lathe through a profile (radius by height), then bent so the front is the shin and the back curves in at the heel and out at the calf.
  const profile = [[0.047, 0.06], [0.043, 0.12], [0.05, 0.2], [0.056, 0.28], [0.054, 0.34], [0.052, 0.36]].map(([r, y]) => new THREE.Vector2(r, y));
  const leg = new THREE.LatheGeometry(profile, 16);
  const pos = leg.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = (y - 0.06) / 0.3;
    const calf = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * 0.012; // the back swells at the calf
    pos.setZ(i, pos.getZ(i) - (pos.getZ(i) < 0 ? calf : 0) + t * t * 0.018); // and the whole leg leans a little forward at the top
  }
  leg.computeVertexNormals();
  const top = new THREE.TorusGeometry(0.0525, 0.0075, 6, 16).rotateX(Math.PI / 2).translate(0, 0.36, 0.018);
  const ankle = new THREE.SphereGeometry(0.05, 14, 10).scale(1, 0.95, 1.15).translate(0, 0.075, 0);
  const foot = new THREE.SphereGeometry(0.052, 16, 12).scale(1, 0.8, 2.3).translate(0, 0.045, 0.088);
  const heel = new THREE.BoxGeometry(0.075, 0.07, 0.06).translate(0, 0.053, -0.045); // sat on the sole, not level with its underside
  const liner = new THREE.CylinderGeometry(0.046, 0.04, 0.34, 14, 1, true).translate(0, 0.2, 0.012);
  const soleGeo = new THREE.CylinderGeometry(0.056, 0.056, 0.016, 16).scale(1, 1, 2.5).translate(0, 0.008, 0.078);
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  const put = (g) => {
    if (lying) g.rotateZ(Math.PI / 2).translate(0, 0.055, 0);
    return g.rotateY(yaw).translate(x, 0, z);
  };
  return {
    body: put(mergeGeometries([leg, top, ankle, foot, heel].map(flat))),
    liner: put(flat(liner)),
    sole: put(flat(soleGeo)),
  };
}

/** A coat hanging from its collar: a body and two sleeves cut out as one flat shape with some thickness, a stand-up collar and two pockets. */
function coatGeometry() {
  const shape = new THREE.Shape();
  const pts = [[-0.07, 0], [0.07, 0], [0.2, -0.04], [0.31, -0.5], [0.255, -0.53], [0.2, -0.22], [0.235, -0.8], [-0.235, -0.8], [-0.2, -0.22], [-0.255, -0.53], [-0.31, -0.5], [-0.2, -0.04]];
  shape.moveTo(...pts[0]);
  for (const q of pts.slice(1)) shape.lineTo(...q);
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2 });
  body.translate(0, 0, -0.025);
  const collar = new THREE.TorusGeometry(0.08, 0.022, 6, 12, Math.PI).rotateZ(Math.PI).translate(0, 0.0, 0);
  const pockets = [-0.12, 0.12].map((x) => new THREE.BoxGeometry(0.1, 0.12, 0.012).translate(x, -0.58, 0.05));
  const flat = (g) => (g.index ? g.toNonIndexed() : g);
  const merged = mergeGeometries([body, collar, ...pockets].map(flat));
  return merged.translate(0, 0.0, 0);
}

/** An iron wheel standing on its edge, axle along x at (x, r, z): a flat tyre band, a rim, ten spokes and a hub. */
function wheelGeometry(r, x, z) {
  const parts = [];
  const band = new THREE.CylinderGeometry(r, r, 0.07, 24, 1, true).rotateZ(Math.PI / 2);
  parts.push(band);
  for (const side of [-1, 1]) parts.push(new THREE.TorusGeometry(r - 0.02, 0.014, 5, 24).rotateY(Math.PI / 2).translate(side * 0.033, 0, 0));
  parts.push(new THREE.CylinderGeometry(0.07, 0.07, 0.16, 10).rotateZ(Math.PI / 2));
  parts.push(new THREE.CylinderGeometry(0.035, 0.035, 0.32, 8).rotateZ(Math.PI / 2));
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    parts.push(new THREE.BoxGeometry(0.035, r - 0.08, 0.03).translate(0, (r - 0.08) / 2 + 0.05, 0).rotateX(a));
  }
  const geo = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p)));
  return geo.translate(x, r, z);
}

/**
 * Builds the hut into the scene. `c` is the props context (props.js). Returns { group, parts } where `parts` are the pieces the game moves or
 * lights: the window glass material, the kettle, the stove's door and the pieces of the pour.
 */
export function buildHut(c) {
  const shape = hutShape(c.layout);
  if (!shape) return null;
  const { scene, heights, fixedBox } = c;
  const random = createRandom(0x5e9d); // its own stream: drawing from the props' shared one would move every tree and tuft built after it
  const L = shape.length;
  const hl = L / 2;
  const hw = shape.width / 2;
  const F = shape.floor; // the floor's top above the ground
  const ground = heights.heightAt(shape.x, shape.z);
  const group = new THREE.Group();
  group.name = 'shepherdsHut';
  group.position.set(shape.x, ground, shape.z);
  group.rotation.y = shape.yaw;
  scene.add(group);

  // Materials: sage green paint on the boards, red-oxide tin gone rusty, bare timber for the floor and steps, black iron.
  const paint = mat(paintedTexture(random, '#7f9477'));
  const paintCream = mat(paintedTexture(random, '#e4dcc4'));
  const tin = mat(corrugatedTexture(random, '#80553f', 0.9), { roughness: 0.75, metalness: 0.2, side: THREE.DoubleSide });
  const timber = mat(woodTexture(random, [118, 92, 62]));
  const darkTimber = mat(woodTexture(random, [78, 60, 42]));
  const iron = plain(0x25241f, 0.55, 0.7);
  const rustyIron = plain(0x4a2f22, 0.9, 0.4);
  const stoneMat = plain(0x8a867b, 0.95);
  const brass = plain(0x9a7b3c, 0.4, 0.6);
  const ironPipe = mat(castIronTexture(random), { roughness: 0.5, metalness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x2c3b44, roughness: 0.15, metalness: 0.1, emissive: 0xffa84a, emissiveIntensity: 0 });

  const add = (geo, material, x, y, z, { cast = true, receive = true, name } = {}) => {
    const m = new THREE.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = cast;
    m.receiveShadow = receive;
    if (name) m.name = name;
    group.add(m);
    return m;
  };
  const wallTop = roofY(hw) - 0.04;

  // The floor, the sill boards round its edge and the underframe: iron rails along the hut, cross-bearers, and a dark box that shuts the view under it.
  add(plank(shape.width, 0.07, L, 0.4), timber, 0, F - 0.035, 0);
  for (const sx of [-1, 1]) add(plank(0.08, 0.2, L + 0.08), paint, sx * (hw + 0.01), F - 0.13, 0);
  for (const sz of [-1, 1]) add(plank(shape.width + 0.12, 0.19, 0.08), paint, 0, F - 0.13, sz * (hl + 0.01));
  add(new THREE.BoxGeometry(shape.width - 0.2, 0.28, L - 0.2), plain(0x15130f, 1), 0, F - 0.2, 0, { cast: false, receive: false });
  for (const sx of [-0.8, 0.8]) add(new THREE.BoxGeometry(0.1, 0.16, L + 0.2), iron, sx, F - 0.2, 0);
  for (const sz of [-1.6, -0.5, 0.5, 1.6]) add(new THREE.BoxGeometry(shape.width - 0.1, 0.1, 0.1), iron, 0, F - 0.2, sz);

  // Side walls: boards with the window cut in the -x one (four boxes round the opening).
  const sideWall = (sx) => {
    const x = sx * (hw - WALL / 2);
    const h = wallTop - F;
    if (sx > 0) {
      add(plank(WALL, h, L - 2 * END_GAP, 0.6), paint, x, F + h / 2, 0);
      return;
    }
    const z0 = WINDOW.z - WINDOW.w / 2;
    const z1 = WINDOW.z + WINDOW.w / 2;
    const bit = (za, zb, ya, yb) => add(plank(WALL, yb - ya, zb - za, 0.6), paint, x, F + (ya + yb) / 2, (za + zb) / 2);
    bit(-hl + END_GAP, z0, 0, h);
    bit(z1, hl - END_GAP, 0, h);
    bit(z0, z1, 0, WINDOW.y0);
    bit(z0, z1, WINDOW.y1, h);
  };
  sideWall(-1);
  sideWall(1);

  // End walls: the back (-z) is solid, the door end (+z) has the doorway. Both curve up to the roof; extruded shapes take their texture per metre.
  const back = new THREE.Mesh(endWall(F, false), paint);
  back.position.set(0, 0, -hl);
  back.castShadow = back.receiveShadow = true;
  group.add(back);
  const front = new THREE.Mesh(endWall(F, true), paint);
  front.position.set(0, 0, hl - WALL);
  front.castShadow = front.receiveShadow = true;
  group.add(front);

  // Corner boards, painted cream, up each corner.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(plank(0.08, wallTop - F, 0.08, 0.4), paintCream, sx * (hw + 0.005), F + (wallTop - F) / 2, sz * (hl + 0.005));

  // The roof: corrugated tin over timber ribs, a painted fascia at each end and a gutter along each eave.
  const roof = new THREE.Mesh(arcSheet(ROOF_HALF, 0, -hl - 0.25, hl + 0.3), tin);
  roof.castShadow = roof.receiveShadow = true;
  roof.name = 'hutRoof';
  group.add(roof);
  for (const z of [-1.6, -0.55, 0.55, 1.6]) {
    const rib = new THREE.Mesh(arcBand(hw - 0.035, 0.05, 0.07, 0.06, z - 0.03), darkTimber);
    group.add(rib);
  }
  for (const z of [-hl - 0.25, hl + 0.3 - 0.03]) group.add(new THREE.Mesh(arcBand(ROOF_HALF, 0.012, 0.11, 0.03, z), paintCream));
  for (const sx of [-1, 1]) {
    const gutter = add(new THREE.CylinderGeometry(0.04, 0.04, L + 0.5, 8, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2), iron, sx * (ROOF_HALF + 0.02), EAVES - 0.07, 0.025);
    gutter.material = iron.clone();
    gutter.material.side = THREE.DoubleSide;
  }

  // The stovepipe through the roof, with a rain cap: from the stove up and out.
  const flueX = HUT_INSIDE.stove.x;
  const flueZ = HUT_INSIDE.stove.z + HUT_INSIDE.flueBack;
  const roofAtFlue = roofY(flueX);
  const flueTop = roofAtFlue + 0.62;
  const flueBottom = F + 0.58; // down inside the spigot's collar on the top plate, so the pipe stands on the stove
  add(new THREE.CylinderGeometry(0.045, 0.045, flueTop - flueBottom, 10), ironPipe, flueX, (flueTop + flueBottom) / 2, flueZ, { name: 'hutFlue' });
  add(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 10), iron, flueX, roofAtFlue + 0.04, flueZ); // the flashing collar
  add(new THREE.ConeGeometry(0.12, 0.08, 10), iron, flueX, flueTop + 0.07, flueZ);
  for (const a of [0, 1, 2]) add(new THREE.BoxGeometry(0.012, 0.07, 0.012), iron, flueX + Math.cos(a * 2.09) * 0.07, flueTop + 0.015, flueZ + Math.sin(a * 2.09) * 0.07, { cast: false });

  // The half-stable door in the doorway: frame, the shut bottom leaf with strap hinges and a latch, the top leaf swung open against the wall.
  const dz = hl + 0.005;
  const doorFrame = (x, y, w, h) => add(plank(w, h, 0.1, 0.4), paintCream, x, F + y, dz);
  doorFrame(-DOOR_W / 2 - 0.05, DOOR_H / 2, 0.09, DOOR_H + 0.1);
  doorFrame(DOOR_W / 2 + 0.05, DOOR_H / 2, 0.09, DOOR_H + 0.1);
  add(plank(DOOR_W + 0.28, 0.1, 0.1, 0.4), paintCream, 0, F + DOOR_H + 0.07, dz + 0.006); // the head, a hair proud of the side posts, not on their planes
  add(plank(DOOR_W + 0.14, 0.05, 0.16, 0.4), timber, 0, F + 0.03, dz + 0.045); // the sill, a hair above the floor's plane
  const leafH = 0.88;
  // The bottom leaf swung open too, against the outside of the wall beside the top one (both hinged on the -x side), so the doorway is open.
  const lowerLeaf = new THREE.Group();
  lowerLeaf.position.set(-DOOR_W / 2, F + 0.03 + leafH / 2, hl + 0.012);
  lowerLeaf.rotation.y = -1.75;
  const lower = new THREE.Mesh(plank(DOOR_W - 0.02, leafH, 0.045, 0.4), mat(paintedTexture(random, '#4f6a4c')));
  lower.position.set((DOOR_W - 0.02) / 2, 0, 0);
  lower.castShadow = true;
  lowerLeaf.add(lower);
  for (const y of [0.18, 0.7]) lowerLeaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.02), iron).translateX(0.27).translateY(y - leafH / 2).translateZ(0.0325)); // strap hinges
  lowerLeaf.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.025), iron).translateX(DOOR_W - 0.12).translateY(0.58 - leafH / 2).translateZ(0.0325)); // the latch
  group.add(lowerLeaf);
  const topLeaf = new THREE.Group();
  topLeaf.position.set(-DOOR_W / 2, F + 0.03 + leafH + (DOOR_H - leafH - 0.03) / 2, hl + 0.01);
  topLeaf.rotation.y = -1.75;
  const leaf = new THREE.Mesh(plank(DOOR_W - 0.02, DOOR_H - leafH - 0.05, 0.045, 0.4), mat(paintedTexture(random, '#4f6a4c')));
  leaf.position.set((DOOR_W - 0.02) / 2, 0, 0);
  leaf.castShadow = true;
  topLeaf.add(leaf);
  group.add(topLeaf);

  // The window on the -x wall: frame, cill, glass and four panes' bars.
  const wx = -hw + 0.005;
  const wy = F + (WINDOW.y0 + WINDOW.y1) / 2;
  const wh = WINDOW.y1 - WINDOW.y0;
  // The frame's top and bottom rails reach 5 mm into the opening, so their faces are not on the planes of the wall's opening edges.
  add(plank(0.058, 0.055, WINDOW.w + 0.108, 0.4), paintCream, wx - 0.01, wy + wh / 2 + 0.0225, WINDOW.z);
  add(plank(0.058, 0.055, WINDOW.w + 0.108, 0.4), paintCream, wx - 0.01, wy - wh / 2 - 0.0225, WINDOW.z);
  for (const s of [-1, 1]) add(plank(0.05, wh, 0.055, 0.4), paintCream, wx - 0.01, wy, WINDOW.z + s * (WINDOW.w / 2 + 0.0225));
  add(plank(0.1, 0.03, WINDOW.w + 0.16, 0.4), paintCream, wx - 0.03, wy - wh / 2 - 0.065, WINDOW.z); // the cill
  const glassMesh = add(new THREE.PlaneGeometry(WINDOW.w, wh), glass, -hw + WALL / 2, wy, WINDOW.z, { cast: false });
  glassMesh.rotation.y = -Math.PI / 2;
  glassMesh.name = 'hutGlass';
  add(plank(0.03, wh, 0.025, 0.4), paintCream, wx - 0.012, wy, WINDOW.z);
  add(plank(0.024, 0.025, WINDOW.w, 0.4), paintCream, wx - 0.012, wy, WINDOW.z);

  // Steps: two wooden risers up to the sill with stringers each side and a rail on the right.
  const sz0 = HUT_INSIDE.stepZ[0];
  const sz1 = HUT_INSIDE.stepZ[1];
  const top = HUT_INSIDE.stepTop;
  add(plank(0.9, 0.05, sz1 - sz0 - 0.02, 0.4), timber, 0, top - 0.025, (sz0 + sz1) / 2 + 0.01);
  add(plank(0.88, top - 0.05, 0.04, 0.4), timber, 0, (top - 0.05) / 2, sz1 + 0.04);
  for (const sx of [-1, 1]) {
    add(plank(0.05, top + 0.05, sz1 - hl + 0.2, 0.4), darkTimber, sx * 0.47, (top + 0.05) / 2, (hl - 0.15 + sz1 + 0.05) / 2);
  }
  add(plank(0.04, 0.05, sz1 - hl + 0.35, 0.4), darkTimber, 0.49, top + 0.9, (hl + sz1) / 2 + 0.05); // narrower than its posts, so their sides are not on its planes
  for (const z of [hl + 0.05, sz1 + 0.05]) add(plank(0.05, 0.9, 0.05, 0.4), darkTimber, 0.49, top + 0.45, z);

  // The wheels: iron, a big pair at the door end and a smaller pair at the drawbar end, outside the walls, with a chock against the rear pair.
  const wheelMat = iron;
  const frontR = 0.4;
  const rearR = 0.5;
  const wheels = [];
  for (const sx of [-1, 1]) {
    const rear = add(wheelGeometry(rearR, sx * (hw + 0.14), 0.95), wheelMat, 0, 0, 0);
    const front = add(wheelGeometry(frontR, sx * (hw + 0.14), -1.0), wheelMat, 0, 0, 0);
    wheels.push(rear, front);
    add(new THREE.BoxGeometry(0.1, 0.12, 0.3), timber, sx * (hw + 0.14), 0.06, 0.95 + rearR + 0.05, { receive: false }).rotation.x = -0.45; // the chock
  }
  add(new THREE.CylinderGeometry(0.03, 0.03, shape.width + 0.5, 8).rotateZ(Math.PI / 2), iron, 0, frontR, -1.0); // the axles
  add(new THREE.CylinderGeometry(0.035, 0.035, shape.width + 0.5, 8).rotateZ(Math.PI / 2), iron, 0, rearR, 0.95);

  // The drawbar: an A-frame of two flat bars from the chassis meeting at a hitch ring, propped on a stone.
  const barY = F - 0.2;
  const tip = -hl - 1.5;
  for (const sx of [-1, 1]) add(bar(sx * 0.55, barY, -hl, sx * 0.04, barY - 0.02, tip, 0.035), rustyIron, 0, 0, 0);
  add(new THREE.TorusGeometry(0.07, 0.016, 6, 12).rotateY(Math.PI / 2), iron, 0, barY - 0.02, tip - 0.06);
  add(new THREE.CylinderGeometry(0.04, 0.05, barY - 0.15, 8), iron, 0, (barY - 0.15) / 2 + 0.05, tip + 0.1); // a prop leg
  add(new THREE.DodecahedronGeometry(0.22, 0), stoneMat, 0, 0.08, tip + 0.1, { receive: false }).scale.set(1.1, 0.5, 1);

  // ---- Inside ----
  const rise = (r) => F + r;
  // The bunk across the back: a timber frame with a mattress, a folded blanket and a pillow.
  const b = HUT_INSIDE.bunk;
  const bunkL = b.z1 - b.z0;
  add(plank(shape.width - 0.2, b.rise - 0.1, bunkL - 0.04, 0.4), darkTimber, 0, rise((b.rise - 0.1) / 2), (b.z0 + 0.04 + b.z1) / 2); // its back end a hair into the wall, not on the wall's outer plane
  const mattress = add(new THREE.BoxGeometry(shape.width - 0.26, 0.1, bunkL - 0.06), mat(blanketTexture(random, '#6b7f8e', '#3d4d5a')), 0, rise(b.rise - 0.05), (b.z0 + b.z1) / 2);
  mattress.receiveShadow = true;
  add(new THREE.BoxGeometry(shape.width - 0.3, 0.05, 0.4), mat(blanketTexture(random, '#a2412f', '#6a2a1e')), 0, rise(b.rise + 0.03), b.z1 - 0.3); // the folded blanket
  add(new THREE.BoxGeometry(0.55, 0.12, 0.3), paintCream, -0.4, rise(b.rise + 0.06), b.z0 + 0.22).rotation.y = 0.1; // a pillow

  // The stove: a cast-iron box on a slate hearth with short legs, a top plate with two lids, a door with a glass front facing into the hut (-z,
  // towards the bunk), a brass catch, a draught slide, and the stovepipe out of its back.
  const st = HUT_INSIDE.stove;
  add(new THREE.BoxGeometry(0.8, 0.02, 0.8), plain(0x4b4a46, 0.9), st.x, rise(0.01), st.z, { cast: false }); // the hearth slate
  const cast = mat(castIronTexture(random), { roughness: 0.6, metalness: 0.45 });
  for (const [dx, dz] of [[-0.2, -0.15], [0.2, -0.15], [-0.2, 0.15], [0.2, 0.15]]) add(new THREE.CylinderGeometry(0.022, 0.03, 0.08, 8), cast, st.x + dx, rise(0.06), st.z + dz); // the legs
  add(new THREE.BoxGeometry(0.5, 0.05, 0.4), cast, st.x, rise(0.105), st.z); // the base plate
  add(new THREE.BoxGeometry(0.44, 0.38, 0.34), cast, st.x, rise(0.32), st.z); // the firebox
  add(new THREE.BoxGeometry(0.5, 0.035, 0.4), cast, st.x, rise(0.5375), st.z); // the top plate
  for (const dx of [-0.1, 0.1]) {
    add(new THREE.CylinderGeometry(0.075, 0.075, 0.012, 16), cast, st.x + dx, rise(0.5615), st.z - 0.02); // a hob lid
    add(new THREE.TorusGeometry(0.075, 0.008, 6, 16).rotateX(Math.PI / 2), cast, st.x + dx, rise(0.553), st.z - 0.02); // the ring's crest a few mm under the lid's top
  }
  add(new THREE.BoxGeometry(0.52, 0.02, 0.012), cast, st.x, rise(0.55), st.z - 0.206); // the front rail along the top plate
  const doorZ = st.z - 0.17 - 0.015; // the door's frame stands 3 cm proud of the firebox's front
  add(new THREE.BoxGeometry(0.28, 0.22, 0.03), cast, st.x, rise(0.32), doorZ);
  const stoveDoor = add(new THREE.PlaneGeometry(0.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x151210, roughness: 0.5, emissive: 0xff7a22, emissiveIntensity: 0 }), st.x, rise(0.32), doorZ - 0.02, { cast: false });
  stoveDoor.rotation.y = Math.PI; // facing -z
  stoveDoor.name = 'hutStoveDoor';
  add(new THREE.BoxGeometry(0.04, 0.045, 0.02), brass, st.x + 0.16, rise(0.32), doorZ - 0.02, { cast: false }); // a brass catch
  add(new THREE.BoxGeometry(0.1, 0.025, 0.02), cast, st.x, rise(0.17), doorZ - 0.005, { cast: false }); // the draught slide under the door
  add(new THREE.CylinderGeometry(0.065, 0.075, 0.07, 10), ironPipe, st.x, rise(0.588), st.z + HUT_INSIDE.flueBack, { name: 'hutFlueCollar' }); // the flue collar on the top plate, the pipe going down into it
  // The kettle: a dented tin one with a spout and a bale handle, on its own group so the pour can tilt it.
  const kettle = new THREE.Group();
  kettle.name = 'hutKettle';
  kettle.position.set(st.x - 0.02, rise(0.555), st.z - 0.04);
  const kMat = mat(tinTexture(random), { roughness: 0.45, metalness: 0.55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.115, 0.17, 14), kMat);
  body.position.y = 0.085;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.007, 5, 14).rotateX(Math.PI / 2), kMat);
  rim.position.y = 0.012;
  const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.04, 14), kMat);
  shoulder.position.y = 0.19;
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.025, 14), kMat);
  lid.position.y = 0.2225;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.03, 0.15, 8), kMat);
  spout.position.set(0.13, 0.13, 0);
  spout.rotation.z = -0.95;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.009, 5, 14, Math.PI), iron);
  handle.position.y = 0.17;
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), iron);
  knob.position.y = 0.245;
  kettle.add(body, rim, shoulder, lid, spout, handle, knob);
  kettle.traverse((o) => {
    o.castShadow = true;
  });
  group.add(kettle);

  // The shelf on the -x wall above a coat peg, with a mug, a tea tin, a candle in a jar and a tin tray; and a shelf bracket each end.
  const sh = HUT_INSIDE.shelf;
  add(plank(0.2, 0.03, 0.9, 0.4), timber, -hw + 0.12, rise(sh.rise), sh.z);
  for (const dz2 of [-0.35, 0.35]) add(plank(0.03, 0.14, 0.03, 0.4), timber, -hw + 0.04, rise(sh.rise - 0.08), sh.z + dz2);
  const mugMat = plain(0xd9d4c4, 0.5);
  const mug = add(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), mugMat, -hw + 0.13, rise(sh.rise + 0.06), sh.z - 0.25, { receive: false });
  mug.name = 'hutMug';
  add(new THREE.TorusGeometry(0.025, 0.008, 5, 8, Math.PI).rotateZ(-Math.PI / 2), mugMat, -hw + 0.13, rise(sh.rise + 0.06), sh.z - 0.205, { cast: false }).rotation.y = Math.PI / 2;
  add(new THREE.BoxGeometry(0.1, 0.12, 0.12), plain(0x8e3b2a, 0.5, 0.3), -hw + 0.13, rise(sh.rise + 0.075), sh.z + 0.05); // the tea tin
  add(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 8), plain(0xb9c4c0, 0.2), -hw + 0.13, rise(sh.rise + 0.075), sh.z + 0.3, { receive: false }); // a candle in a jar

  // A stool and a basket of logs by the stove, a coat on a peg, and a rag rug on the boards.
  add(new THREE.CylinderGeometry(0.15, 0.17, 0.02, 12), timber, 0.45, rise(0.4), 0.3);
  for (const a of [0, 1, 2]) add(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 5), timber, 0.45 + Math.cos(a * 2.09) * 0.11, rise(0.2), 0.3 + Math.sin(a * 2.09) * 0.11);
  const logs = new THREE.Group();
  logs.position.set(0.8, F, 0.65);
  const logMat = mat(woodTexture(random, [96, 70, 46]));
  for (let i = 0; i < 6; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.3, 7).rotateZ(Math.PI / 2), logMat);
    l.position.set(0, 0.06 + Math.floor(i / 3) * 0.08, -0.1 + (i % 3) * 0.1);
    l.rotation.y = (i % 2) * 0.15;
    logs.add(l);
  }
  const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.2, 12, 1, true), plain(0x8f7344, 0.95));
  basket.position.set(0, 0.1, 0);
  basket.material.side = THREE.DoubleSide;
  logs.add(basket);
  group.add(logs);
  add(new THREE.PlaneGeometry(0.9, 1.4).rotateX(-Math.PI / 2), mat(blanketTexture(random, '#7a6a4c', '#a58a52')), -0.2, F + 0.012, 0.1, { cast: false });
  // A peg rail on the +x wall by the door, three pegs on it, and an old waxed coat hung from the middle one.
  const railX = hw - WALL - 0.02;
  add(plank(0.04, 0.08, 0.6, 0.4), darkTimber, railX, rise(1.55), 0.15);
  for (const dz2 of [-0.2, 0, 0.2]) add(new THREE.CylinderGeometry(0.012, 0.014, 0.07, 6).rotateZ(Math.PI / 2), iron, railX - 0.055, rise(1.55), 0.15 + dz2);
  const coat = new THREE.Mesh(coatGeometry(), mat(waxedTexture(random), { roughness: 0.8 }));
  const hangX = railX - 0.075;
  const apex = rise(1.5); // the hanger's peak, 3 cm under the peg's ring
  coat.position.set(hangX, apex - 0.03, 0.15);
  coat.rotation.y = -Math.PI / 2; // its front towards the middle of the hut
  coat.castShadow = true;
  group.add(coat);
  // The wooden hanger inside the coat's shoulders, and its wire hook looped over the peg.
  for (const sz2 of [-1, 1]) {
    const bar = add(new THREE.BoxGeometry(0.012, 0.012, 0.2), darkTimber, hangX, apex - 0.05, 0.15 + sz2 * 0.105, { cast: false });
    bar.rotation.x = sz2 * 0.15; // slopes down from the peak to the shoulder
  }
  add(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 5), iron, hangX, apex + 0.01, 0.15, { cast: false });
  add(new THREE.TorusGeometry(0.02, 0.003, 5, 12).rotateY(Math.PI / 2), iron, hangX, rise(1.55), 0.15, { cast: false }); // round the peg

  // Outside: a water butt at the eaves on the +x side and a pair of boots by the steps.
  const butt = add(new THREE.CylinderGeometry(0.28, 0.24, 0.55, 12), mat(blanketTexture(random, '#3a4a3a', '#2a3a2a')), hw + 0.5, 0.275, 1.55);
  butt.name = 'hutButt';
  add(new THREE.CylinderGeometry(0.29, 0.29, 0.03, 12), iron, hw + 0.5, 0.56, 1.55);
  const wellies = plain(0x2f4a2b, 0.55); // green rubber, with a black sole and a pale lining
  wellies.side = THREE.DoubleSide;
  const lining = plain(0x6b5f4a, 0.95);
  lining.side = THREE.DoubleSide;
  const soles = plain(0x181818, 0.8);
  for (const [bx, bz, yaw, lying] of [[-0.78, sz1 + 0.05, 0.35, false], [-0.55, sz1 + 0.55, -0.6, true]]) {
    const { body, liner, sole } = wellingtonBoot(bx, bz, yaw, lying);
    add(body, wellies, 0, 0, 0);
    add(liner, lining, 0, 0, 0);
    add(sole, soles, 0, 0, 0);
  }

  mergeByMaterial(group);

  // Colliders: floor slab, the four walls (the door end in two, leaving the doorway), the steps, the wheels and the drawbar.
  const wb = (lx, y0, y1, lz, hx, hz) => {
    const p = shape.toWorld(lx, lz);
    return fixedBox(p.x, ground + (y0 + y1) / 2, p.z, hx, (y1 - y0) / 2, hz, shape.yaw);
  };
  wb(0, 0, F, 0, hw, hl);
  const top2 = wallTop;
  const gap = DOOR_W / 2 + 0.05;
  wb(-hw + WALL / 2, F, top2, 0, WALL / 2, hl);
  wb(hw - WALL / 2, F, top2, 0, WALL / 2, hl);
  wb(0, F, top2, -hl + WALL / 2, hw, WALL / 2);
  for (const sx of [-1, 1]) wb(sx * (gap + (hw - gap) / 2), F, top2, hl - WALL / 2, (hw - gap) / 2, WALL / 2);
  const doorCollider = wb(0, F, F + DOOR_H, hl - WALL / 2, gap, WALL / 2); // across the doorway, on only while the door is shut (hutHost.js)
  doorCollider?.setEnabled?.(false);
  // The steps are walked up on an invisible ramp, not on boxes: a walking capsule has a round bottom, so it cannot autostep a 0.28 m riser (and the
  // next from the step to the floor), but it climbs a slope of 30 degrees up from the foot of the steps to the floor's edge without a snag.
  if (c.physics && c.RAPIER) {
    const pts = [];
    for (const sx of [-0.45, 0.45]) {
      for (const [lz, ly] of [[HUT_INSIDE.stepZ[0], F], [HUT_INSIDE.stepZ[0], 0], [HUT_INSIDE.stepZ[1], 0]]) {
        const w = shape.toWorld(sx, lz);
        pts.push(w.x, ground + ly, w.z);
      }
    }
    c.physics.createCollider(c.RAPIER.ColliderDesc.convexHull(new Float32Array(pts)));
  }
  for (const sx of [-1, 1]) {
    wb(sx * (hw + 0.14), 0, rearR * 2, 0.95, 0.06, rearR * 0.8);
    wb(sx * (hw + 0.14), 0, frontR * 2, -1.0, 0.06, frontR * 0.8);
  }
  wb(0, 0, 0.5, tip / 2 - hl / 2 - 0.2, 0.35, (Math.abs(tip) - hl) / 2 + 0.1);

  return { group, shape, parts: { glass, glassMesh, kettle, stoveDoor, mug, topLeaf, lowerLeaf, doorCollider, ground, chimneyY: flueTop + 0.12 } };
}

/**
 * Merges the group's plain static meshes into one mesh for each material (and shadow setting), so the whole hut is a handful of draw calls and
 * not a hundred. Named meshes (the glass, the stove's door, the roof, the mug) and the kettle, which move or change, are left as they are.
 */
function mergeByMaterial(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const victims = [];
  group.traverse((o) => {
    if (!o.isMesh || o.name || o.parent?.name === 'hutKettle') return;
    const key = `${o.material.uuid}/${o.castShadow ? 1 : 0}/${o.receiveShadow ? 1 : 0}`;
    const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    if (!buckets.has(key)) buckets.set(key, { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] });
    buckets.get(key).geos.push(geo);
    victims.push(o);
  });
  for (const o of victims) o.removeFromParent();
  for (const b of buckets.values()) {
    const m = new THREE.Mesh(mergeGeometries(b.geos), b.material);
    m.castShadow = b.cast;
    m.receiveShadow = b.receive;
    group.add(m);
  }
}

/** A woven or knitted cloth: two colours in a check, one tile being 0.5 m (blankets, rugs, a bin's lid). */
/** Cast iron: near-black with a brown rust bloom, pale wear on the edges and fine pitting. Tiles. */
function castIronTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#2a2a2d';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) {
      const g = ctx.createRadialGradient(random() * w, random() * h, 2, random() * w, random() * h, 28 + random() * 40);
      g.addColorStop(0, `rgba(${90 + random() * 40},${52 + random() * 20},34,0.35)`);
      g.addColorStop(1, 'rgba(70,40,26,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 1400; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.05 + random() * 0.12})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
    ctx.strokeStyle = 'rgba(140,140,150,0.22)';
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, w - 6, h - 6);
  });
}

/** Tin: grey-blue with worn patches, small dents and a few rust freckles. */
function tinTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#7d878c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) {
      const g = ctx.createRadialGradient(random() * w, random() * h, 1, random() * w, random() * h, 10 + random() * 18);
      g.addColorStop(0, random() < 0.5 ? 'rgba(210,216,218,0.4)' : 'rgba(60,66,70,0.4)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(${120 + random() * 40},${64 + random() * 20},40,${0.25 + random() * 0.3})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 2, 1 + random() * 2);
    }
  });
}

/** A waxed cotton coat: olive, creased, with paler wear. */
function waxedTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#4b5232';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.strokeStyle = `rgba(${random() < 0.5 ? '20,24,10' : '130,140,90'},${0.1 + random() * 0.18})`;
      ctx.lineWidth = 1 + random() * 2;
      ctx.beginPath();
      const x = random() * w;
      const y = random() * h;
      ctx.moveTo(x, y);
      ctx.lineTo(x + (random() - 0.5) * 40, y + (random() - 0.5) * 18);
      ctx.stroke();
    }
  });
}

function blanketTexture(random, a, b) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b;
    for (let i = 0; i < w; i += 32) {
      ctx.globalAlpha = 0.55;
      ctx.fillRect(i, 0, 14, h);
      ctx.fillRect(0, i, w, 14);
    }
    ctx.globalAlpha = 1;
    for (let i = 0; i < 400; i++) {
      ctx.fillStyle = `rgba(${random() < 0.5 ? '255,255,255' : '0,0,0'},${0.04 + random() * 0.05})`;
      ctx.fillRect(random() * w, random() * h, 1 + random() * 3, 1);
    }
  });
}
