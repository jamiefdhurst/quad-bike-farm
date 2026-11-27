// The small farm on the lane's approach to Nether Thornby (#819): a stone farmhouse (villageHouses.js) and a stone barn round a walled yard, its gateway on a track
// from the lane. The yard is a concrete apron inside a drystone wall with coping, with a trough, barrels, pallets and milk churns. Built from the village kit in the
// village's `ctx` (villageProps.js); the farmhouse itself is `buildHouse`.

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { barrelTexture } from './neighbourTextures.js';
import { frameFor } from './villageBuildings.js';
import { shellAndRoof, windowAt } from './villageKit.js';

const mixed = (M, over) => ({ ...M, ...over });

/**
 * The stone barn, in its own frame (its front, with the cart door, faces the yard): rubble walls on a plinth with quoins at the corners, a pair of boarded cart doors in a
 * timber frame under a stone lintel, ventilation slits in rows, a pair of small windows, a slate roof with gutters and a lean-to cart shed on posts at the east end.
 */
export function buildBarn(ctx, b) {
  const { M } = ctx;
  const f = frameFor(ctx, b);
  const m = mixed(M, { wall: M.stone, roof: M.tin, ridgeCap: M.tin });
  shellAndRoof(f, b, m, { plinthMat: M.stone, plinth: 0.7, eave: 0.45 });
  f.solid(0, b.wallHeight / 2, 0, b.halfX, b.wallHeight / 2 + 0.6, b.halfZ);
  const front = b.halfZ;
  const back = -b.halfZ;
  // Quoins: the big dressed stones up each corner, in lighter courses standing a hair proud of the walls.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (let k = 0; k < 6; k++) {
        const wide = k % 2 ? 0.5 : 0.7;
        f.box(wide, 0.62, 0.62, M.render, sx * (b.halfX - wide / 2 + 0.02), 0.7 + k * 0.7, sz * (b.halfZ - 0.31 + 0.02), 1);
      }
    }
  }
  // The cart door: two leaves of boarded timber in a frame, a stone lintel and jambs, iron strap hinges and a ring handle.
  const dw = 3.4;
  const dh = 3.3;
  f.box(dw + 0.8, dh + 0.5, 0.2, M.stone, 0, (dh + 0.5) / 2, front + 0.02, 1);
  for (const sx of [-1, 1]) {
    f.box(dw / 2 - 0.04, dh, 0.08, M.weathered, sx * (dw / 4), dh / 2, front + 0.1, 0.5);
    f.box(0.12, dh, 0.12, M.timber, sx * (dw / 2 - 0.02), dh / 2, front + 0.13, 0.6);
    for (const y of [0.7, dh - 0.7]) f.box(dw / 2 - 0.2, 0.14, 0.03, M.iron, sx * (dw / 4), y, front + 0.16, 0.6);
    f.add(new THREE.TorusGeometry(0.1, 0.014, 6, 14), M.iron, sx * 0.3, 1.2, front + 0.14);
  }
  f.box(0.1, dh, 0.14, M.timber, 0, dh / 2, front + 0.14, 0.6); // the meeting stile
  f.box(dw + 1.1, 0.34, 0.3, M.stone, 0, dh + 0.55, front + 0.05, 1); // the lintel
  f.box(dw + 0.9, 0.12, 0.16, M.lead, 0, dh + 0.78, front + 0.05, 1); // its drip
  // Ventilation slits in two rows either side of the door and a pair of small windows.
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const x = sx * (3.2 + k * 2.4);
      for (const y of [1.8, 3.2]) f.box(0.16, 0.8, 0.08, M.paintDark, x, y, front + 0.03, 0.6);
    }
  }
  for (const x of [-7.6, 7.6]) windowAt(f, m, { x, y: 2.1, w: 0.9, h: 0.9, face: 1, wallZ: front, lintel: 'stone', lit: false });
  // The back wall's slits and a pitching hole each end of the roof's gable.
  for (let k = -5; k <= 5; k++) f.box(0.16, 0.8, 0.08, M.paintDark, k * 2.3, 2.6, back - 0.03, 0.6);
  for (const sx of [-1, 1]) f.box(0.7, 0.5, 0.08, M.paintDark, sx * (b.halfX - 0.2), b.wallHeight + 0.9, 0.0, 0.6).rotation.y = Math.PI / 2;
  // The lean-to cart shed on the east end: a roof sloping down from the end wall on three posts, open to the yard, with a cart wheel leant against the wall.
  const L = 4;
  const ex = b.halfX + L / 2 - 0.1;
  const roof = f.box(L + 0.5, 0.1, b.halfZ * 2 + 0.6, M.tin, ex + 0.1, b.wallHeight - 0.9, 0, 1);
  roof.rotation.z = -0.22;
  f.box(L + 0.4, 0.14, 0.12, M.timber, ex + 0.1, b.wallHeight - 1.2, b.halfZ + 0.25, 0.6).rotation.z = -0.22;
  for (const z of [-b.halfZ + 0.4, 0, b.halfZ - 0.4]) {
    f.box(0.2, 2.9, 0.2, M.timber, b.halfX + L - 0.2, 1.1, z, 0.6);
    f.box(0.5, 0.2, 0.5, M.stone, b.halfX + L - 0.2, -0.1, z, 1);
    f.solid(b.halfX + L - 0.2, 1.1, z, 0.1, 1.5, 0.1);
  }
  const wheel = f.add(new THREE.TorusGeometry(0.55, 0.05, 6, 20), M.iron, b.halfX + 0.25, 0.6, 1.0);
  wheel.rotation.y = Math.PI / 2;
  f.add(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 8), M.iron, b.halfX + 0.25, 0.6, 1.0).rotation.z = Math.PI / 2;
  return f;
}

