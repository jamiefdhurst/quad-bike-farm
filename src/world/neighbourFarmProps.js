// The neighbour's farm drawn (world/neighbourFarm.js has its shapes): a drystone wall round a concrete yard with a gateway onto the lane (stone
// gateposts, a five-bar gate swung back, a postbox), the upland farmhouse (`buildFarmhouse`: windows that glow after dark),
// the barn (block walls, green sheeting, a rusty roof, a stack of bales inside), a water butt, a bin, a log pile and a bench, and three of the
// farm's own vehicle models parked about. All procedural, with colliders for the walls, the buildings and the vehicles.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNeighbourFarm } from './neighbourFarm.js';
import { canvasTexture, corrugatedTexture, stoneTexture, blockTexture, worldBox } from './outbuildingProps.js';
import { buildVehicleBody } from './trafficView.js';
import { enableShadows } from './assets.js';
import { buildFarVersion } from './farVersion.js';
import { dairyMaterials, buildParlour, buildCollectingYard, buildTankRoom, buildSlurryStore } from './dairyKit.js';
import { Gate } from './gates.js';
import { poseBaleSpike } from '../vehicle/tractorModel.js';
import {
  woodTexture, paintedTexture, doorTexture, sashTexture, binTexture, barrelTexture, barkTexture, logEndTexture, postboxTexture, dressedStoneTexture, oldStoneTexture, newStoneTexture,
  stoneSlateTexture, limewashTexture, castIronTexture, lawnTexture, flowersTexture, logStackTexture,
} from './neighbourTextures.js';

/** Slate: courses of dark grey tiles, one tile 1 m square, a few paler or greener. */
export function slateTexture(random) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#3d4247';
    ctx.fillRect(0, 0, w, h);
    const tw = w / 8;
    const th = h / 10;
    for (let r = 0; r < 10; r++) {
      for (let c = -1; c < 9; c++) {
        const s = 52 + random() * 24;
        ctx.fillStyle = `rgb(${s},${s + 3},${s + 7})`;
        ctx.fillRect(c * tw + (r % 2) * tw * 0.5 + 1, r * th + 1, tw - 2, th - 1);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(0, r * th + th - 2, w, 2);
    }
  });
}

/** Worn concrete: pale grey with joints every 4 m, oil stains and the odd crack. One tile is 4 m square. */
export function concreteTexture(random) {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#9d9b94';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 8 + random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const dark = random() < 0.6;
      g.addColorStop(0, dark ? 'rgba(60,55,50,0.14)' : 'rgba(210,205,195,0.1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 6; i++) {
      const x = random() * w;
      const y = random() * h;
      ctx.fillStyle = 'rgba(25,22,18,0.35)'; // oil
      ctx.beginPath();
      ctx.ellipse(x, y, 6 + random() * 14, 4 + random() * 8, random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(50,48,44,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, w, h);
  });
}

/** Barn straw bales: pale gold with the baler's two strings. One tile is a bale's long face. */
function strawTexture(random) {
  return canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#c9aa5c';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${120 + random() * 90},${95 + random() * 70},40,0.35)`;
      ctx.fillRect(random() * w, random() * h, 8 + random() * 22, 1);
    }
    ctx.fillStyle = '#6b5a3a';
    ctx.fillRect(w * 0.3, 0, 2, h);
    ctx.fillRect(w * 0.7, 0, 2, h);
  });
}

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });

/**
 * A five-bar gate leaf `len` long and 1.2 m high, lying along z with its hinge end at z = 0: a top bar, four rails, a stile at each end, a
 * diagonal brace from the hinge up to the latch end, two strap hinges and a latch plate. The stiles run down past the bottom rail.
 */
export function gateLeaf(wood, iron, len) {
  const g = new THREE.Group();
  const bar = (y, h = 0.09) => {
    const m = new THREE.Mesh(worldBox(0.06, h, len, 1), wood);
    m.position.set(0, y, len / 2);
    g.add(m);
  };
  for (const y of [0.22, 0.46, 0.7, 0.94]) bar(y);
  bar(1.2, 0.11);
  for (const z of [0.06, len - 0.06]) {
    const m = new THREE.Mesh(worldBox(0.09, 1.34, 0.11, 1), wood);
    m.position.set(0, 0.65, z);
    g.add(m);
  }
  const brace = new THREE.Mesh(worldBox(0.05, 0.09, Math.hypot(len - 0.2, 0.9), 1), wood);
  brace.position.set(0, 0.7, len / 2);
  brace.rotation.x = -Math.atan2(0.9, len - 0.2); // up from the latch end's foot to the hinge end's top
  g.add(brace);
  for (const y of [0.3, 1.0]) {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.05, 0.6), iron);
    strap.position.set(0, y, 0.31); // 1 cm in from the bars' ends, so the two don't share a plane
    g.add(strap);
  }
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.16), iron);
  latch.position.set(0, 0.95, len - 0.1);
  g.add(latch);
  return g;
}

/**
 * Merges everything the group holds directly into one mesh per material (the yard is 800-odd boxes, and each would be a draw call, twice
 * with shadows). Walls, roofs and windows never move, so nothing is lost; the vehicles are added afterwards and stay separate.
 */
function mergeStatic(group) {
  const byMaterial = new Map();
  for (const o of [...group.children]) {
    if (!o.isMesh) continue;
    o.updateMatrix();
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(o.matrix);
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(geo);
    group.remove(o);
    o.geometry.dispose();
  }
  for (const [material, geos] of byMaterial) group.add(new THREE.Mesh(mergeGeometries(geos), material));
}

/**
 * Merges the meshes of a parked vehicle (it never moves) into one mesh a material, in its own frame: the three vehicles were 93% of the yard's draw
 * calls (200-odd meshes each, #679). Skinned and instanced meshes, lights and anything with several materials stay as they are. Returns how many
 * meshes it made. The object keeps its group, so hiding it (she drives her Tor away) hides them all.
 */
export function mergeParkedVehicle(object) {
  object.updateMatrixWorld(true);
  const toLocal = new THREE.Matrix4().copy(object.matrixWorld).invert();
  const byMaterial = new Map();
  const merged = [];
  object.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || o.isInstancedMesh || !o.geometry || Array.isArray(o.material)) return;
    const g = o.geometry;
    if (!g.attributes.position) return;
    merged.push(o);
    const geo = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(toLocal, o.matrixWorld));
    if (!geo.attributes.normal) geo.computeVertexNormals();
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); // the detail kit's parts have none
    const keep = o.material.vertexColors && geo.attributes.color ? ['position', 'normal', 'uv', 'color'] : ['position', 'normal', 'uv'];
    for (const name of Object.keys(geo.attributes)) if (!keep.includes(name)) geo.deleteAttribute(name);
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(geo);
  });
  for (const o of merged) o.parent.remove(o);
  for (const [material, geos] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    object.add(mesh);
  }
  return byMaterial.size;
}

/**
 * The log pile against a barn's south wall (`outer`: its outer face as a rect): fifteen logs in three rows, each lying along z and turned a little
 * off square, with `z` the pile's middle and `reach` the farthest any log's end or bark gets from it. The pile stands off the wall by that reach, so
 * no log's end goes into the wall and shows from inside the barn.
 */
