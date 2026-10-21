// The neighbour's farm drawn (world/neighbourFarm.js has its shapes): a drystone wall round a concrete yard with a gateway onto the lane (stone
// gateposts, a five-bar gate swung back, a postbox), the stone farmhouse with a slate roof, porch, chimney and windows that glow after dark,
// the barn (block walls, green sheeting, a rusty roof, a stack of bales inside), a water butt, a bin, a log pile and a bench, and three of the
// farm's own vehicle models parked about. All procedural, with colliders for the walls, the buildings and the vehicles.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createNeighbourFarm } from './neighbourFarm.js';
import { canvasTexture, corrugatedTexture, stoneTexture, blockTexture, worldBox } from './outbuildingProps.js';
import { buildVehicleBody } from './trafficView.js';
import { enableShadows } from './assets.js';
import { Gate } from './gates.js';
import { poseBaleSpike } from '../vehicle/tractorModel.js';
import { woodTexture, paintedTexture, doorTexture, sashTexture, binTexture, barrelTexture, barkTexture, logEndTexture, postboxTexture } from './neighbourTextures.js';

/** Slate: courses of dark grey tiles, one tile 1 m square, a few paler or greener. */
function slateTexture(random) {
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
function concreteTexture(random) {
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
function gateLeaf(wood, iron, len) {
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
    strap.position.set(0, y, 0.3);
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

/** Builds the neighbour's farm and its colliders. `c` is the props context (props.js). Returns null on a farm without one. */
export function buildNeighbourFarm(c) {
  const { scene, layout, heights, fixedBox, random, gateParams } = c;
  const nf = createNeighbourFarm(layout);
  if (!nf) return null;
  const s = nf.shape;
  const y0 = heights.heightAt((s.outline.minX + s.outline.maxX) / 2, (s.outline.minZ + s.outline.maxZ) / 2);
  const group = new THREE.Group();
  group.name = 'neighbourFarm';
  const sink = 0.4; // walls go this far into the ground, so no gap shows where it isn't quite level
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const slate = new THREE.MeshStandardMaterial({ map: slateTexture(random), roughness: 0.8, side: THREE.DoubleSide });
  const timber = new THREE.MeshStandardMaterial({ map: woodTexture(random), roughness: 0.9 });
  const weathered = new THREE.MeshStandardMaterial({ map: woodTexture(random, [128, 120, 108]), roughness: 0.95 });
  const paint = new THREE.MeshStandardMaterial({ map: paintedTexture(random), roughness: 0.55 });
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTexture(random), roughness: 0.5 });
  const iron = mat(0x24282a, { metalness: 0.6, roughness: 0.5 });
  const brass = mat(0xb8a24a, { metalness: 0.7, roughness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ map: sashTexture(false), roughness: 0.2, metalness: 0.2 });
  // Windows and the porch lamp glow once it is dark (setNight): the emissive is scaled with the darkness, never a light.
  const litMap = sashTexture(true);
  const glow = new THREE.MeshStandardMaterial({ map: glass.map, emissive: 0xffffff, emissiveMap: litMap, emissiveIntensity: 0, roughness: 0.4 });
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xddd6c0, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.4 });
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
  box(slab.maxX - slab.minX, 0.08, slab.maxZ - slab.minZ, new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 }), (slab.minX + slab.maxX) / 2, top - 0.04, (slab.minZ + slab.maxZ) / 2, 4);

  // The wall: drystone with a capping course, and a stone pillar either side of the gateway.
  const cap = mat(0x77736a);
  const H = s.yard.wallHeight + sink;
  for (const w of s.walls) {
    box(w.hx * 2, H, w.hz * 2, stone, w.x, y0 - sink + H / 2, w.z);
    box(w.hx * 2 + 0.12, 0.1, w.hz * 2 + 0.12, cap, w.x, y0 + s.yard.wallHeight + 0.05, w.z, 1);
    fixedBox(w.x, y0 + s.yard.wallHeight / 2, w.z, w.hx, s.yard.wallHeight / 2 + 0.5, w.hz);
  }
  const gx = s.gateway.x;
  for (const z of [s.gateway.minZ - 0.3, s.gateway.maxZ + 0.3]) {
    box(0.8, 2 + sink, 0.8, stone, gx, y0 - sink + (2 + sink) / 2, z);
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
      for (const { pivot, side } of leaves) pivot.rotation.y = side * a * (Math.PI / 2 - 0.08);
    },
    solid: fixedBox(gx, gateY, s.gateway.z, 0.1, 0.9, gap / 2),
  });

  // The postbox: a cast-iron box set into the south gatepost's lane face, with a hood over its slot, a plate of times and a collar.
  const pz = s.gateway.maxZ + 0.3;
  const faceX = gx + 0.4;
  const postbox = new THREE.MeshStandardMaterial({ map: postboxTexture(random), roughness: 0.45, metalness: 0.2 });
  const ironRed = mat(0x9c1218, { roughness: 0.45, metalness: 0.2 });
  box(0.04, 0.5, 0.4, ironRed, faceX + 0.01, y0 + 1.1, pz, 1); // the frame
  add(worldBox(0.03, 0.42, 0.3, 0.3, 0.42), postbox, faceX + 0.04, y0 + 1.1, pz); // the face: one texture tile, reading from the lane
  add(new THREE.BoxGeometry(0.1, 0.05, 0.36), ironRed, faceX + 0.07, y0 + 1.28, pz); // the hood over the slot
  add(new THREE.BoxGeometry(0.06, 0.02, 0.32), iron, faceX + 0.05, y0 + 1.31, pz); // the hood's lip

  // The farmhouse: stone walls, a slate roof, a chimney at the east end, the door in the north wall under a porch, windows on both floors.
  const h = s.house;
  const hw = h.outer.maxX - h.outer.minX;
  const hd = h.outer.maxZ - h.outer.minZ;
  const hH = h.wallHeight + sink;
  box(hw, hH, hd, stone, h.x, y0 - sink + hH / 2, h.z);
  fixedBox(h.x, y0 + h.wallHeight / 2, h.z, h.halfX, h.wallHeight / 2 + 0.5, h.halfZ);
  const gable = new THREE.Shape();
  gable.moveTo(-hd / 2, 0);
  gable.lineTo(hd / 2, 0);
  gable.lineTo(0, h.ridge - h.wallHeight);
  gable.closePath();
  for (const side of [-1, 1]) {
    const geo = new THREE.ExtrudeGeometry(gable, { depth: 0.4, bevelEnabled: false });
    const uv = geo.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / 2, uv.getY(i) / 2);
    geo.translate(0, 0, -0.2);
    geo.rotateY(Math.PI / 2);
    add(geo, stone, side > 0 ? h.outer.maxX - 0.2 : h.outer.minX + 0.2, y0 + h.wallHeight, h.z);
  }
  const over = h.roof.maxZ - h.z;
  const drop = (h.ridge - h.wallHeight) * (over / h.halfZ);
  const slope = Math.hypot(over, drop);
  const pitch = Math.atan2(drop, over);
  for (const side of [-1, 1]) {
    const m = box(h.roof.maxX - h.roof.minX, 0.08, slope, slate, h.x, y0 + h.ridge + 0.04 - drop / 2, h.z + (side * over) / 2, 1);
    m.rotation.x = side * pitch;
  }
  box(h.roof.maxX - h.roof.minX, 0.1, 0.3, mat(0x2c3034), h.x, y0 + h.ridge + 0.1, h.z, 1);
  box(0.9, h.ridge - h.wallHeight + 1.6, 0.9, stone, h.outer.maxX - 1.1, y0 + h.wallHeight + (h.ridge - h.wallHeight + 1.6) / 2 - 0.2, h.z);
  box(1.05, 0.12, 1.05, cap, h.outer.maxX - 1.1, y0 + h.ridge + 1.45, h.z, 1);
  for (const dx of [-0.3, 0.3]) add(new THREE.CylinderGeometry(0.1, 0.12, 0.28, 8), mat(0x8a4a30), h.outer.maxX - 1.1 + dx, y0 + h.ridge + 1.65, h.z); // chimney pots
  // Windows (both floors, front and back) and the door: a painted frame, the sashes, a stone cill and a stone lintel over each.
  const northZ = h.outer.minZ;
  const southZ = h.outer.maxZ;
  const window = (x, y, z, face, w, ht, lit) => {
    const sz = face * 0.04;
    box(w + 0.2, ht + 0.2, 0.05, paint, x, y, z + sz * 0.5, 0.6); // the frame
    add(worldBox(w, ht, 0.06, w, ht), lit ? glow : glass, x, y, z + sz * 0.9);
    box(w + 0.36, 0.1, 0.16, cap, x, y - ht / 2 - 0.12, z + face * 0.08, 1); // the cill
    box(w + 0.4, 0.16, 0.14, cap, x, y + ht / 2 + 0.14, z + face * 0.07, 1); // the lintel
  };
  for (const dx of [-3.7, 3.7]) {
    window(h.x + dx, y0 + 1.5, northZ, -1, 1.0, 1.2, true);
    window(h.x + dx, y0 + 3.8, northZ, -1, 1.0, 1.1, true);
    window(h.x + dx, y0 + 1.5, southZ, 1, 1.0, 1.2, true);
    window(h.x + dx, y0 + 3.8, southZ, 1, 1.0, 1.1, true);
  }
  window(h.x, y0 + 3.8, northZ, -1, 1.0, 1.1, true);
  window(h.x, y0 + 3.8, southZ, 1, 1.0, 1.1, true);
  const dw = h.door.halfWidth * 2;
  box(dw + 0.24, h.door.height + 0.12, 0.08, paint, h.door.x, y0 + h.door.height / 2 + 0.04, northZ - 0.03, 0.6); // the frame
  add(worldBox(dw, h.door.height, 0.08, dw, h.door.height), doorMat, h.door.x, y0 + h.door.height / 2, northZ - 0.06);
  add(new THREE.SphereGeometry(0.035, 8, 6), brass, h.door.x + dw / 2 - 0.12, y0 + 1.0, northZ - 0.12); // the knob
  box(dw + 0.5, 0.18, 0.1, cap, h.door.x, y0 + h.door.height + 0.17, northZ - 0.08, 1); // the lintel over the door
  box(dw + 0.6, 0.18, 0.7, cap, h.door.x, y0 + 0.09, northZ - 0.35, 1); // the step
  // The porch: two timber posts on stone bases, a beam across their tops and a side beam back to the wall each, with a slate lean-to roof laid
  // on them and meeting the wall (the roof's underside is the beams' top, so nothing floats), and the lamp under it.
  const pd = 1.7; // how far it stands out from the wall
  const pw = 1.2; // each post's distance from the door's middle
  const pBeam = 2.4; // the beams' top
  for (const dx of [-pw, pw]) {
    box(0.3, 0.2, 0.3, cap, h.door.x + dx, y0 + 0.1, northZ - pd + 0.15, 1); // the base
    box(0.14, pBeam - 0.2, 0.14, timber, h.door.x + dx, y0 + 0.2 + (pBeam - 0.2) / 2, northZ - pd + 0.15, 0.6);
    box(0.1, 0.2, pd - 0.15, timber, h.door.x + dx, y0 + pBeam - 0.1, northZ - (pd - 0.15) / 2, 0.6); // the side beam, post to wall
  }
  box(pw * 2 + 0.3, 0.2, 0.12, timber, h.door.x, y0 + pBeam - 0.1, northZ - pd + 0.15, 0.6); // the beam across the front
  const wallTop = pBeam + 0.65; // where the roof meets the wall
  const run = pd + 0.1;
  const rise = wallTop - pBeam;
  const porchRoof = box(pw * 2 + 0.7, 0.07, Math.hypot(run, rise), slate, h.door.x, y0 + (pBeam + wallTop) / 2 + 0.035, northZ - run / 2 + 0.1, 1);
  porchRoof.rotation.x = -Math.atan2(rise, run);
  box(pw * 2 + 0.7, 0.06, 0.1, timber, h.door.x, y0 + pBeam + 0.02, northZ - run + 0.1, 0.6); // the bargeboard along the roof's front edge
  box(0.14, 0.22, 0.14, lampGlow, h.door.x + 0.7, y0 + 2.1, northZ - 0.1, 1);

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

  // Odds and ends about the yard: a water butt and two wheelie bins by the house, a log pile against the barn, a bench by the door.
  const ribs = binTexture(random);
  const butt = new THREE.MeshStandardMaterial({ map: barrelTexture(), color: 0x2f5a6c, roughness: 0.55 });
  const bx = h.outer.minX + 1.2;
  add(new THREE.CylinderGeometry(0.36, 0.3, 0.95, 16), butt, bx, y0 + 0.475, northZ - 0.45);
  add(new THREE.CylinderGeometry(0.38, 0.38, 0.05, 16), mat(0x1c3440), bx, y0 + 0.97, northZ - 0.45); // the lid
  add(new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), brass, bx + 0.32, y0 + 0.18, northZ - 0.45).rotation.z = Math.PI / 2; // the tap
  fixedBox(bx, y0 + 0.475, northZ - 0.45, 0.35, 0.5, 0.35);
  const bin = (x, colour, lidColour) => {
    const body = add(new THREE.CylinderGeometry(0.36, 0.3, 0.95, 4, 1), new THREE.MeshStandardMaterial({ map: ribs, color: colour, roughness: 0.6 }), x, y0 + 0.5, northZ - 0.5, Math.PI / 4);
    body.scale.set(1, 1, 1.15);
    box(0.68, 0.07, 0.8, mat(lidColour, { roughness: 0.55 }), x, y0 + 1.0, northZ - 0.5, 1); // the lid
    box(0.5, 0.05, 0.05, iron, x, y0 + 0.93, northZ - 0.05, 1); // the handle bar
    for (const dx of [-0.26, 0.26]) add(new THREE.CylinderGeometry(0.08, 0.08, 0.05, 10), iron, x + dx, y0 + 0.08, northZ - 0.1).rotation.z = Math.PI / 2; // the wheels
    fixedBox(x, y0 + 0.5, northZ - 0.5, 0.34, 0.52, 0.4);
  };
  bin(h.outer.minX + 2.4, 0x2f6b3a, 0x24562e);
  bin(h.outer.minX + 3.2, 0x2a2d30, 0x1d1f21);
  // The bench by the door: three seat slats, two back slats, and cast iron ends.
  const benchX = h.door.x + 2.6;
  for (const dz of [-0.14, 0, 0.14]) box(1.5, 0.04, 0.12, weathered, benchX, y0 + 0.47, northZ - 0.45 + dz, 0.6);
  for (const dy of [0.72, 0.86]) box(1.5, 0.1, 0.03, weathered, benchX, y0 + dy, northZ - 0.26, 0.6);
  for (const dx of [-0.66, 0.66]) {
    box(0.06, 0.48, 0.5, iron, benchX + dx, y0 + 0.24, northZ - 0.45, 1); // the end
    box(0.06, 0.5, 0.05, iron, benchX + dx, y0 + 0.72, northZ - 0.26, 1); // the back upright
  }
  fixedBox(benchX, y0 + 0.45, northZ - 0.4, 0.78, 0.45, 0.3);
  // Logs against the barn's south wall, two rows with the odd one leaning: bark on the side, sawn rings on each end.
  const bark = new THREE.MeshStandardMaterial({ map: barkTexture(random), roughness: 1 });
  const rings = new THREE.MeshStandardMaterial({ map: logEndTexture(random), roughness: 0.9 });
  const logs = [];
  for (let i = 0; i < 15; i++) {
    const row = i < 8 ? 0 : i < 13 ? 1 : 2;
    const col = row === 0 ? i : row === 1 ? i - 8 + 0.5 : i - 13 + 1.2;
    logs.push({ r: 0.1 + random() * 0.035, len: 0.95 + random() * 0.3, x: b.outer.minX + 1 + col * 0.25, y: 0.11 + row * 0.19, yaw: (random() - 0.5) * 0.18 });
  }
  const logZ = b.outer.maxZ + 0.3;
  for (const l of logs) {
    const side = add(new THREE.CylinderGeometry(l.r, l.r, l.len, 10, 1, true), bark, l.x, y0 + l.y, logZ);
    side.rotation.order = 'YXZ'; // lie along z, then turn a little off square
    side.rotation.set(Math.PI / 2, l.yaw, 0);
    for (const e of [-1, 1]) {
      const end = add(new THREE.CircleGeometry(l.r, 10), rings, l.x + Math.sin(l.yaw) * e * l.len * 0.5, y0 + l.y, logZ + Math.cos(l.yaw) * e * l.len * 0.5);
      end.rotation.y = e > 0 ? l.yaw : l.yaw + Math.PI;
    }
  }
  fixedBox(b.outer.minX + 2.9, y0 + 0.3, logZ, 1.9, 0.3, 0.55);

  mergeStatic(group);

  // The parked vehicles: the farm's own models, scenery with a box each to ride into. They stand on the concrete (1.5 cm above the ground)
  // and the tractor has no bale spike on its back (it isn't a hay farm's, and the spike is for the player's).
  const vehicles = [];
  for (const p of s.parked) {
    const body = buildVehicleBody(p.kind, p.colour, p.reg ?? null);
    body.object.position.set(p.x, top - body.spec.offset - (body.spec.layout.spawnSag ?? 0), p.z);
    body.object.rotation.y = p.yaw;
    if (p.kind === 'tractor') poseBaleSpike(body.object, 0, false);
    group.add(body.object);
    fixedBox(p.x, y0 + p.h / 2, p.z, p.hw, p.h / 2, p.hl, p.yaw);
    vehicles.push({ ...p, object: body.object });
  }

  enableShadows(group);
  scene.add(group);
  return {
    group,
    vehicles,
    gate,
    /** 0..1 how dark it is: the windows and the porch lamp glow once it is (the house is lived in). */
    setNight(darkness, indoors = false) {
      const k = Math.max(0, Math.min(1, (darkness - 0.3) / 0.5));
      glow.emissiveIntensity = k * (indoors ? 1.4 : 0.9);
      lampGlow.emissiveIntensity = k * 1.6;
    },
  };
}