/** A drystone wall piece `len` long along x, `d` thick, standing on the ground at (x, z) with `h` above it, with a rounded coping of through-stones, solid. */
function wallPiece(ctx, root, x, z, len, d, h, alongZ) {
  const { M, heights } = ctx;
  const gy = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, gy, z);
  if (alongZ) g.rotation.y = Math.PI / 2;
  const base = new THREE.Mesh(worldBox(len, h + 0.6, d, 0.8), M.stone);
  base.position.y = (h - 0.6) / 2;
  g.add(base);
  const cope = new THREE.Mesh(worldBox(len + 0.04, 0.16, d + 0.16, 0.5), M.stone);
  cope.position.y = h + 0.06;
  g.add(cope);
  root.add(g);
  ctx.groups.push(g);
  if (alongZ) ctx.fixedBox(x, gy + h / 2, z, (d + 0.16) / 2, h / 2 + 0.1, len / 2);
  else ctx.fixedBox(x, gy + h / 2, z, len / 2, h / 2 + 0.1, (d + 0.16) / 2);
}

/** A wall along a straight line from (x0, z0) to (x1, z1) in pieces no longer than 6 m, so it follows the ground. */
function wallRun(ctx, x0, z0, x1, z1, d, h) {
  const alongZ = Math.abs(z1 - z0) > Math.abs(x1 - x0);
  const len = Math.hypot(x1 - x0, z1 - z0);
  const n = Math.max(1, Math.ceil(len / 6));
  for (let k = 0; k < n; k++) {
    const t = (k + 0.5) / n;
    wallPiece(ctx, ctx.root, x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, len / n + 0.02, d, h, alongZ);
  }
}

/** A stone gatepier: a squared block with a capstone, 0.6 m square and `h` tall, standing on the ground. */
function pier(ctx, x, z, h) {
  const { M, heights } = ctx;
  const gy = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, gy, z);
  const block = new THREE.Mesh(worldBox(0.6, h + 0.6, 0.6, 0.6), M.stone);
  block.position.y = (h - 0.6) / 2;
  g.add(block);
  const cap = new THREE.Mesh(worldBox(0.76, 0.14, 0.76, 0.5), M.render);
  cap.position.y = h + 0.07;
  g.add(cap);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.render);
  ball.position.y = h + 0.14;
  g.add(ball);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, gy + h / 2, z, 0.3, h / 2 + 0.1, 0.3);
}

/**
 * The walled yard: a concrete apron on the levelled ground, the drystone wall round it with its gateway in the west wall between two piers and an open five-bar gate
 * tied back along the wall inside, a stone trough, barrels, a stack of pallets and milk churns by the farmhouse door.
 */