export function logPile(outer, random) {
  const logs = [];
  for (let i = 0; i < 15; i++) {
    const row = i < 8 ? 0 : i < 13 ? 1 : 2;
    const col = row === 0 ? i : row === 1 ? i - 8 + 0.5 : i - 13 + 1.2;
    logs.push({ r: 0.1 + random() * 0.035, len: 0.95 + random() * 0.3, x: outer.minX + 1 + col * 0.25, y: 0.11 + row * 0.19, yaw: (random() - 0.5) * 0.18 });
  }
  const reach = Math.max(...logs.map((l) => (l.len / 2) * Math.cos(l.yaw) + l.r * Math.abs(Math.sin(l.yaw))));
  return { logs, z: outer.maxZ + reach + 0.02, reach: reach + 0.02 };
}

/** Builds the neighbour's farm and its colliders. `c` is the props context (props.js). Returns null on a farm without one. */
/** The yard from afar (world/farVersion.js): the house, the barn and the low drystone wall round the yard, no vehicles. */
export function farNeighbourFarm(s, y0) {
  const house = { x: s.house.x, z: s.house.z, y: y0, halfX: s.house.halfX, halfZ: s.house.halfZ, wallHeight: s.house.wallHeight, ridge: s.house.ridge, wall: '#6f695c', roof: '#42474c' };
  const barn = { x: s.barn.x, z: s.barn.z, y: y0, halfX: s.barn.halfX, halfZ: s.barn.halfZ, wallHeight: s.barn.wallHeight, ridge: s.barn.ridge, wall: '#5d6e58', roof: '#7b5a42' };
  const walls = s.walls.map((w) => ({ ...w, y: y0, height: s.yard.wallHeight, color: '#8c877a' }));
  const buildings = [house, barn];
  // The wing in its newer stone and the scullery's catslide as low buildings of their own, so the outline from afar is the house's.
  if (s.house.wing) buildings.push({ x: s.house.wing.x, z: s.house.wing.z, y: y0, halfX: s.house.wing.halfX, halfZ: s.house.wing.halfZ, wallHeight: s.house.wing.wallHeight, ridge: s.house.wing.ridge, wall: '#a79d82', roof: '#42474c' });
  if (s.house.leanTo) buildings.push({ x: s.house.leanTo.x, z: s.house.leanTo.z, y: y0, halfX: s.house.leanTo.halfX, halfZ: s.house.leanTo.halfZ, wallHeight: s.house.leanTo.wallHeight, ridge: s.house.leanTo.wallHeight + 0.6, wall: '#8c877a', roof: '#42474c' });
  // The dairy: the parlour and the tank room as low buildings in fibre-cement grey, the round slurry store as a square-sided drum of the same height.
  for (const d of [s.parlour, s.tankRoom]) {
    if (d) buildings.push({ x: d.x, z: d.z, y: y0, halfX: d.halfX, halfZ: d.halfZ, wallHeight: d.wallHeight, ridge: d.ridge ?? d.wallHeight + 0.5, wall: '#9a9d97', roof: '#8a8e88' });
  }
  if (s.slurry) walls.push({ x: s.slurry.x, z: s.slurry.z, hx: s.slurry.r * 0.88, hz: s.slurry.r * 0.88, y: y0, height: s.slurry.height, color: '#9b9890' });
  return buildFarVersion('neighbourFarmFar', { buildings, walls });
}

/**
 * Her farmhouse (#910): an upland house of the 1700s in dark gritstone, a long low main range under a heavy stone-slate roof with copings, kneelers and a stack on each
 * gable (the east gable limewashed and peeling), mullioned windows under drip hoods below and small unequal ones above, an off-centre door in a stone surround under a slated
 * hood, a lower wing of newer stone at the west end, a catslide at the back over a scullery with its own door, cast-iron gutters and downpipes with a water butt, and a small
 * walled garden in front of the door. Returns { group, glow, lampGlow }: the parts to merge into the yard's group, and the two materials `setNight` lights.
 */
