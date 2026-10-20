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

/** A five-bar gate leaf `len` long and 1.2 m high, lying along z with its hinge end at z = 0. */
function gateLeaf(wood) {
  const g = new THREE.Group();
  const len = 3.6;
  const bar = (y, h = 0.09) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h, len), wood);
    m.position.set(0, y, len / 2);
    g.add(m);
  };
  for (const y of [0.2, 0.45, 0.7, 0.95]) bar(y);
  bar(1.2, 0.1);
  for (const z of [0.05, len - 0.05]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.1), wood);
    m.position.set(0, 0.65, z);
    g.add(m);
  }
  const diag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, Math.hypot(len, 1)), wood);
  diag.position.set(0, 0.7, len / 2);
  diag.rotation.x = -Math.atan2(1, len);
  g.add(diag);
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
  const { scene, layout, heights, fixedBox, random } = c;
  const nf = createNeighbourFarm(layout);
  if (!nf) return null;
  const s = nf.shape;
  const y0 = heights.heightAt((s.outline.minX + s.outline.maxX) / 2, (s.outline.minZ + s.outline.maxZ) / 2);
  const group = new THREE.Group();
  group.name = 'neighbourFarm';
  const sink = 0.4; // walls go this far into the ground, so no gap shows where it isn't quite level
  const stone = new THREE.MeshStandardMaterial({ map: stoneTexture(random), roughness: 0.95 });
  const slate = new THREE.MeshStandardMaterial({ map: slateTexture(random), roughness: 0.8, side: THREE.DoubleSide });
  const timber = mat(0x4a3c2c);
  const paint = mat(0xe9e6dc);
  const doorPaint = mat(0x2d4a3a);
  const glass = new THREE.MeshStandardMaterial({ color: 0x1b2428, roughness: 0.25, metalness: 0.2 });
  // Windows and the porch lamp glow once it is dark (setNight): the emissive is scaled with the darkness, never a light.
  const glow = new THREE.MeshStandardMaterial({ color: 0x2a2418, emissive: 0xffc46b, emissiveIntensity: 0, roughness: 0.4 });
  const lampGlow = new THREE.MeshStandardMaterial({ color: 0xddd6c0, emissive: 0xffd88a, emissiveIntensity: 0, roughness: 0.4 });
  const add = (geo, m, x, y, z, ry = 0) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.rotation.y = ry;
    group.add(o);
    return o;
  };
  const box = (w, h, d, m, x, y, z, tile = 2) => add(worldBox(w, h, d, tile), m, x, y, z);

  // The yard's concrete.
  const slab = s.slab;
  box(slab.maxX - slab.minX, 0.08, slab.maxZ - slab.minZ, new THREE.MeshStandardMaterial({ map: concreteTexture(random), roughness: 0.95 }), (slab.minX + slab.maxX) / 2, y0 + 0.02, (slab.minZ + slab.maxZ) / 2, 4);

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
  // The gate: two leaves swung back flat against the wall's inside face.
  for (const side of [-1, 1]) {
    const leaf = gateLeaf(timber);
    const hinge = side < 0 ? s.gateway.minZ - 0.1 : s.gateway.maxZ + 0.1;
    leaf.position.set(gx - s.yard.wall / 2 - 0.12, y0, hinge);
    if (side > 0) leaf.rotation.y = Math.PI; // runs the other way along the wall
    group.add(leaf);
  }
  // The postbox on the south gatepost, facing the lane.
  box(0.3, 0.42, 0.22, mat(0xb4141b), gx + 0.52, y0 + 1.25, s.gateway.maxZ + 0.3, 1);
  add(new THREE.BoxGeometry(0.2, 0.02, 0.04), mat(0x111111), gx + 0.64, y0 + 1.29, s.gateway.maxZ + 0.3);

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
  // Windows (both floors, front and back) and the door.
  const northZ = h.outer.minZ;
  const southZ = h.outer.maxZ;
  const window = (x, y, z, face, w, ht, lit) => {
    const sz = face * 0.04;
    box(w + 0.16, ht + 0.16, 0.05, paint, x, y, z + sz * 0.5, 1);
    box(w, ht, 0.06, lit ? glow : glass, x, y, z + sz * 0.9, 1);
    box(0.04, ht, 0.07, paint, x, y, z + sz * 1.1, 1);
    box(w, 0.04, 0.07, paint, x, y, z + sz * 1.1, 1);
    box(w + 0.3, 0.05, 0.14, cap, x, y - ht / 2 - 0.1, z + face * 0.07, 1); // the sill
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
  box(dw + 0.2, h.door.height + 0.1, 0.06, paint, h.door.x, y0 + h.door.height / 2, northZ - 0.025, 1);
  box(dw, h.door.height, 0.08, doorPaint, h.door.x, y0 + h.door.height / 2, northZ - 0.05, 1);
  add(new THREE.SphereGeometry(0.035, 8, 6), mat(0xb8a24a, { metalness: 0.7, roughness: 0.4 }), h.door.x + dw / 2 - 0.12, y0 + 1.0, northZ - 0.11);
  box(dw + 0.6, 0.18, 0.7, cap, h.door.x, y0 + 0.09, northZ - 0.35, 1); // the step
  // The porch: two posts and a slate roof, with the lamp under it.
  for (const dx of [-1.1, 1.1]) box(0.12, 2.5, 0.12, paint, h.door.x + dx, y0 + 1.25, northZ - 1.25, 1);
  const porch = box(3.0, 0.08, 1.9, slate, h.door.x, y0 + 2.7, northZ - 0.8, 1);
  porch.rotation.x = -0.12;
  box(0.14, 0.22, 0.14, lampGlow, h.door.x + 0.9, y0 + 2.25, northZ - 0.1, 1);

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
  // Inside: a concrete floor and a stack of square bales against the north wall.
  box(bw - 2 * t, 0.06, bd - 2 * t, mat(0x8a8982), b.x, y0 + 0.03, b.z, 1);
  const straw = new THREE.MeshStandardMaterial({ map: strawTexture(random), roughness: 1 });
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < 6 - layer; i++) {
      box(0.9, 0.45, 0.46, straw, b.outer.minX + 1.2 + i * 0.93 + layer * 0.3, y0 + 0.27 + layer * 0.45, b.outer.minZ + 0.5, 0.9);
      box(0.9, 0.45, 0.46, straw, b.outer.minX + 1.2 + i * 0.93 + layer * 0.3, y0 + 0.27 + layer * 0.45, b.outer.minZ + 0.99, 0.9);
    }
  }

  // Odds and ends about the yard: a water butt and a bin by the house, a log pile against the barn, a bench by the door.
  add(new THREE.CylinderGeometry(0.34, 0.3, 0.9, 14), mat(0x2f4f5c, { roughness: 0.6 }), h.outer.minX + 1.2, y0 + 0.45, northZ - 0.45);
  fixedBox(h.outer.minX + 1.2, y0 + 0.45, northZ - 0.45, 0.33, 0.45, 0.33);
  add(new THREE.BoxGeometry(0.55, 0.95, 0.65), mat(0x2f6b3a, { roughness: 0.7 }), h.outer.minX + 2.4, y0 + 0.475, northZ - 0.5);
  add(new THREE.BoxGeometry(0.6, 0.06, 0.7), mat(0x24562e), h.outer.minX + 2.4, y0 + 0.98, northZ - 0.5);
  fixedBox(h.outer.minX + 2.4, y0 + 0.5, northZ - 0.5, 0.3, 0.5, 0.35);
  box(1.4, 0.06, 0.4, timber, h.door.x + 2.4, y0 + 0.45, northZ - 0.4, 1);
  for (const dx of [-0.6, 0.6]) box(0.06, 0.45, 0.36, timber, h.door.x + 2.4 + dx, y0 + 0.22, northZ - 0.4, 1);
  for (let i = 0; i < 12; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 1.1, 8), mat(0x6b4f35));
    log.rotation.z = Math.PI / 2;
    log.position.set(b.outer.minX + 1.2 + (i % 6) * 0.23, y0 + 0.12 + Math.floor(i / 6) * 0.2, b.outer.maxZ + 0.2);
    group.add(log);
  }
  fixedBox(b.outer.minX + 1.9, y0 + 0.2, b.outer.maxZ + 0.2, 0.75, 0.2, 0.15);

  mergeStatic(group);

  // The parked vehicles: the farm's own models, scenery with a box each to ride into.
  const vehicles = [];
  for (const p of s.parked) {
    const body = buildVehicleBody(p.kind, p.colour, p.reg ?? null);
    body.object.position.set(p.x, y0 - body.spec.offset - (body.spec.layout.spawnSag ?? 0), p.z);
    body.object.rotation.y = p.yaw;
    group.add(body.object);
    fixedBox(p.x, y0 + p.h / 2, p.z, p.hw, p.h / 2, p.hl, p.yaw);
    vehicles.push({ ...p, object: body.object });
  }

  enableShadows(group);
  scene.add(group);
  return {
    group,
    vehicles,
    /** 0..1 how dark it is: the windows and the porch lamp glow once it is (the house is lived in). */
    setNight(darkness, indoors = false) {
      const k = Math.max(0, Math.min(1, (darkness - 0.3) / 0.5));
      glow.emissiveIntensity = k * (indoors ? 1.4 : 0.9);
      lampGlow.emissiveIntensity = k * 1.6;
    },
  };
}