export function buildFarmYard(ctx, farm) {
  const { M, heights, random } = ctx;
  const y = farm.yard;
  const cx = (y.minX + y.maxX) / 2;
  const cz = (y.minZ + y.maxZ) / 2;
  const wall = farm.wall;
  const h = farm.wallHeight;
  const gz = farm.gateway.z;
  const half = farm.gateway.width / 2;
  // Its underside is in the ground and never seen, so it is left off (BoxGeometry's -y face, the fourth of six, six indices each), as the neighbour's hidden faces are.
  const geo = worldBox(y.maxX - y.minX - wall, 0.3, y.maxZ - y.minZ - wall, 2.4);
  const idx = geo.getIndex().array;
  geo.setIndex([...idx.slice(0, 18), ...idx.slice(24)]);
  geo.clearGroups(); // its six face groups would point past the shorter index
  const slab = new THREE.Mesh(geo, M.concrete);
  slab.position.set(cx, heights.heightAt(cx, cz) - 0.1, cz);
  slab.receiveShadow = true;
  const apron = new THREE.Group(); // in a group of its own, which the village merges (a lone mesh would be removed from the scene by the merge)
  apron.add(slab);
  ctx.root.add(apron);
  ctx.groups.push(apron);
  wallRun(ctx, y.minX, y.minZ, y.maxX, y.minZ, wall, h);
  wallRun(ctx, y.minX, y.maxZ, y.maxX, y.maxZ, wall, h);
  wallRun(ctx, y.maxX, y.minZ, y.maxX, y.maxZ, wall, h);
  wallRun(ctx, y.minX, y.minZ, y.minX, gz - half - 0.3, wall, h);
  wallRun(ctx, y.minX, gz + half + 0.3, y.minX, y.maxZ, wall, h);
  pier(ctx, y.minX, gz - half - 0.3, 1.9);
  pier(ctx, y.minX, gz + half + 0.3, 1.9);
  // The gate, open and tied back to the wall inside: five bars on two ends and a diagonal brace, the hanging stile at the north pier.
  {
    const gy = heights.heightAt(y.minX + 1.9, gz - half);
    const g = new THREE.Group();
    g.position.set(y.minX + 0.5, gy, gz - half + 0.1);
    g.rotation.y = Math.PI / 2 - 0.12;
    const L = 3.6;
    const bar = (w, hh, d, px, py, pz = 0) => {
      const o = new THREE.Mesh(worldBox(w, hh, d, 0.6), M.timber);
      o.position.set(px, py, pz);
      g.add(o);
      return o;
    };
    for (const py of [0.25, 0.5, 0.75, 1.0, 1.25]) bar(L, 0.08, 0.04, L / 2, py);
    for (const px of [0.05, L - 0.05]) bar(0.1, 1.4, 0.05, px, 0.65);
    bar(0.08, 0.08, 0.05, 0, 0.5).scale.set(1, 1, 1);
    const brace = bar(Math.hypot(L, 1) - 0.2, 0.08, 0.04, L / 2, 0.75);
    brace.rotation.z = Math.atan2(1, L);
    for (const py of [0.3, 1.2]) bar(0.34, 0.06, 0.07, 0.1, py);
    ctx.root.add(g);
    ctx.groups.push(g);
  }
  // A stone trough against the north wall with water in it, and its overflow pipe.
  {
    const tx = y.minX + 9;
    const tz = y.minZ + 0.9;
    const gy = heights.heightAt(tx, tz);
    const g = new THREE.Group();
    g.position.set(tx, gy, tz);
    const shell = new THREE.Mesh(worldBox(2.2, 0.6, 0.7, 0.8), M.stone);
    shell.position.y = 0.3 - 0.05;
    g.add(shell);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshStandardMaterial({ color: 0x4d6a6c, roughness: 0.1, metalness: 0.2 }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = 0.56;
    g.add(water);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.3, 6), M.lead);
    pipe.position.set(-0.8, 1.0, -0.3);
    g.add(pipe);
    ctx.root.add(g);
    ctx.groups.push(g);
    ctx.fixedBox(tx, gy + 0.3, tz, 1.1, 0.35, 0.35);
  }
  // Barrels, a stack of pallets and milk churns.
  const barrel = new THREE.MeshStandardMaterial({ map: barrelTexture(), roughness: 0.8 });
  const prop = (build, x, z, hh, hx, hz) => {
    const gy = heights.heightAt(x, z);
    const g = new THREE.Group();
    g.position.set(x, gy, z);
    build(g);
    ctx.root.add(g);
    ctx.groups.push(g);
    ctx.fixedBox(x, gy + hh / 2, z, hx, hh / 2, hz);
  };
  for (let k = 0; k < 3; k++) {
    prop((g) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.85, 14), barrel);
      b.position.y = 0.42;
      g.add(b);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.04, 14), M.weathered);
      lid.position.y = 0.86;
      g.add(lid);
    }, y.maxX - 3 - k * 0.75, y.minZ + 1.2 + (k % 2) * 0.3, 0.9, 0.3, 0.3);
  }
  prop((g) => {
    for (let k = 0; k < 4; k++) {
      for (const dz of [-0.45, 0, 0.45]) {
        const slat = new THREE.Mesh(worldBox(1.2, 0.03, 0.1, 0.6), M.weathered);
        slat.position.set(0, k * 0.14 + 0.1, dz);
        g.add(slat);
      }
      for (const dx of [-0.5, 0, 0.5]) {
        const blk = new THREE.Mesh(worldBox(0.1, 0.1, 1.0, 0.6), M.weathered);
        blk.position.set(dx, k * 0.14 + 0.03, 0);
        g.add(blk);
      }
    }
  }, y.maxX - 3, y.maxZ - 2.5, 0.7, 0.62, 0.55);
  const house = farm.house;
  for (const k of [0, 1]) {
    prop((g) => {
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.5, 12), M.lead);
      c.position.y = 0.25;
      g.add(c);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.17, 0.2, 12), M.lead);
      neck.position.y = 0.58;
      g.add(neck);
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.05, 12), M.lead);
      lid.position.y = 0.7;
      g.add(lid);
    }, house.x + 2.2 + k * 0.5, house.z + house.halfZ + 0.5, 0.75, 0.2, 0.2);
  }
  void random;
}

/** The farm's own pieces: the walled yard and the barn (the farmhouse is `buildHouse`, called with the village's). */
export function buildFarm(ctx) {
  const farm = ctx.S.v.approach?.farm;
  if (!farm) return;
  buildFarmYard(ctx, farm);
  buildBarn(ctx, ctx.S.laneBuildings.find((b) => b.kind === 'barn'));
}