export function buildFarmhouse(s, y0, { fixedBox, random }) {
  const h = s.house;
  const { wing, leanTo: lean, garden } = h;
  const group = new THREE.Group();
  group.name = 'farmhouse';
  const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, ...extra });
  const oldStone = std(oldStoneTexture(random));
  const newStone = std(newStoneTexture(random));
  const dressed = std(dressedStoneTexture(random));
  const lime = std(limewashTexture(random), { roughness: 1 });
  const slate = std(stoneSlateTexture(random), { roughness: 0.85, side: THREE.DoubleSide });
  const castIron = std(castIronTexture(random), { roughness: 0.5, metalness: 0.5, side: THREE.DoubleSide });
  const timber = std(woodTexture(random), { roughness: 0.9 });
  const paint = std(paintedTexture(random), { roughness: 0.55 });
  const doorMat = std(doorTexture(random), { roughness: 0.5 });
  const lawn = std(lawnTexture(random), { roughness: 1 });
  const flowers = std(flowersTexture(random), { roughness: 1 });
  const logs = std(logStackTexture(random), { roughness: 1 });
  const bark = std(barkTexture(random), { roughness: 1 });
  const iron = mat(0x24282a, { metalness: 0.6, roughness: 0.5 });
  const brass = mat(0xb8a24a, { metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ map: sashTexture(false), roughness: 0.2, metalness: 0.2 });
  // Windows and the door lamp glow once it is dark (setNight): the emissive is scaled with the darkness, never a light. A window is lit or dark at random.
  const glow = new THREE.MeshStandardMaterial({ map: glass.map, emissive: 0xffffff, emissiveMap: sashTexture(true), emissiveIntensity: 0, roughness: 0.4 });
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xddd6c0, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.4 });
  const add = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    group.add(o);
    return o;
  };
  const box = (w, ht, d, m, x, y, z, tile = 2) => add(worldBox(w, ht, d, tile), m, x, y, z);
  const sink = 0.4; // walls go this far into the ground, so no gap shows where it isn't quite level
  const eaveOver = 0.4;
  const verge = 0.35;

  // A thing on a wall: `u` runs along it (a world x on a z-facing wall, a world z on an x-facing one), `v` is the height above y0, `w` is how far out from the wall's face `c`.
  // Each part's back runs on into the wall by its own few mm (`embed`), so the backs of the many parts on one wall never share a plane (tests/farmhouse.test.js).
  let embedded = 0;
  // The faces nobody sees are left off (a part's back is against the wall, a stood-on part's foot in the ground), and a `pane` is only its front face. BoxGeometry's faces
  // are +x, -x, +y, -y, +z, -z, six indices each.
  const dropFaces = (geo, faces) => {
    const idx = geo.getIndex().array;
    const keep = [];
    for (let f = 0; f < 6; f++) if (!faces.includes(f)) keep.push(...idx.slice(f * 6, f * 6 + 6));
    geo.setIndex(keep);
    return geo;
  };
  const onWall = (axis, sign, c) => (du, dv, dw, m, u, v, w, tile = 1, pane = false) => {
    const [tu, tv] = Array.isArray(tile) ? tile : [tile, tile];
    const e = 0.02 + 0.005 * (embedded++ % 20);
    const dwe = dw + e;
    const we = w - e / 2;
    const down = v - dv / 2 < 0.005 ? e : 0; // a part standing on the ground sinks by the same, for the same reason
    const dve = dv + down;
    const ve = v - down / 2;
    const front = axis === 'z' ? (sign < 0 ? 5 : 4) : sign > 0 ? 0 : 1;
    const hidden = pane ? [0, 1, 2, 3, 4, 5].filter((f) => f !== front) : [front ^ 1, ...(down ? [3] : [])];
    const geo = dropFaces(axis === 'z' ? worldBox(du, dve, dwe, tu, tv) : worldBox(dwe, dve, du, tu, tv), hidden);
    return axis === 'z' ? add(geo, m, u, y0 + ve, c + sign * we) : add(geo, m, c + sign * we, y0 + ve, u);
  };

  // Walls: the main range in dark old stone, the wing in newer, the lean-to in the old. The east end of the main range is limewashed.
  const hw = h.outer.maxX - h.outer.minX;
  const hd = h.outer.maxZ - h.outer.minZ;
  // A wall is one plane, seen from outside only (nobody goes in), as tall as the wall and sunk `sink` into the ground: `face` is the way it looks, 'n', 's', 'e' or 'w'.
  const wallFace = (len, top, m, face, x, z) => {
    const geo = new THREE.PlaneGeometry(len, top + sink);
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * len) / 2, (uv.getY(i) * (top + sink)) / 2);
    return add(geo, m, x, y0 - sink + (top + sink) / 2, z, { s: 0, n: Math.PI, e: Math.PI / 2, w: -Math.PI / 2 }[face]);
  };
  wallFace(hw, h.wallHeight, oldStone, 'n', h.x, h.outer.minZ);
  wallFace(hw, h.wallHeight, oldStone, 's', h.x, h.outer.maxZ);
  wallFace(hd, h.wallHeight, oldStone, 'w', h.outer.minX, h.z);
  wallFace(hd, h.wallHeight, oldStone, 'e', h.outer.maxX, h.z);
  fixedBox(h.x, y0 + h.wallHeight / 2, h.z, h.halfX, h.wallHeight / 2 + 0.5, h.halfZ);
  dropFaces(box(0.2, h.wallHeight, hd - 0.04, lime, h.outer.maxX - 0.07, y0 + h.wallHeight / 2, h.z, 4).geometry, [1, 3]); // the render on the east end, 3 cm proud of the stone
  const ww = wing.outer.maxX - wing.outer.minX;
  const wd = wing.outer.maxZ - wing.outer.minZ;
  wallFace(ww, wing.wallHeight, newStone, 'n', wing.x, wing.outer.minZ);
  wallFace(ww, wing.wallHeight, newStone, 's', wing.x, wing.outer.maxZ);
  wallFace(wd, wing.wallHeight, newStone, 'w', wing.outer.minX, wing.z);
  fixedBox(wing.x, y0 + wing.wallHeight / 2, wing.z, wing.halfX, wing.wallHeight / 2 + 0.5, wing.halfZ);
  const lw = lean.outer.maxX - lean.outer.minX;
  const ld = lean.outer.maxZ - lean.outer.minZ;
  // The lean-to's walls: a south wall and the two end walls cut to the catslide's slope (the roof comes down over them), standing against the main range's back wall.
  const pitch = Math.atan2(h.ridge - h.wallHeight, h.halfZ); // the main roof's, which the catslide carries on down
  const tanP = Math.tan(pitch);
  const catDrop = (h.ridge - h.wallHeight) / h.halfZ;
  const leanRun = lean.outer.maxZ + 0.35 - h.z; // from the ridge to the catslide's edge, past the south wall
  const eaveY = h.ridge - catDrop * leanRun; // the catslide's lower edge
  box(lw - 0.8, lean.wallHeight + sink, 0.4, oldStone, lean.x, y0 - sink + (lean.wallHeight + sink) / 2, lean.outer.maxZ - 0.2); // between the end walls
  fixedBox(lean.x, y0 + lean.wallHeight / 2, lean.z, lean.halfX, lean.wallHeight / 2 + 0.5, lean.halfZ);
  for (const side of [-1, 1]) {
    const end = new THREE.Shape(); // the end wall in profile: z along the lean-to, y up, high at the main range and low at the south wall
    end.moveTo(0, -sink);
    end.lineTo(ld, -sink);
    end.lineTo(ld, lean.wallHeight);
    end.lineTo(0, h.wallHeight + 0.02);
    end.closePath();
    const geo = new THREE.ExtrudeGeometry(end, { depth: 0.4, bevelEnabled: false });
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    geo.rotateY(-Math.PI / 2); // the shape's x (along the lean-to) becomes world +z and the extrusion's depth runs back along -x
    add(geo, oldStone, side > 0 ? lean.outer.maxX : lean.outer.minX + 0.4, y0, h.outer.maxZ - 0.01);
  }

  // Gables: the main range's two (the east in limewash), the wing's west one in newer stone.
  const gableShape = (width, rise) => {
    const g = new THREE.Shape();
    g.moveTo(-width / 2, 0);
    g.lineTo(width / 2, 0);
    g.lineTo(0, rise);
    g.closePath();
    return g;
  };
  const gable = (shape, m, x, y, z) => {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.4, bevelEnabled: false });
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    geo.translate(0, 0, -0.2);
    geo.rotateY(Math.PI / 2);
    add(geo, m, x, y0 + y, z);
  };
  gable(gableShape(hd, h.ridge - h.wallHeight), lime, h.outer.maxX - 0.2, h.wallHeight, h.z);
  gable(gableShape(hd, h.ridge - h.wallHeight), oldStone, h.outer.minX + 0.2, h.wallHeight, h.z);
  gable(gableShape(wd, wing.ridge - wing.wallHeight), newStone, wing.outer.minX + 0.2, wing.wallHeight, wing.z);

  // Roofs. A slope from a ridge line `over` out to its edge, `x0` to `x1` wide, falling at `k` per metre; `side` +1 is the south slope.
  const slab = (x0, x1, ridgeY, zRidge, over, side, k, m, thick = 0.1) => {
    const drop = k * over;
    const slope = Math.hypot(over, drop);
    const o = box(x1 - x0, thick, slope, m, (x0 + x1) / 2, y0 + ridgeY + thick / 2 - drop / 2, zRidge + (side * over) / 2, 2);
    dropFaces(o.geometry, [3]); // the underside is over the house, and the eaves' undercourse is the part seen from below
    o.rotation.x = side * Math.atan2(drop, over);
    // The eaves' undercourse: a second course of stone slates under the first at its lower edge, which is what makes the overhang look thick.
    const ang = Math.atan2(drop, over);
    const s = slope - 0.3;
    const u = box(x1 - x0 - 0.1, 0.1, 0.6, m, (x0 + x1) / 2, y0 + ridgeY - (drop * s) / slope - Math.cos(ang) * 0.085 + thick / 2, zRidge + (side * over * s) / slope - side * Math.sin(ang) * 0.085, 2);
    u.rotation.x = side * ang;
    return { drop, slope, ang };
  };
  const kMain = catDrop;
  const rx0 = h.roof.minX;
  const rx1 = h.roof.maxX;
  const north = slab(rx0 + 0.01, rx1 - 0.01, h.ridge, h.z, h.halfZ + eaveOver, -1, kMain, slate);
  const lx0 = lean.outer.minX - 0.1;
  const lx1 = lean.outer.maxX + 0.1;
  slab(rx0, lx0, h.ridge, h.z, h.halfZ + eaveOver, 1, kMain, slate);
  const cat = slab(lx0, lx1, h.ridge, h.z, leanRun, 1, kMain, slate); // the catslide: the same slope carried on down over the scullery
  slab(lx1, rx1, h.ridge, h.z, h.halfZ + eaveOver, 1, kMain, slate);
  box(rx1 - rx0 - 0.06, 0.1, 0.3, dressed, h.x, y0 + h.ridge + 0.1, h.z, 1); // the ridge stones
  const kWing = (wing.ridge - wing.wallHeight) / wing.halfZ;
  const wingRoofX0 = wing.roof.minX;
  const wingRoofX1 = wing.outer.maxX + 0.05;
  for (const side of [-1, 1]) slab(wingRoofX0 + (side < 0 ? 0.01 : 0), wingRoofX1 - (side < 0 ? 0.01 : 0), wing.ridge, wing.z, wing.halfZ + eaveOver, side, kWing, slate);
  box(wingRoofX1 - wingRoofX0 - 0.06, 0.1, 0.26, dressed, (wingRoofX0 + wingRoofX1) / 2, y0 + wing.ridge + 0.1, wing.z, 1);

  // Gable copings (a stone along each slope's end, proud of the slates), kneelers (the stepped stones at its foot) and a stack on each gable end with two pots.
  const northSlope = north.slope;
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? h.outer.maxX + 0.1 : h.outer.minX - 0.1;
    const xl = sx > 0 ? h.outer.maxX + 0.08 : h.outer.minX - 0.08; // the lower kneeler a little off the coping's and the upper's lines, so no two of their sides share a plane
    for (const side of [-1, 1]) {
      const c = box(side < 0 ? 0.34 : 0.32, 0.16, northSlope - 0.05, dressed, x, y0 + h.ridge + 0.12 - (kMain * (h.halfZ + eaveOver)) / 2, h.z + (side * (h.halfZ + eaveOver)) / 2, 1);
      c.rotation.x = side * north.ang;
      const footZ = h.z + side * (h.halfZ + eaveOver - 0.2);
      box(0.46, 0.3, 0.5, dressed, xl, y0 + h.ridge - kMain * (h.halfZ + eaveOver - 0.2), footZ, 1); // the kneeler's lower step
      box(0.36, 0.22, 0.4, dressed, x, y0 + h.ridge - kMain * (h.halfZ + eaveOver - 0.7) + 0.02, h.z + side * (h.halfZ + eaveOver - 0.7), 1); // and its upper
    }
  }
  const wx = wing.outer.minX - 0.1;
  for (const side of [-1, 1]) {
    const c = box(side < 0 ? 0.3 : 0.28, 0.14, Math.hypot(wing.halfZ + eaveOver, kWing * (wing.halfZ + eaveOver)) - 0.05, dressed, wx, y0 + wing.ridge + 0.1 - (kWing * (wing.halfZ + eaveOver)) / 2, wing.z + (side * (wing.halfZ + eaveOver)) / 2, 1);
    c.rotation.x = side * Math.atan2(kWing * (wing.halfZ + eaveOver), wing.halfZ + eaveOver);
  }
  const pots = mat(0x8a4a30);
  for (const sx of [-1, 1]) {
    const x = sx > 0 ? h.outer.maxX - 0.46 : h.outer.minX + 0.46; // proud of the gable face by 6 cm on the east, flush-ish on the west against the wing
    const top = h.ridge + 1.35;
    box(1.0, top - (h.ridge - 1.3), 0.9, oldStone, x, y0 + (top + h.ridge - 1.3) / 2, h.z);
    box(1.14, 0.12, 1.04, dressed, x, y0 + top + 0.06, h.z, 1); // the cap
    for (const dz of [-0.24, 0.24]) add(new THREE.CylinderGeometry(0.1, 0.13, 0.4, 6, 1, true), pots, x, y0 + top + 0.32, h.z + dz);
  }

  // The wall trims: `w` 0 is the wall's face. A mullioned window of `lights` lights: glass, a stone mullion between each, a sill and a drip hood over, set on the wall at `u`.
  const northZ = h.outer.minZ;
  const mullioned = (on, { u, y, lights, w, ht, lit }) => {
    on(w, ht, 0.03, lit ? glow : glass, u, y, 0.06, [w / lights, ht], true);
    for (let i = 1; i < lights; i++) on(0.1, ht + 0.04, 0.06, dressed, u - w / 2 + (w * i) / lights, y, 0.1);
    on(w + 0.34, 0.1, 0.18, dressed, u, y - ht / 2 - 0.07, 0.09); // the sill
    on(w + 0.5, 0.12, 0.2, dressed, u, y + ht / 2 + 0.15, 0.1); // the hood over, a long drip mould
  };
  const lit = () => random() < 0.6;
  const front = onWall('z', -1, northZ);
  for (const [dx, l, w] of [[-5.2, 3, 2.1], [0.6, 3, 2.1], [4.5, 2, 1.5]]) mullioned(front, { u: h.x + dx, y: 1.5, lights: l, w, ht: 1.1, lit: lit() });
  for (const [dx, l, w, ht] of [[-5.2, 1, 0.7, 0.95], [-3.2, 1, 0.5, 0.8], [1.1, 2, 1.1, 0.95], [4.1, 1, 0.7, 0.95], [6.4, 1, 0.45, 0.7]]) mullioned(front, { u: h.x + dx, y: 3.7, lights: l, w, ht, lit: lit() });
  const back = onWall('z', 1, h.outer.maxZ);
  mullioned(back, { u: h.x - 5.1, y: 1.5, lights: 2, w: 1.5, ht: 1.1, lit: lit() });
  mullioned(back, { u: h.x - 5.1, y: 3.7, lights: 1, w: 0.7, ht: 0.95, lit: lit() });
  mullioned(back, { u: h.x + 6.8, y: 1.5, lights: 1, w: 0.6, ht: 0.9, lit: lit() });
  mullioned(back, { u: h.x + 6.8, y: 3.7, lights: 1, w: 0.6, ht: 0.9, lit: lit() });
  const east = onWall('x', 1, h.outer.maxX + 0.03);
  mullioned(east, { u: h.z + 1.7, y: 1.5, lights: 2, w: 1.2, ht: 1.1, lit: lit() });
  mullioned(east, { u: h.z + 1.7, y: 3.7, lights: 1, w: 0.6, ht: 0.95, lit: lit() });
  const wingFront = onWall('z', -1, wing.outer.minZ);
  mullioned(wingFront, { u: wing.x, y: 1.4, lights: 2, w: 1.3, ht: 1.0, lit: lit() });
  mullioned(wingFront, { u: wing.x, y: 2.95, lights: 1, w: 0.6, ht: 0.7, lit: lit() });
  mullioned(onWall('x', -1, wing.outer.minX), { u: wing.z, y: 1.4, lights: 2, w: 1.2, ht: 1.0, lit: lit() });
  const leanBack = onWall('z', 1, lean.outer.maxZ);
  mullioned(leanBack, { u: lean.x + 0.5, y: 1.3, lights: 2, w: 1.1, ht: 0.9, lit: lit() });

  // The front door: off to one side, a stone surround (jambs and a deep lintel), a slated hood on two corbels, a boot scraper and a worn step.
  const dw = h.door.halfWidth * 2;
  const dx = h.door.x;
  const dh = h.door.height;
  for (const sx of [-1, 1]) front(0.22, dh + 0.1, 0.1, dressed, dx + (sx * (dw + 0.22)) / 2, dh / 2 + 0.05, 0.05);
  front(dw + 0.8, 0.3, 0.16, dressed, dx, dh + 0.25, 0.08); // the deep lintel
  front(dw, dh, 0.08, doorMat, dx, dh / 2, 0.04, [dw, dh]);
  add(new THREE.SphereGeometry(0.035, 6, 4), brass, dx + dw / 2 - 0.12, y0 + 1.0, northZ - 0.1);
  for (const sx of [-1, 1]) front(0.2, 0.3, 0.5, dressed, dx + sx * (dw / 2 + 0.3), 2.62, 0.28); // the hood's corbels
  const run = 0.95;
  const rise = 0.42;
  const hood = front(dw + 1.1, 0.07, Math.hypot(run, rise), slate, dx, 2.99, run / 2 - 0.02, 2);
  hood.rotation.x = -Math.atan2(rise, run);
  hood.position.z = northZ - run / 2 + 0.02;
  front(0.14, 0.22, 0.14, lampGlow, dx + 1.35, 1.9, 0.07);
  front(dw + 0.8, 0.18, 0.6, dressed, dx, 0.09, 0.3); // the step, worn
  front(dw + 1.2, 0.09, 0.4, dressed, dx, 0.045, 0.75); // and the foot of it
  fixedBox(dx, y0 + 0.09, northZ - 0.3, (dw + 0.8) / 2, 0.09, 0.3);
  fixedBox(dx, y0 + 0.045, northZ - 0.75, (dw + 1.2) / 2, 0.045, 0.2);
  front(0.26, 0.2, 0.2, dressed, dx + 1.0, 0.1, 0.1); // the boot scraper: a stone block
  front(0.32, 0.12, 0.03, iron, dx + 1.0, 0.26, 0.09); // and its blade
  fixedBox(dx + 1.0, y0 + 0.1, northZ - 0.1, 0.13, 0.1, 0.1);

  // The back door, in the scullery's south wall: a plain door under a stone lintel with a step.
  const bd = lean.backDoor;
  const bw = bd.halfWidth * 2;
  const bf = leanBack;
  for (const sx of [-1, 1]) bf(0.16, bd.height + 0.08, 0.08, dressed, bd.x + (sx * (bw + 0.16)) / 2, bd.height / 2 + 0.04, 0.04);
  bf(bw + 0.6, 0.2, 0.12, dressed, bd.x, bd.height + 0.18, 0.06);
  bf(bw, bd.height, 0.07, doorMat, bd.x, bd.height / 2, 0.035, [bw, bd.height]);
  bf(bw + 0.5, 0.15, 0.5, dressed, bd.x, 0.075, 0.25);
  fixedBox(bd.x, y0 + 0.075, lean.outer.maxZ + 0.25, (bw + 0.5) / 2, 0.075, 0.25);

  // The catslide's end: the lean-to's south edge is under the long slate slope. Gutters: half-round cast iron along each eave, on brackets, with round downpipes.
  const gutter = (x0, x1, y, z, brackets = 0) => {
    const geo = new THREE.CylinderGeometry(0.07, 0.07, x1 - x0, 8, 1, true, Math.PI, Math.PI);
    geo.rotateZ(Math.PI / 2);
    add(geo, castIron, (x0 + x1) / 2, y0 + y, z);
    for (let i = 0; i < brackets; i++) box(0.03, 0.05, 0.16, castIron, x0 + 0.3 + (i * (x1 - x0 - 0.6)) / Math.max(1, brackets - 1), y0 + y - 0.04, z, 1);
  };
  const pipe = (x, z, yTop, yBottom) => add(new THREE.CylinderGeometry(0.045, 0.045, yTop - yBottom, 8, 1, true), castIron, x, y0 + (yTop + yBottom) / 2, z);
  const edgeY = h.ridge - kMain * (h.halfZ + eaveOver);
  gutter(rx0 + 0.1, rx1 - 0.1, edgeY - 0.05, northZ - eaveOver + 0.04, 4);
  gutter(rx0 + 0.1, lx0 - 0.05, edgeY - 0.05, h.outer.maxZ + eaveOver - 0.04);
  gutter(lx1 + 0.05, rx1 - 0.1, edgeY - 0.05, h.outer.maxZ + eaveOver - 0.04);
  gutter(lx0 + 0.1, lx1 - 0.1, eaveY - 0.05, lean.outer.maxZ + 0.31, 3);
  const wEdge = wing.ridge - kWing * (wing.halfZ + eaveOver);
  gutter(wingRoofX0 + 0.1, wing.outer.maxX - 0.1, wEdge - 0.05, wing.outer.minZ - eaveOver + 0.04);
  gutter(wingRoofX0 + 0.1, wing.outer.maxX - 0.1, wEdge - 0.05, wing.outer.maxZ + eaveOver - 0.04);
  pipe(h.outer.minX + 0.7, northZ - eaveOver + 0.04, edgeY - 0.1, 0.1);
  const buttX = h.outer.maxX - 0.3; // the downpipe at the east end of the front feeds the water butt below it
  pipe(buttX, northZ - eaveOver + 0.04, edgeY - 0.1, 1.05);
  pipe(lx1 - 0.2, lean.outer.maxZ + 0.31, eaveY - 0.1, 0.1);
  pipe(wing.outer.minX + 0.3, wing.outer.minZ - eaveOver + 0.04, wEdge - 0.1, 0.1);
  // The water butt: a barrel under the east downpipe's foot, with a lid the pipe runs into, a tap low down, a drip stone under it.
  const butt = std(barrelTexture(), { color: 0x2f5a6c, roughness: 0.55 });
  const bz = northZ - 0.55;
  add(new THREE.CylinderGeometry(0.36, 0.3, 0.95, 12), butt, buttX, y0 + 0.475, bz);
  add(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 12), mat(0x1c3440), buttX, y0 + 0.97, bz);
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), brass, buttX - 0.34, y0 + 0.18, bz).rotation.z = Math.PI / 2;
  fixedBox(buttX, y0 + 0.475, bz, 0.36, 0.5, 0.36);

  // Odds and ends: the east gable's satellite dish and meter box, an outside tap at the back, a washing line behind the scullery, logs stacked under the catslide's edge,
  // two wheelie bins at the front's east end.
  const gableE = onWall('x', 1, h.outer.maxX + 0.03);
  gableE(0.3, 0.45, 0.18, paint, h.z - 3.2, 1.4, 0.09); // the meter box
  gableE(0.12, 0.1, 0.03, iron, h.z - 3.2, 1.5, 0.2); // its window
  add(new THREE.SphereGeometry(0.4, 12, 2, 0, Math.PI * 2, 0, Math.PI / 3), mat(0xc9cdcf, { roughness: 0.5, side: THREE.DoubleSide }), h.outer.maxX + 0.5, y0 + 4.3, h.z - 2.2).rotation.z = -Math.PI / 2 + 0.25; // the dish
  gableE(0.04, 0.04, 0.4, iron, h.z - 2.2, 4.3, 0.2);
  const tapOn = back;
  tapOn(0.04, 0.5, 0.04, iron, h.x - 2, 0.65, 0.06);
  tapOn(0.05, 0.04, 0.12, brass, h.x - 2, 0.45, 0.1);
  const lineZ = h.outer.maxZ + 3.5;
  const lineX0 = h.x - 8.5;
  const lineX1 = h.x - 2.5;
  for (const px of [lineX0, lineX1]) {
    box(0.08, 2.3, 0.08, timber, px, y0 + 1.15, lineZ, 0.6);
    fixedBox(px, y0 + 1.15, lineZ, 0.06, 1.15, 0.06);
  }
  add(new THREE.CylinderGeometry(0.008, 0.008, lineX1 - lineX0, 4), iron, (lineX0 + lineX1) / 2, y0 + 2.1, lineZ).rotation.z = Math.PI / 2;
  for (const [px, wpx, wc] of [[lineX0 + 1.3, 0.5, 0xd9d4c4], [lineX0 + 2.6, 0.35, 0x7a8fa8], [lineX0 + 4.1, 0.55, 0xa8423a]]) box(wpx, 0.7, 0.02, mat(wc, { roughness: 1 }), px, y0 + 1.72, lineZ, 1);
  const stackX = lx1 - 1.05;
  box(1.3, 1.0, 0.6, bark, stackX, y0 + 0.5, lean.outer.maxZ + 0.62, 1); // the stack's sides, bark
  add(worldBox(1.2, 0.98, 0.02, 1), logs, stackX, y0 + 0.5, lean.outer.maxZ + 0.93); // its sawn ends
  fixedBox(stackX, y0 + 0.5, lean.outer.maxZ + 0.62, 0.65, 0.5, 0.31);
  const ribs = binTexture(random);
  const bin = (x, colour, lidColour) => {
    const body = add(new THREE.CylinderGeometry(0.36, 0.3, 0.95, 4, 1), new THREE.MeshStandardMaterial({ map: ribs, color: colour, roughness: 0.6 }), x, y0 + 0.5, northZ - 0.5, Math.PI / 4);
    body.scale.set(1, 1, 1.15);
    box(0.68, 0.07, 0.8, mat(lidColour, { roughness: 0.55 }), x, y0 + 1.0, northZ - 0.5, 1);
    fixedBox(x, y0 + 0.5, northZ - 0.5, 0.34, 0.52, 0.4);
  };
  bin(h.outer.maxX - 2.5, 0x2f6b3a, 0x24562e);
  bin(h.outer.maxX - 1.7, 0x2a2d30, 0x1d1f21);

  // The garden: a lawn walled off from the yard with a drystone wall and capping, a gate in line with the door (hung open, so the path in is clear), a flagged path to the step,
  // a bench under the window and a trough of flowers.
  const g = garden;
  const gh = 0.85;
  const wallBox = (x, z, hx, hz, lift = 0) => {
    box(hx * 2, gh + sink, hz * 2, oldStone, x, y0 - sink + (gh + sink) / 2, z);
    box(hx * 2 + 0.1 + lift * 20, 0.1, hz * 2 + 0.1 + lift * 20, dressed, x, y0 + gh + 0.05 + lift, z, 1); // the capping; the side walls' a few mm higher, so no two caps share a plane at the corners
    fixedBox(x, y0 + gh / 2, z, hx, gh / 2 + 0.3, hz);
  };
  const gz = g.minZ + 0.2;
  wallBox((g.minX + g.gate.x - g.gate.halfWidth - 0.15) / 2, gz, (g.gate.x - g.gate.halfWidth - 0.15 - g.minX) / 2, 0.2);
  wallBox((g.maxX + g.gate.x + g.gate.halfWidth + 0.15) / 2, gz, (g.maxX - g.gate.x - g.gate.halfWidth - 0.15) / 2, 0.2);
  for (const x of [g.minX + 0.2, g.maxX - 0.2]) wallBox(x, (g.minZ + 0.4 + g.maxZ) / 2, 0.2, (g.maxZ - g.minZ - 0.4) / 2, 0.006);
  for (const sx of [-1, 1]) {
    const px = g.gate.x + sx * (g.gate.halfWidth + 0.15);
    box(0.3, 1.2 + sink + 0.05, 0.3, dressed, px, y0 - sink - 0.05 + (1.2 + sink + 0.05) / 2, gz, 1); // a little deeper than the wall it stands in
    box(0.4, 0.08, 0.4, dressed, px, y0 + 1.24, gz, 1);
    fixedBox(px, y0 + 0.6, gz, 0.15, 0.7, 0.15);
  }
  const leaf = gateLeaf(timber, iron, 1.0);
  leaf.scale.y = 0.75;
  leaf.position.set(g.gate.x - g.gate.halfWidth - 0.02, y0 + 0.02, gz + 0.22); // swung in to lie along +z, clear of the path
  group.add(leaf);
  const lawnW = g.maxX - g.minX - 0.8;
  const lawnD = g.maxZ - g.minZ - 0.4;
  const lawnTop = y0 + 0.045;
  dropFaces(box(lawnW, 0.06, lawnD, lawn, (g.minX + g.maxX) / 2, lawnTop - 0.03, (g.minZ + 0.4 + g.maxZ) / 2, 2).geometry, [0, 1, 3, 4, 5]); // its top only
  const flag = std(dressedStoneTexture(random));
  dropFaces(box(1.1, 0.06, g.maxZ - g.minZ - 0.2, flag, g.gate.x, y0 + 0.04, (g.minZ + 0.2 + g.maxZ) / 2, 1.2).geometry, [3]); // out through the gate
  const trough = onWall('z', -1, northZ);
  trough(1.1, 0.26, 0.28, timber, h.x - 5.2, 0.2 + 0.13, 0.2, 0.6);
  trough(1.0, 0.04, 0.2, flowers, h.x - 5.2, 0.2 + 0.28, 0.2, 1);
  const benchX = h.x - 0.3;
  const weathered = std(woodTexture(random, [128, 120, 108]), { roughness: 0.95 });
  for (const dz of [-0.14, 0, 0.14]) box(1.5, 0.04, 0.12, weathered, benchX, y0 + 0.47, northZ - 0.45 + dz, 0.6);
  for (const dy of [0.72, 0.86]) box(1.5, 0.1, 0.03, weathered, benchX, y0 + dy, northZ - 0.26, 0.6);
  for (const dx2 of [-0.66, 0.66]) {
    box(0.06, 0.48, 0.5, iron, benchX + dx2, y0 + 0.24, northZ - 0.45, 1);
    box(0.05, 0.5, 0.05, iron, benchX + dx2, y0 + 0.72, northZ - 0.26, 1);
  }
  fixedBox(benchX, y0 + 0.45, northZ - 0.4, 0.78, 0.45, 0.3);
  return { group, glow, lampGlow };
}

export function buildNeighbourFarm(c) {
  const { scene, layout, heights, fixedBox, random, gateParams } = c;
  const nf = createNeighbourFarm(layout);
  if (!nf) return null;
  const s = nf.shape;
  const y0 = heights.heightAt((s.outline.minX + s.outline.maxX) / 2, (s.outline.minZ + s.outline.maxZ) / 2);
  const group = new THREE.Group();
  group.name = 'neighbourFarm';
  group.userData.fullDistanceKey = 'neighbourFullDistance'; // FarDetail swaps it for its far version at its own distance (the lane is 45 m off her wall)
  const sink = 0.4; // walls go this far into the ground, so no gap shows where it isn't quite level
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const slate = new THREE.MeshStandardMaterial({ map: slateTexture(random), roughness: 0.8, side: THREE.DoubleSide });
  const weathered = new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 });
  const iron = mat(0x24282a, { metalness: 0.6, roughness: 0.5 });
  const add = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    group.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z, tile = 2) => add(worldBox(w, h, d, tile), m, x, y, z);

  // The yard's concrete, a hair above the ground (which is level at y0 inside the wall), so a tyre on it sits 1.5 cm in at most.
  const slab = s.slab;
  const top = y0 + 0.015;
  const yardConcrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 });
  box(slab.maxX - slab.minX, 0.08, slab.maxZ - slab.minZ, yardConcrete, (slab.minX + slab.maxX) / 2, top - 0.04, (slab.minZ + slab.maxZ) / 2, 4);

  // The wall: drystone with a capping course, and a stone pillar either side of the gateway.
  const cap = mat(0x77736a);
  // The north and south walls run the whole width; the pieces that meet them at the corners go a little deeper, and their caps a hair higher and
  // narrower, so no two faces of one way lie on one plane where the walls meet (tests/helpers/coplanar.js).
  s.walls.forEach((w, i) => {
    const down = i >= 2 ? sink + 0.02 : sink;
    const H = s.yard.wallHeight + down;
    const trim = i >= 2 ? 0.108 : 0.12;
    box(w.hx * 2, H, w.hz * 2, stone, w.x, y0 - down + H / 2, w.z);
    box(w.hx * 2 + trim, 0.1, w.hz * 2 + trim, cap, w.x, y0 + s.yard.wallHeight + (i >= 2 ? 0.056 : 0.05), w.z, 1);
    fixedBox(w.x, y0 + s.yard.wallHeight / 2, w.z, w.hx, s.yard.wallHeight / 2 + 0.5, w.hz);
  });
  const gx = s.gateway.x;
  const out = s.gateway.side === 'west' ? -1 : 1; // which way the lane is from the gateway: east on today's farm, west on the new one
  for (const z of [s.gateway.minZ - 0.3, s.gateway.maxZ + 0.3]) {
    box(0.8, 2 + sink + 0.05, 0.8, stone, gx, y0 - sink - 0.05 + (2 + sink + 0.05) / 2, z); // a little deeper than the wall it stands in
    box(0.95, 0.12, 0.95, cap, gx, y0 + 2.06, z, 1);
    fixedBox(gx, y0 + 1, z, 0.4, 1, 0.4);
  }
  // The gate: two five-bar leaves hung from the gateposts' inner faces that meet in the middle when shut and swing in to the yard, opened
  // from either side with E like the farm's own (trafficHost.js). A shut gate is a collider across the gateway; an open one leaves it clear.
  const gap = s.gateway.maxZ - s.gateway.minZ - 0.2; // between the posts' inner faces
  const leafLen = gap / 2 - 0.09; // the leaf's stile starts on the post's face, its other end stops 3 cm short of the middle
  const leaves = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group(); // at the hinge, turned to swing the leaf
    pivot.position.set(gx, y0 + 0.02, side < 0 ? s.gateway.minZ + 0.16 : s.gateway.maxZ - 0.16);
    const leaf = gateLeaf(weathered, iron, leafLen);
    if (side > 0) leaf.rotation.y = Math.PI; // runs the other way, back towards the middle
    pivot.add(leaf);
    group.add(pivot);
    leaves.push({ pivot, side });
    for (const dy of [0.3, 1.0]) add(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), iron, gx, y0 + 0.02 + dy, pivot.position.z); // the hinge pins
  }
  const gateY = y0 + 0.9;
  const gate = new Gate({
    id: 'neighbour',
    params: gateParams,
    x: gx,
    z: s.gateway.z,
    open: false,
    pose: (a) => {
      for (const { pivot, side } of leaves) pivot.rotation.y = out * side * a * (Math.PI / 2 - 0.08);
    },
    solid: fixedBox(gx, gateY, s.gateway.z, 0.1, 0.9, gap / 2),
  });

  // The postbox: a cast-iron box set into the south gatepost's lane face, with a hood over its slot, a plate of times and a collar.
  const pz = s.gateway.maxZ + 0.3;
  const faceX = gx + 0.4 * out;
  const postbox = new THREE.MeshStandardMaterial({ map: postboxTexture(random), roughness: 0.45, metalness: 0.2 });
  const ironRed = mat(0x9c1218, { roughness: 0.45, metalness: 0.2 });
  box(0.04, 0.5, 0.4, ironRed, faceX + 0.01 * out, y0 + 1.1, pz, 1); // the frame
  add(worldBox(0.03, 0.42, 0.3, 0.3, 0.42), postbox, faceX + 0.04 * out, y0 + 1.1, pz); // the face: one texture tile, reading from the lane
  add(new THREE.BoxGeometry(0.1, 0.05, 0.36), ironRed, faceX + 0.07 * out, y0 + 1.28, pz); // the hood over the slot
  add(new THREE.BoxGeometry(0.06, 0.02, 0.32), iron, faceX + 0.05 * out, y0 + 1.31, pz); // the hood's lip

  // The farmhouse (#910), with its wing, scullery, garden, water butt, bins and bench: its parts join the yard's group and its windows glow at night.
  const farmhouse = buildFarmhouse(s, y0, { fixedBox, random });
  for (const o of [...farmhouse.group.children]) group.add(o);

  // The barn: block walls to 1.4 m, green sheeting above, a rusty roof, the big door in its east wall (facing the yard).
  const b = s.barn;
  const blocks = new THREE.MeshStandardMaterial({ map: blockTexture(random), roughness: 0.9 });
  const sheet = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#5d6e58', 0.35), roughness: 0.8, metalness: 0.15 });
  const tin = new THREE.MeshStandardMaterial({ map: corrugatedTexture(random, '#7b5a42', 0.9), roughness: 0.85, metalness: 0.2, side: THREE.DoubleSide });
  const t = 0.16;
  const low = 1.4;
  const bw = b.outer.maxX - b.outer.minX;
  const bd = b.outer.maxZ - b.outer.minZ;
  const wall = (x, z, wx, wz, y1 = b.wallHeight, y2 = 0) => {
    // Block up to `low`, sheet above, between heights y2 and y1 (the lowest course goes `sink` into the ground).
    const lo1 = Math.min(low, y1);
    const bottom = y2 === 0 ? -sink : y2;
    if (lo1 > bottom) box(wx, lo1 - bottom, wz, blocks, x, y0 + (bottom + lo1) / 2, z, 1.8);
    const s0 = Math.max(low, y2);
    if (y1 > s0) box(wx, y1 - s0, wz, sheet, x, y0 + (y1 + s0) / 2, z, 1.2);
    fixedBox(x, y0 + (y1 + y2) / 2, z, wx / 2, (y1 - y2) / 2, wz / 2);
  };
  wall(b.x, b.outer.minZ + t / 2, bw, t); // north
  wall(b.x, b.outer.maxZ - t / 2, bw, t); // south
  wall(b.outer.minX + t / 2, b.z, t, bd - 2 * t); // west
  const dz0 = b.door.z - b.door.halfWidth;
  const dz1 = b.door.z + b.door.halfWidth;
  wall(b.outer.maxX - t / 2, (b.outer.minZ + t + dz0) / 2, t, dz0 - b.outer.minZ - t); // east, north of the door
  wall(b.outer.maxX - t / 2, (dz1 + b.outer.maxZ - t) / 2, t, b.outer.maxZ - t - dz1); // east, south of the door
  wall(b.outer.maxX - t / 2, b.door.z, t, dz1 - dz0, b.wallHeight, b.door.height); // over the door
  box(t + 0.1, 0.22, dz1 - dz0 + 0.3, mat(0x33383a, { metalness: 0.4 }), b.outer.maxX - t / 2, y0 + b.door.height - 0.1, b.door.z, 1);
  // The big door's frame (#569): a steel jamb each side standing proud of the wall, a header across them, a concrete ramp up over the threshold and the top rail
  // the sliding leaves will hang from (#963 hangs them), running back along the wall with its brackets and end stop. The opening is no longer a bare gap.
  const steel = mat(0x4a4f52, { metalness: 0.55, roughness: 0.5 });
  steel.name = 'barnDoorFrame';
  const dh = b.door.height;
  const outerX = b.outer.maxX;
  for (const dz of [dz0 - 0.12, dz1 + 0.12]) box(0.3, dh + 0.14, 0.24, steel, outerX + 0.04, y0 + (dh + 0.14) / 2 - 0.02, dz, 0.5);
  box(0.3, 0.34, dz1 - dz0 + 0.72, steel, outerX + 0.04, y0 + dh + 0.34, b.door.z, 0.5);
  box(1.0, 0.1, dz1 - dz0 + 0.9, yardConcrete, outerX + 0.55, y0 + 0.05, b.door.z, 2); // the ramp's block, a hair under the slab's edge
  const railLen = 5.4;
  box(0.1, 0.14, railLen + (dz1 - dz0) + 0.3, steel, outerX + 0.2, y0 + dh + 0.82, (dz0 - railLen + dz1 + 0.3) / 2, 0.5); // the top rail, along the wall to the north of the door
  for (let k = 0; k <= 4; k++) box(0.16, 0.12, 0.1, steel, outerX + 0.1, y0 + dh + 0.82, dz0 - railLen + (k * (railLen + (dz1 - dz0) + 0.3)) / 4, 0.3); // its brackets
  box(0.14, 0.2, 0.14, steel, outerX + 0.2, y0 + dh + 0.82, dz0 - railLen - 0.07, 0.3); // the end stop
  // Gables in sheeting, then the roof.
  const bGable = new THREE.Shape();
  bGable.moveTo(-bd / 2, 0);
  bGable.lineTo(bd / 2, 0);
  bGable.lineTo(0, b.ridge - b.wallHeight);
  bGable.closePath();
  for (const side of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(bGable, { depth: t, bevelEnabled: false });
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 1.2, uv.getY(i) / 3);
    geo.translate(0, 0, -t / 2);
    geo.rotateY(Math.PI / 2);
    add(geo, sheet, side > 0 ? b.outer.maxX - t / 2 : b.outer.minX + t / 2, y0 + b.wallHeight, b.z);
  }
  const bOver = b.roof.maxZ - b.z;
  const bDrop = (b.ridge - b.wallHeight) * (bOver / b.halfZ);
  const bSlope = Math.hypot(bOver, bDrop);
  const bPitch = Math.atan2(bDrop, bOver);
  for (const side of [-1, 1]) {
    const m = box(b.roof.maxX - b.roof.minX, 0.03, bSlope, tin, b.x, y0 + b.ridge + 0.04 - bDrop / 2, b.z + (side * bOver) / 2, 1);
    m.geometry = worldBox(b.roof.maxX - b.roof.minX, 0.03, bSlope, 1.2, 3);
    m.rotation.x = side * bPitch;
  }
  box(b.roof.maxX - b.roof.minX, 0.08, 0.24, mat(0x5d3a24, { metalness: 0.3 }), b.x, y0 + b.ridge + 0.07, b.z, 1);
  // Inside: the yard's concrete runs in under the door (the slab covers the floor), and a stack of square bales against the north wall.
  const straw = new THREE.MeshStandardMaterial({ map: strawTexture(random), roughness: 1 });
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 6 - layer; i++) {
      box(0.9, 0.45, 0.46, straw, b.outer.minX + 1.2 + i * 0.93 + layer * 0.3, y0 + 0.27 + layer * 0.45, b.outer.minZ + 0.5, 0.9);
      box(0.9, 0.45, 0.46, straw, b.outer.minX + 1.2 + i * 0.93 + layer * 0.3, y0 + 0.27 + layer * 0.45, b.outer.minZ + 0.99, 0.9);
    }
  }

  // Logs against the barn's south wall, two rows with the odd one leaning: bark on the side, sawn rings on each end.
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(random), roughness: 1 });
  const rings = new THREE.MeshStandardMaterial({ map: logEndTexture(random), roughness: 0.9 });
  const pile = logPile(b.outer, random);
  const logs = pile.logs;
  const logZ = pile.z;
  for (const l of logs) {
    const side = add(new THREE.CylinderGeometry(l.r, l.r, l.len, 10, 1, true), bark, l.x, y0 + l.y, logZ);
    side.rotation.order = 'YXZ'; // lie along z, then turn a little off square
    side.rotation.set(Math.PI / 2, l.yaw, 0);
    for (const e of [-1, 1]) {
      const end = add(new THREE.CircleGeometry(l.r, 10), rings, l.x + Math.sin(l.yaw) * e * l.len * 0.5, y0 + l.y, logZ + Math.cos(l.yaw) * e * l.len * 0.5);
      end.rotation.y = e > 0 ? l.yaw : l.yaw + Math.PI;
    }
  }
  fixedBox(b.outer.minX + 2.9, y0 + 0.3, logZ, 1.9, 0.3, pile.reach);

  // The dairy, on the new farm's neighbour: the parlour, the collecting yard, the bulk tank's room and the slurry store (dairyKit.js), merged with the rest by material.
  if (s.parlour) {
    const dm = dairyMaterials(random, yardConcrete);
    const deps = { fixedBox };
    for (const made of [buildParlour(s.parlour, y0, dm, deps), buildCollectingYard(s.collecting, s.parlour, y0, dm, deps), buildTankRoom(s.tankRoom, s.parlour, y0, dm, deps), buildSlurryStore(s.slurry, y0, dm, deps)]) {
      for (const o of [...made.children]) group.add(o);
    }
  }

  mergeStatic(group);

  // The parked vehicles: the farm's own models, scenery with a box each to ride into. They stand on the concrete (1.5 cm above the ground)
  // and the tractor has no bale spike on its back (it isn't a hay farm's, and the spike is for the player's).
  const vehicles = [];
  for (const p of s.parked) {
    const body = buildVehicleBody(p.kind, p.colour, p.reg ?? null);
    body.object.position.set(p.x, top - body.spec.offset - (body.spec.layout.spawnSag ?? 0), p.z);
    body.object.rotation.y = p.yaw;
    if (p.kind === 'tractor') poseBaleSpike(body.object, 0, false);
    mergeParkedVehicle(body.object);
    group.add(body.object);
    const collider = fixedBox(p.x, y0 + p.h / 2, p.z, p.hw, p.h / 2, p.hl, p.yaw);
    vehicles.push({ ...p, object: body.object, collider });
  }

  enableShadows(group);
  scene.add(group);
  const far = farNeighbourFarm(s, y0);
  group.userData.farVersion = far;
  far.visible = false; // FarDetail shows it, and hides the full yard, from a distance
  scene.add(far);
  return {
    group,
    far,
    vehicles,
    gate,
    /** Takes a kind of parked vehicle (her Tor, when she drives it to the farm) out of the yard, and its collider with it, or puts it back. */
    setAway(kind, away) {
      for (const v of vehicles) {
        if (v.kind !== kind) continue;
        v.object.visible = !away;
        v.collider.setEnabled(!away);
      }
    },
    /** 0..1 how dark it is: the windows and the porch lamp glow once it is (the house is lived in). */
    setNight(darkness, indoors = false) {
      const k = Math.max(0, Math.min(1, (darkness - 0.3) / 0.5));
      farmhouse.glow.emissiveIntensity = k * (indoors ? 1.4 : 0.9);
      farmhouse.lampGlow.emissiveIntensity = k * 1.6;
    },
  };
}
