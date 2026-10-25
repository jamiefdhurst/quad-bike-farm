// The village's buildings (world/villageProps.js): the cottages, the pub with its hanging sign and beer garden, the shop you can walk into, and the
// garage with its pumps. Each is built in its own frame with the kit (villageKit.js); `ctx` carries the materials, the ground, the colliders and the
// things the game needs back (the pump and counter proxies, and what glows at night).

import * as THREE from 'three';
import { worldBox } from './outbuildingProps.js';
import { barrelTexture } from './neighbourTextures.js';
import { buildVehicleBody } from './trafficView.js';
import { PARKED_SIZES } from './neighbourFarm.js';
import { poseBaleSpike } from '../vehicle/tractorModel.js';
import { Frame, shellAndRoof, chimney, windowAt, bayWindow, doorAt, porch, dormer, flowerBox } from './villageKit.js';
import { fasciaTexture, pubSignTexture, shopInteriorTexture, awningTexture, chalkBoardTexture, rollerDoorTexture, pumpFaceTexture, partPacketTexture, pumpSideTexture, pumpHeaderTexture, bollardTexture, priceBoardTexture, carParkTexture, noticeTexture } from './villageTextures.js';

void poseBaleSpike;

/** A frame for building `b`: a group at its position turned to the road, standing on the (levelled) ground. */
export function frameFor(ctx, b) {
  const group = new THREE.Group();
  group.name = `village-${b.id}`;
  const y0 = ctx.heights.heightAt(b.x, b.z);
  group.position.set(b.x, y0, b.z);
  group.rotation.y = b.yaw;
  ctx.root.add(group);
  ctx.groups.push(group);
  return new Frame({ group, x: b.x, z: b.z, yaw: b.yaw, y0, fixedBox: ctx.fixedBox });
}

/** A frame for a wall at the end of a building (sx = +1 east, -1 west): local +z points out from the wall, local x runs along it. */
export function sideFrame(f, b, sx) {
  const group = new THREE.Group();
  group.position.set(sx * b.halfX, 0, 0);
  group.rotation.y = (sx * Math.PI) / 2;
  f.group.add(group);
  return new Frame({ group, x: f.x, z: f.z, yaw: f.yaw, y0: f.y0, fixedBox: f.fixedBox });
}

/** A lit sign material: the painted texture, glowing a little at night. */
export function signMaterial(ctx, tex, strength = 0.35) {
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
  ctx.night.push({ mat, strength });
  return mat;
}

/** A painted board `w` by `h` on the wall facing `face` at (x, y), on a dark backing. */
export function signBoard(ctx, f, tex, w, h, x, y, z, face = 1, strength = 0.35) {
  const { M } = ctx;
  f.box(w + 0.14, h + 0.14, 0.08, M.paintDark, x, y, z + face * 0.02, 0.6);
  const plane = f.add(new THREE.PlaneGeometry(w, h), signMaterial(ctx, tex, strength), x, y, z + face * 0.065);
  if (face < 0) plane.rotation.y = Math.PI;
  return plane;
}

const mixed = (M, over) => ({ ...M, ...over });

// Cottages --------------------------------------------------------------------------------------------------------------------------------

export function buildCottage(ctx, b, index) {
  const { M } = ctx;
  const f = frameFor(ctx, b);
  const wall = b.wall === 'brick' ? M.brick : b.wall === 'stone' ? M.stone : M.renders[b.paint];
  const roof = b.wall === 'stone' ? M.slate : M.clay;
  const m = mixed(M, { wall, roof, ridgeCap: roof });
  const info = shellAndRoof(f, b, m, { plinthMat: b.wall === 'brick' ? M.brickDark : M.stone });
  f.solid(0, b.wallHeight / 2, 0, b.halfX, b.wallHeight / 2 + 0.6, b.halfZ);
  const stackMat = b.wall === 'render' ? M.brick : wall;
  chimney(f, b, mixed(m, { brick: stackMat }), -b.halfX + 0.9, { pots: 2 });
  chimney(f, b, mixed(m, { brick: stackMat }), b.halfX - 0.9, { pots: 1 + (index % 2) });
  const lintel = b.wall === 'brick' ? 'brick' : 'stone';
  const front = b.halfZ;
  const back = -b.halfZ;
  const win = (x, y, z, face, h = 1.2, opts = {}) => windowAt(f, m, { x, y, h, w: 0.95, face, wallZ: z, lintel, ...opts });
  const shut = index % 2 === 0 ? M.paintDark : null;
  for (const x of [-2.4, 2.4]) {
    win(x, 1.55, front, 1, 1.2, { shutters: shut, flowers: index % 3 === 0 });
    win(x, 3.45, front, 1, 1.05, { shutters: shut });
    win(x, 1.55, back, -1);
    win(x, 3.45, back, -1, 1.05);
  }
  win(0, 3.45, front, 1, 1.05, { shutters: shut });
  win(0, 3.45, back, -1, 1.05);
  doorAt(f, m, { x: 0, wallZ: front, face: 1, colour: b.door, number: 3 + index * 2 });
  if (index % 2 === 0) porch(f, m, { x: 0, wallZ: front, face: 1, roofMat: roof });
  // The side walls: a window each, and an outside tap and a water butt on the one.
  for (const sx of [-1, 1]) {
    const sf = sideFrame(f, b, sx);
    windowAt(sf, m, { x: 0, y: 1.6, w: 0.9, h: 1.1, wallZ: 0, face: 1, lintel });
    windowAt(sf, m, { x: 0, y: 3.45, w: 0.9, h: 1.0, wallZ: 0, face: 1, lintel });
  }
  // Tubs of flowers by the door, a boot scraper and a bike leant on the wall.
  for (const sx of [-1, 1]) {
    f.add(new THREE.CylinderGeometry(0.2, 0.15, 0.32, 10), M.pot, sx * 1.05, 0.16, front + 0.55);
    for (let k = 0; k < 4; k++) f.add(new THREE.IcosahedronGeometry(0.1, 0), M.blooms[(k + index) % 4], sx * 1.05 + (k - 1.5) * 0.07, 0.4 + (k % 2) * 0.05, front + 0.55 + ((k % 3) - 1) * 0.06);
  }
  if (index % 2) bicycle(ctx, f, 1.7, front + 0.18);
  // A hedge down each side and across the back, for a garden.
  for (const sx of [-1, 1]) {
    f.box(0.8, 1.5, 7, M.hedge, sx * (b.halfX + 0.9), 0.75, back - 2.5, 1);
    f.solid(sx * (b.halfX + 0.9), 0.75, back - 2.5, 0.4, 0.75, 3.5);
  }
  f.box(b.halfX * 2 + 2.6, 1.5, 0.8, M.hedge, 0, 0.75, back - 6, 1);
  f.solid(0, 0.75, back - 6, b.halfX + 1.3, 0.75, 0.4);
  // A shed and a washing line out the back.
  const shed = f.box(2.2, 2.0, 1.7, M.weathered, b.halfX - 1.4, 1.0, back - 3.6, 1);
  shed.rotation.y = 0;
  const roofShed = f.box(2.5, 0.07, 2.0, M.lead, b.halfX - 1.4, 2.05, back - 3.6, 1);
  roofShed.rotation.x = 0.07;
  f.solid(b.halfX - 1.4, 1, back - 3.6, 1.1, 1, 0.85);
  return f;
}

/** A bicycle leant on a wall: two wheels, a frame, bars and a saddle. Local frame f, at (x, z) facing along x. */
function bicycle(ctx, f, x, z) {
  const { M } = ctx;
  for (const dx of [-0.45, 0.45]) {
    const w = f.add(new THREE.TorusGeometry(0.33, 0.02, 6, 20), M.iron, x + dx, 0.35, z);
    w.rotation.x = 0;
    f.add(new THREE.CylinderGeometry(0.01, 0.01, 0.66, 4), M.lead, x + dx, 0.35, z);
  }
  const tube = (a, b2) => {
    const len = Math.hypot(b2[0] - a[0], b2[1] - a[1]);
    const t = f.add(new THREE.CylinderGeometry(0.014, 0.014, len, 6), M.red, x + (a[0] + b2[0]) / 2, (a[1] + b2[1]) / 2, z);
    t.rotation.z = Math.atan2(b2[0] - a[0], b2[1] - a[1]) * -1;
  };
  tube([-0.45, 0.35], [-0.1, 0.75]);
  tube([-0.1, 0.75], [0.35, 0.72]);
  tube([0.35, 0.72], [0.45, 0.35]);
  tube([-0.45, 0.35], [0, 0.4]);
  tube([0, 0.4], [-0.1, 0.75]);
  f.box(0.2, 0.04, 0.09, M.iron, -0.12 + x, 0.8, z, 0.5);
  f.box(0.04, 0.04, 0.5, M.iron, x + 0.37, 0.8, z, 0.5);
}

// The pub -------------------------------------------------------------------------------------------------------------------------------

/** A picnic table with attached benches at the world position, its long side along x, the legs on the ground. */
function picnicTable(ctx, x, z, parasol = null) {
  const { M } = ctx;
  const y = ctx.heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const box = (w, h, d, px, py, pz, rot = 0) => {
    const o = new THREE.Mesh(worldBox(w, h, d, 0.6), M.timber);
    o.position.set(px, py, pz);
    o.rotation.z = rot;
    g.add(o);
    return o;
  };
  for (const dz of [-0.1, 0.1]) box(1.9, 0.045, 0.14, 0, 0.76, dz * 2.2 + 0); // table top planks
  box(1.9, 0.045, 0.14, 0, 0.76, 0);
  box(1.9, 0.045, 0.14, 0, 0.76, -0.2);
  box(1.9, 0.045, 0.14, 0, 0.76, 0.2);
  for (const dz of [-0.62, 0.62]) {
    box(1.9, 0.04, 0.26, 0, 0.46, dz); // bench seats
    for (const sx of [-0.7, 0.7]) {
      const leg = box(0.06, 0.8, 0.06, sx, 0.4, dz * 0.55);
      leg.rotation.x = dz > 0 ? 0.25 : -0.25;
    }
  }
  for (const sx of [-0.7, 0.7]) box(0.05, 0.05, 1.5, sx, 0.26, 0); // cross bearers
  if (parasol) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 2.2, 6), M.iron);
    pole.position.set(0, 1.1, 0);
    g.add(pole);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25, 0.4, 8, 1, true), parasol);
    cone.position.set(0, 2.2, 0);
    g.add(cone);
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 0.45, z, 1.0, 0.45, 0.8);
  return g;
}

/** A hanging inn sign: a wrought-iron arm with a scroll, from the wall at local (x, y, wallZ), the board swinging on two chains. */
function hangingSign(ctx, f, tex, x, y, wallZ) {
  const { M } = ctx;
  const arm = 1.45;
  f.box(0.1, 0.5, 0.1, M.iron, x, y - 0.1, wallZ + 0.05, 0.6); // the wall plate
  f.box(0.06, 0.06, arm + 0.05, M.iron, x, y, wallZ + arm / 2, 0.6); // the arm
  // A scroll under the arm: a quarter circle from the wall to the arm.
  const sc = f.add(new THREE.TorusGeometry(0.4, 0.022, 6, 14, Math.PI / 2), M.iron, x, y - 0.4, wallZ + 0.4);
  sc.rotation.y = Math.PI / 2;
  sc.rotation.z = 0;
  f.add(new THREE.SphereGeometry(0.05, 8, 6), M.iron, x, y + 0.04, wallZ + arm); // the finial
  // The board hangs flat to the street (its faces look along the wall), on two short chains.
  const bw = 0.95;
  const bh = 1.25;
  const cy = y - 0.18 - bh / 2;
  const z = wallZ + arm * 0.62;
  for (const dz of [-0.35, 0.35]) f.add(new THREE.CylinderGeometry(0.008, 0.008, 0.2, 4), M.iron, x, y - 0.1, z + dz);
  f.box(0.06, bh + 0.1, bw + 0.1, M.timber, x, cy, z, 0.6);
  const mat = signMaterial(ctx, tex, 0.25);
  for (const s of [-1, 1]) {
    const p = f.add(new THREE.PlaneGeometry(bw, bh), mat, x + s * 0.032, cy, z);
    p.rotation.y = (s * Math.PI) / 2;
  }
  f.add(new THREE.BoxGeometry(0.08, 0.05, bw + 0.14), M.brass, x, cy + bh / 2 + 0.07, z);
}

export function buildPub(ctx, b) {
  const { M, S, random } = ctx;
  const f = frameFor(ctx, b);
  const m = mixed(M, { wall: M.renders['#ece5d0'], roof: M.slate, ridgeCap: M.slate });
  const info = shellAndRoof(f, b, m, { plinthMat: M.brick, plinth: 0.85 });
  f.solid(0, b.wallHeight / 2, 0, b.halfX, b.wallHeight / 2 + 0.6, b.halfZ);
  const front = b.halfZ;
  const back = -b.halfZ;
  // Chimneys on the gables and one on the ridge, with a clutch of pots.
  for (const x of [-b.halfX + 0.9, b.halfX - 0.9]) chimney(f, b, m, x, { pots: 4, rise: 1.5, w: 1.15, d: 0.85, mat: M.brick });
  chimney(f, b, m, -2.2, { pots: 3, rise: 1.2, w: 1.0, d: 0.75, mat: M.brick });
  // The front: bays and the door on the ground floor, the board over them, windows above and two dormers in the roof.
  for (const x of [-4.6, 4.6]) bayWindow(f, m, { x, w: 2.6, depth: 0.55, h: 1.5, base: 0.7, wallZ: front });
  doorAt(f, m, { x: 0, w: 1.2, h: 2.2, wallZ: front, face: 1, colour: '#7a1f2b', lamp: false });
  // A canopy over the door on two posts, with lanterns either side of it.
  for (const sx of [-1, 1]) {
    f.box(0.12, 2.5, 0.12, M.timber, sx * 1.05, 1.25, front + 1.25, 0.6);
    f.box(0.3, 0.2, 0.3, M.stone, sx * 1.05, 0.1, front + 1.25, 1);
    f.add(new THREE.CylinderGeometry(0.1, 0.12, 0.34, 6), M.lampGlow, sx * 2.0, 2.45, front + 0.12);
    f.add(new THREE.ConeGeometry(0.15, 0.14, 6), M.iron, sx * 2.0, 2.69, front + 0.12);
  }
  const canopy = f.box(2.9, 0.07, 1.6, M.slate, 0, 2.68, front + 0.75, 1);
  canopy.rotation.x = 0.16;
  f.box(2.9, 0.16, 0.08, M.paintDark, 0, 2.5, front + 1.5, 0.6);
  // The name board over the ground floor, lit after dark.
  signBoard(ctx, f, fasciaTexture(random, { text: b.name.toUpperCase(), sub: 'FREE HOUSE · ALES · GOOD FOOD', bg: '#1b2f22', fg: '#e8d9a0', font: 'bold 82px Georgia, serif', width: 1536, height: 192 }), 11.8, 0.82, 0, 3.18, front, 1, 0.45);
  for (const x of [-6.4, -3.2, 0, 3.2, 6.4]) windowAt(f, m, { x, y: 4.35, w: 1.0, h: 1.3, wallZ: front, face: 1, shutters: M.paintDark, flowers: x === 0 || x === 6.4 });
  const roofInfo = info;
  for (const x of [-5, 5]) dormer(f, m, { x, b, roofInfo, roofMat: M.slate });
  // Hanging baskets either side of the door.
  for (const sx of [-1, 1]) {
    f.add(new THREE.SphereGeometry(0.2, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M.iron, sx * 1.55, 2.2, front + 0.4);
    for (let k = 0; k < 6; k++) f.add(new THREE.IcosahedronGeometry(0.09, 0), M.blooms[k % 4], sx * 1.55 + Math.cos(k) * 0.14, 2.3 + (k % 2) * 0.04, front + 0.4 + Math.sin(k) * 0.14);
    f.box(0.03, 0.03, 0.4, M.iron, sx * 1.55, 2.55, front + 0.2, 0.6);
  }
  hangingSign(ctx, f, pubSignTexture(random, b.name), -7.5, 4.0, front);
  // The back: windows, a kitchen extension with a flue, and a yard door.
  for (const x of [-6, -2.5, 2.5, 6]) {
    windowAt(f, m, { x, y: 1.7, w: 1.0, h: 1.2, wallZ: back, face: -1 });
    windowAt(f, m, { x, y: 4.2, w: 1.0, h: 1.3, wallZ: back, face: -1 });
  }
  f.box(7, 3.2, 3, M.renders['#ece5d0'], 0, 1.6 - 0.2, back - 1.5, 1.2);
  f.box(7.4, 0.2, 3.4, M.lead, 0, 3.25, back - 1.5, 1);
  f.add(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 10), M.lead, 1.8, 4.1, back - 1.5);
  f.add(new THREE.CylinderGeometry(0.21, 0.16, 0.12, 10), M.lead, 1.8, 5.0, back - 1.5);
  f.solid(0, 1.5, back - 1.5, 3.5, 1.6, 1.5);
  // The west end (the car park side): a side door under a light and windows; the east end: windows and a climbing rose on a trellis.
  const west = sideFrame(f, b, -1);
  doorAt(west, m, { x: 0.6, w: 1.0, h: 2.1, wallZ: 0, face: 1, colour: '#7a1f2b', lamp: true });
  west.add(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 6), M.lampGlow, -1.2, 2.5, 0.12);
  for (const x of [-3.2, 3.2]) {
    windowAt(west, m, { x, y: 1.7, w: 1.0, h: 1.2, wallZ: 0, face: 1 });
    windowAt(west, m, { x: x, y: 4.2, w: 1.0, h: 1.3, wallZ: 0, face: 1 });
  }
  windowAt(west, m, { x: 0.6, y: 4.2, w: 1.0, h: 1.3, wallZ: 0, face: 1 });
  const notice = noticeTexture(random, 'WHAT\'S ON', 8);
  west.add(new THREE.PlaneGeometry(0.6, 0.8), new THREE.MeshStandardMaterial({ map: notice, roughness: 0.6 }), -2.0, 1.5, 0.05);
  const east = sideFrame(f, b, 1);
  for (const x of [-2.6, 2.6]) {
    windowAt(east, m, { x, y: 1.7, w: 1.0, h: 1.2, wallZ: 0, face: 1, flowers: true });
    windowAt(east, m, { x, y: 4.2, w: 1.0, h: 1.3, wallZ: 0, face: 1 });
  }
  windowAt(east, m, { x: 0, y: 4.2, w: 1.0, h: 1.3, wallZ: 0, face: 1 });
  east.box(1.2, 2.2, 0.05, M.weathered, 0, 1.1, 0.06, 0.6);
  for (let k = 0; k < 14; k++) east.add(new THREE.IcosahedronGeometry(0.1, 0), k % 4 === 0 ? M.blooms[0] : M.leaf, ((k * 37) % 11) / 10 - 0.55, 0.4 + ((k * 53) % 17) / 8, 0.12);
  // Barrels and an A-board at the door.
  const barrel = new THREE.MeshStandardMaterial({ map: barrelTexture(), roughness: 0.8 });
  for (const sx of [-1, 1]) {
    f.add(new THREE.CylinderGeometry(0.34, 0.3, 0.8, 14), barrel, sx * 2.3, 0.4, front + 0.85);
    f.add(new THREE.CylinderGeometry(0.33, 0.33, 0.04, 14), M.weathered, sx * 2.3, 0.82, front + 0.85);
    f.solid(sx * 2.3, 0.4, front + 0.85, 0.34, 0.42, 0.34);
  }
  const aBoard = new THREE.MeshStandardMaterial({ map: chalkBoardTexture(random, ['TODAY', 'Sunday Roast', 'Real Ales', 'Quiz Thurs']), roughness: 0.7 });
  for (const s of [-1, 1]) {
    const leg = f.box(0.55, 0.9, 0.04, M.weathered, 3.2 + s * 0.0, 0.5, front + 1.0 + s * 0.2, 0.6);
    leg.rotation.x = s * -0.22;
    if (s > 0) f.add(new THREE.PlaneGeometry(0.48, 0.72), aBoard, 3.2, 0.5, front + 1.0 + 0.2 + 0.03).rotation.x = -0.22;
  }
  f.solid(3.2, 0.5, front + 1.1, 0.3, 0.5, 0.3);
  // The beer garden's picnic tables and the car park.
  const parasol = new THREE.MeshStandardMaterial({ color: 0xb02a2a, roughness: 0.8, side: THREE.DoubleSide });
  for (const t of ctx.S.v.pub.benches) picnicTable(ctx, t.x, t.z, t.x > 130 ? parasol : null);
  void S;
  return f;
}

/** The pub's car park: tarmac with bays, a kerb round it, a crossing into the road and a few cars parked in the bays. */
export function buildCarPark(ctx) {
  const { M, S, random, heights } = ctx;
  const c = S.carPark;
  const w = c.maxX - c.minX;
  const d = c.maxZ - c.minZ;
  const cx = (c.minX + c.maxX) / 2;
  const cz = (c.minZ + c.maxZ) / 2;
  const y = heights.heightAt(cx, cz);
  const tex = carParkTexture(random, w, d);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(cx, y + 0.06, cz);
  plane.receiveShadow = true;
  ctx.root.add(plane);
  // The kerb round the north and west edges, and the low stone wall and the hedge beyond.
  const kerb = (px, pz, kw, kd) => {
    const o = new THREE.Mesh(worldBox(kw, 0.14, kd, 0.6), M.kerb);
    o.position.set(px, y + 0.07, pz);
    ctx.root.add(o);
  };
  kerb(cx, c.minZ - 0.1, w + 0.4, 0.2);
  kerb(c.minX - 0.1, cz, 0.2, d);
  const hedge = new THREE.Mesh(worldBox(w + 1, 1.4, 0.8, 1), M.hedge);
  hedge.position.set(cx, y + 0.7, c.minZ - 0.9);
  ctx.root.add(hedge);
  ctx.fixedBox(cx, y + 0.7, c.minZ - 0.9, w / 2 + 0.5, 0.7, 0.4);
  // The apron to the road: a strip of tarmac from the car park's south edge across the pavement.
  // The way in from the road: a strip of tarmac on the ground from the car park's south edge to the pavement.
  const apronMat = new THREE.MeshStandardMaterial({ map: ctx.tarmac, roughness: 0.92, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const apronX0 = 110;
  const apronX1 = 116;
  const apronZ0 = c.maxZ - 0.2;
  const apronZ1 = S.roadAt(113, c.maxZ + 6).at.z - S.curb - 0.2; // up to the pavement's outer edge
  const rows = Math.max(2, Math.ceil(apronZ1 - apronZ0));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let r = 0; r <= rows; r++) {
    for (let k = 0; k <= 3; k++) {
      const px = apronX0 + ((apronX1 - apronX0) * k) / 3;
      const pz = apronZ0 + ((apronZ1 - apronZ0) * r) / rows;
      pos.push(px, heights.heightAt(px, pz) + 0.06, pz);
      uv.push(k / 3, r / 2);
      if (r > 0 && k > 0) {
        const i1 = r * 4 + k;
        const i0 = (r - 1) * 4 + k;
        idx.push(i0 - 1, i1 - 1, i0, i0, i1 - 1, i1);
      }
    }
  }
  const apronGeo = new THREE.BufferGeometry();
  apronGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  apronGeo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  apronGeo.setIndex(idx);
  apronGeo.computeVertexNormals();
  const apron = new THREE.Mesh(apronGeo, apronMat);
  apron.receiveShadow = true;
  apron.frustumCulled = false;
  ctx.root.add(apron);
  // Cars in the bays, nose to the hedge. The farm's own models, like the neighbour's yard.
  const bw = (w - 2) / 6;
  const parked = [
    { bay: 1, kind: 'series', colour: 0x3d5a80, reg: 'M227 BDK' },
    { bay: 3, kind: 'utv', colour: 0x8a3b2e },
    { bay: 4, kind: 'series', colour: 0xc9c3b0, reg: 'E158 NFA' },
  ];
  const cars = [];
  for (const p of parked) {
    const body = buildVehicleBody(p.kind, p.colour, p.reg ?? null);
    const px = c.minX + 1 + (p.bay + 0.5) * bw;
    const pz = c.minZ + 2.6;
    const gy = y + 0.06;
    body.object.position.set(px, gy - body.spec.offset - (body.spec.layout.spawnSag ?? 0), pz);
    body.object.rotation.y = Math.PI;
    ctx.root.add(body.object);
    const size = PARKED_SIZES[p.kind];
    ctx.fixedBox(px, gy + size.h / 2, pz, size.hw, size.h / 2, size.hl);
    cars.push({ ...p, x: px, z: pz, object: body.object });
  }
  return cars;
}

// The shop ----------------------------------------------------------------------------------------------------------------------------

export function buildShop(ctx, b) {
  const { M, random } = ctx;
  const f = frameFor(ctx, b);
  const m = mixed(M, { wall: M.brick, roof: M.slate, ridgeCap: M.slate });
  const info = shellAndRoof(f, b, m, { plinthMat: M.stone, solidWalls: false });
  void info;
  const { halfX, halfZ, wallHeight: wH } = b;
  const t = 0.3; // the walls' thickness
  const inner = { x: halfX - t, z: halfZ - t };
  const wallBox = (w, h, d, px, py, pz) => {
    f.box(w, h, d, M.brick, px, py, pz, 1.2);
    f.solid(px, py, pz, w / 2, h / 2, d / 2);
  };
  // Back and side walls whole; the front in pieces round the bay window and the door.
  wallBox(halfX * 2, wH + 0.4, t, 0, (wH - 0.4) / 2, -halfZ + t / 2);
  for (const sx of [-1, 1]) wallBox(t, wH + 0.4, halfZ * 2, sx * (halfX - t / 2), (wH - 0.4) / 2, 0);
  const bayX = -2.4;
  const bayHalf = 2.1;
  const doorX = b.door.x - b.x;
  const doorHalf = 0.55;
  const frontZ = halfZ - t / 2;
  const seg = (x0, x1, y0, y1) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01) return;
    wallBox(x1 - x0, y1 - y0, t, (x0 + x1) / 2, (y0 + y1) / 2, frontZ);
  };
  seg(-halfX, bayX - bayHalf, -0.4, wH);
  seg(bayX - bayHalf, bayX + bayHalf, -0.4, 0.65); // under the window
  seg(bayX - bayHalf, bayX + bayHalf, 2.55, wH); // over it
  seg(bayX + bayHalf, doorX - doorHalf, -0.4, wH);
  seg(doorX - doorHalf, doorX + doorHalf, 2.2, wH); // over the door
  seg(doorX + doorHalf, halfX, -0.4, wH);
  // The floor, the ceiling and the first floor above.
  f.box(halfX * 2 - t * 2, 0.1, halfZ * 2 - t * 2, M.paving, 0, 0.0, 0, 1.2);
  f.box(halfX * 2 - t * 2, 0.12, halfZ * 2 - t * 2, M.timber, 0, 2.95, 0, 0.8);
  // The window is glass you cannot walk through, and the bow sticks out in front of it.
  f.solid(bayX, 1.6, halfZ - t / 2 + 0.25, bayHalf + 0.1, 1.0, 0.3);
  // The shopfront: a bow window on the front wall with its glass open to the shop, the fascia over it, the door standing open.
  bayWindow(f, mixed(M, { glow: M.clear, glass: M.clear }), { x: bayX, w: 4.4, depth: 0.5, h: 1.8, base: 0.65, wallZ: halfZ, roofMat: M.lead, lit: false });
  signBoard(ctx, f, fasciaTexture(random, { text: b.name.toUpperCase(), sub: b.sub, bg: '#2a4a36', fg: '#f0e6b8', font: 'bold 84px Georgia, serif', width: 1536, height: 192 }), 10.4, 0.8, 0, 3.4, halfZ, 1, 0.4);
  for (const sx of [-1, 1]) f.box(0.1, 2.25, t + 0.06, M.paint, doorX + sx * (doorHalf + 0.05), 1.12, halfZ - t / 2, 0.6); // the door frame, jambs and head
  f.box(doorHalf * 2 + 0.2, 0.1, t + 0.06, M.paint, doorX, 2.2, halfZ - t / 2, 0.6);
  const leaf = f.box(0.05, 2.1, 0.95, M.doors['#2d4a3a'], doorX + 0.55, 1.05, halfZ + 0.4, 0.6); // the door, stood open against the wall
  leaf.rotation.y = 0;
  f.box(1.3, 0.1, 0.1, M.stone, doorX, 2.25, halfZ, 1); // lintel
  f.box(1.5, 0.16, 0.6, M.stone, doorX, 0.08, halfZ + 0.3, 1); // the step
  // First floor windows (the flat above), a dormer each side, chimneys.
  for (const x of [-3.6, 0, 3.6]) windowAt(f, m, { x, y: 4.5, w: 0.95, h: 1.05, wallZ: halfZ, face: 1, shutters: M.paintDark, lintel: 'brick' });
  for (const x of [-3, 3]) windowAt(f, m, { x, y: 4.5, w: 0.95, h: 1.05, wallZ: -halfZ, face: -1, lintel: 'brick' });
  for (const x of [-halfX + 0.9, halfX - 0.9]) chimney(f, b, mixed(m, { brick: M.brick }), x, { pots: 2, rise: 1.2 });
  for (const sx of [-1, 1]) {
    const sf = sideFrame(f, b, sx);
    windowAt(sf, m, { x: 0, y: 1.6, w: 1.0, h: 1.2, wallZ: 0, face: 1, lintel: 'brick' });
    windowAt(sf, m, { x: 0, y: 4.5, w: 1.0, h: 1.05, wallZ: 0, face: 1, lintel: 'brick' });
  }
  // A striped awning over the bow window and out to the door.
  const awnMat = new THREE.MeshStandardMaterial({ map: awningTexture(), roughness: 0.9, side: THREE.DoubleSide, transparent: true, alphaTest: 0.1 });
  const awn = f.add(new THREE.PlaneGeometry(8.4, 1.1), awnMat, -0.9, 2.6, halfZ + 0.62);
  awn.rotation.x = -Math.PI / 2 + 0.38;
  for (const x of [-5.1, 3.3]) f.box(0.04, 0.04, 1.2, M.iron, x, 2.65, halfZ + 0.6, 0.6).rotation.x = 0.38;
  // Inside: a counter along the right, shelves on the back and left walls, a freezer, a paper rack, lights. The sweets jar and the pasty warmer
  // on the counter are what you buy from (proxies, ctx.shopProxies).
  const stock = shopInteriorTexture(random, true);
  const shelfMat = new THREE.MeshStandardMaterial({ map: stock, roughness: 0.8 });
  const zBack = -halfZ + t;
  for (let i = 0; i < 3; i++) {
    const sx = -halfX + t + 1.9 + i * 3.4;
    f.box(3.1, 2.2, 0.35, M.timber, sx, 1.1, zBack + 0.18, 0.8);
    f.add(new THREE.PlaneGeometry(3.0, 2.0), shelfMat, sx, 1.1, zBack + 0.37);
    f.solid(sx, 1.1, zBack + 0.18, 1.55, 1.1, 0.18);
  }
  f.box(0.35, 2.2, 5.5, M.timber, -halfX + t + 0.18, 1.1, -0.3, 0.8);
  f.add(new THREE.PlaneGeometry(5.3, 2.0), shelfMat, -halfX + t + 0.37, 1.1, -0.3).rotation.y = Math.PI / 2;
  f.solid(-halfX + t + 0.18, 1.1, -0.3, 0.18, 1.1, 2.75);
  // The counter, the till, the scales, the post office hatch.
  const cx = 2.3;
  const cz = -1.0;
  f.box(3.6, 1.0, 0.7, M.timber, cx, 0.5, cz, 0.8);
  f.box(3.8, 0.05, 0.85, M.weathered, cx, 1.02, cz, 0.8);
  f.solid(cx, 0.5, cz, 1.9, 0.55, 0.42);
  f.box(0.5, 0.25, 0.4, M.iron, cx + 1.3, 1.17, cz, 0.6); // the till
  f.add(new THREE.BoxGeometry(0.4, 0.06, 0.3), M.lead, cx + 0.5, 1.07, cz);
  f.add(new THREE.CylinderGeometry(0.12, 0.14, 0.04, 10), M.iron, cx + 0.5, 1.11, cz); // the scales' pan
  const hatch = new THREE.MeshStandardMaterial({ map: fasciaTexture(random, { text: 'POST OFFICE', bg: '#b4141b', fg: '#f6efe0', accent: '#f6efe0', font: 'bold 70px Arial, Helvetica, sans-serif', width: 768, height: 128 }), roughness: 0.6, emissive: 0xffffff, emissiveIntensity: 0 });
  ctx.night.push({ mat: hatch, strength: 0.3 });
  hatch.emissiveMap = hatch.map;
  f.add(new THREE.PlaneGeometry(1.4, 0.23), hatch, cx - 1.2, 2.2, cz - 0.3);
  // The jar of sweets (a glass jar full of colours) and the pasty warmer (a lit glass cabinet), on the counter.
  const jar = new THREE.Group();
  jar.position.set(cx - 1.4, 1.05, cz);
  f.group.add(jar);
  jar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.36, 14), M.clear));
  for (let k = 0; k < 26; k++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.035, 0), M.blooms[k % 4]);
    s.position.set(Math.cos(k * 2.1) * 0.09 * ((k % 3) + 1) / 2, -0.15 + (k % 7) * 0.045, Math.sin(k * 2.1) * 0.09 * ((k % 3) + 1) / 2);
    jar.add(s);
  }
  { const o = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 14), M.red); o.position.set(0, 0.2, 0); jar.add(o); }
  const warmer = new THREE.Group();
  warmer.position.set(cx + 0.3, 1.05, cz);
  f.group.add(warmer);
  { const o = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.4), M.iron); o.position.set(0, 0.02, 0); warmer.add(o); }
  { const o = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.36, 0.36), M.clear); o.position.set(0, 0.22, 0); warmer.add(o); }
  for (let k = 0; k < 4; k++) {
    const pasty = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.13, 3, 8), new THREE.MeshStandardMaterial({ color: 0xc88a45, roughness: 0.8 }));
    pasty.rotation.z = Math.PI / 2;
    pasty.position.set(-0.24 + k * 0.16, 0.1, ((k % 2) - 0.5) * 0.14);
    warmer.add(pasty);
  }
  { const o = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.04, 0.12), M.signGlow); o.position.set(0, 0.42, 0); warmer.add(o); }
  ctx.shopProxies.push(proxyAt(ctx, f, 'sweets', cx - 1.4, 1.25, cz, 0.5, 0.55, 0.5), proxyAt(ctx, f, 'pasty', cx + 0.3, 1.25, cz, 0.85, 0.5, 0.55));
  // A freezer chest, a paper rack and a stack of baskets, and ceiling lights that glow after dark.
  f.box(1.4, 0.9, 0.7, M.paint, -halfX + t + 1.0, 0.45, 1.8, 0.6);
  f.box(1.3, 0.04, 0.6, M.clear, -halfX + t + 1.0, 0.92, 1.8, 0.6);
  f.solid(-halfX + t + 1.0, 0.45, 1.8, 0.7, 0.45, 0.35);
  for (const x of [-3, 0, 3]) f.box(1.2, 0.05, 0.3, M.signGlow, x, 2.85, 0, 0.6);
  // Outside: a pillar box on the pavement, crates of vegetables, a newspaper stand, a bench, the blade sign and an ice cream board.
  const post = pillarBox(ctx, f, halfX + 1.2, halfZ + 1.4);
  void post;
  const crate = (px, pz, colour) => {
    f.box(0.7, 0.28, 0.5, M.weathered, px, 0.14, pz, 0.6);
    f.box(0.62, 0.12, 0.44, new THREE.MeshStandardMaterial({ color: colour, roughness: 0.9 }), px, 0.33, pz, 0.6);
    f.solid(px, 0.2, pz, 0.35, 0.2, 0.25);
  };
  crate(-4.6, halfZ + 0.9, 0xb02a2a);
  crate(-3.8, halfZ + 0.9, 0x6aa04a);
  crate(-3.0, halfZ + 1.0, 0xd89a2a);
  f.box(0.8, 0.9, 0.35, M.weathered, 0.4, 0.45, halfZ + 0.35, 0.6);
  // The "Post Office" blade sign, hung from the corner on an arm, double sided.
  const blade = f.add(new THREE.PlaneGeometry(0.7, 0.9), signMaterial(ctx, fasciaTexture(random, { text: 'POST', sub: 'OFFICE', bg: '#b4141b', fg: '#f6efe0', accent: '#f6efe0', width: 384, height: 480, font: 'bold 120px Arial, Helvetica, sans-serif' }), 0.3), halfX + 0.55, 3.6, halfZ - 0.45);
  blade.rotation.y = Math.PI / 2;
  f.box(0.05, 0.05, 0.9, M.iron, halfX + 0.3, 4.1, halfZ - 0.3, 0.6);
  return f;
}

/** An invisible box on a building's frame to look at and press E on: returns { id, mesh, world } with the mesh in the frame. */
function proxyAt(ctx, f, id, x, y, z, w, h, d) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ visible: false }));
  mesh.position.set(x, y, z);
  f.group.add(mesh);
  mesh.userData.proxyId = id;
  return { id, mesh };
}

/** A pillar box: a red cast cylinder with a domed cap, a slot and a plate, on the pavement beside the shop. */
function pillarBox(ctx, f, x, z) {
  const { M } = ctx;
  f.add(new THREE.CylinderGeometry(0.3, 0.32, 0.12, 16), M.iron, x, 0.06, z);
  f.add(new THREE.CylinderGeometry(0.27, 0.27, 1.05, 16), M.red, x, 0.65, z);
  f.add(new THREE.SphereGeometry(0.27, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.red, x, 1.18, z);
  f.add(new THREE.CylinderGeometry(0.075, 0.075, 0.07, 10), M.red, x, 1.46, z);
  f.add(new THREE.BoxGeometry(0.3, 0.04, 0.04), M.iron, x, 0.95, z + 0.275); // the slot
  f.add(new THREE.BoxGeometry(0.16, 0.12, 0.02), M.paint, x, 0.55, z + 0.27); // the plate
  f.solid(x, 0.75, z, 0.3, 0.75, 0.3);
}

// The garage ----------------------------------------------------------------------------------------------------------------------------

/** A round bollard: a painted post with a domed top, `r` thick and `h` tall, standing at (x, z). */
function bollard(f, mat, x, z, h, r) {
  f.add(new THREE.CylinderGeometry(r, r * 1.08, h, 14), mat, x, h / 2, z);
  f.add(new THREE.SphereGeometry(r, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat, x, h, z);
}

export function buildGarage(ctx, b) {
  const { M, S, random } = ctx;
  const f = frameFor(ctx, b);
  const m = mixed(M, { wall: M.brick, roof: M.tin, ridgeCap: M.tin });
  shellAndRoof(f, b, m, { plinthMat: M.concrete, plinth: 0.4, eave: 0.3, verge: 0.2 });
  f.solid(0, b.wallHeight / 2, 0, b.halfX, b.wallHeight / 2 + 0.6, b.halfZ);
  const front = b.halfZ;
  // Two workshop bays, each a roller door in a steel frame with its shutter box over it, and an ordinary steel door at the end for staff.
  const doorW = 3.6;
  const doorH = 2.6;
  const bollardMat = new THREE.MeshStandardMaterial({ map: bollardTexture(random), roughness: 0.6 });
  const bay = (dx) => {
    f.box(doorW + 0.5, doorH + 0.4, 0.14, M.iron, dx, doorH / 2 + 0.2, front + 0.02, 0.6);
    f.add(worldBox(doorW, doorH, 0.06, doorW, doorH), new THREE.MeshStandardMaterial({ map: rollerDoorTexture(random), roughness: 0.6, metalness: 0.3 }), dx, doorH / 2 + 0.02, front + 0.08);
    f.box(doorW + 0.5, 0.35, 0.3, M.iron, dx, doorH + 0.5, front + 0.12, 0.6); // the shutter box
    for (const sx of [-1, 1]) bollard(f, bollardMat, dx + sx * (doorW / 2 + 0.55), front + 0.9, 0.9, 0.07);
  };
  bay(-4.4);
  bay(3.0);
  doorAt(f, m, { x: 6.5, w: 0.95, h: 2.1, wallZ: front, face: 1, doorMat: new THREE.MeshStandardMaterial({ color: 0x35506a, roughness: 0.5, metalness: 0.3 }), fanlight: false, lamp: false });
  // The sign over the lot, clear of the shutter box and under the eaves, its board the shape of its texture (a stretched one reads badly).
  signBoard(ctx, f, fasciaTexture(random, { text: b.name.toUpperCase(), sub: 'MOT · SERVICING · REPAIRS · TYRES', bg: '#1b2a44', fg: '#f2f2ee', accent: '#e8c23a', font: 'bold 96px Arial, Helvetica, sans-serif', width: 2048, height: 192 }), 9.4, 0.88, -0.5, 3.85, front, 1, 0.5);
  // Side window, a flue and a lean-to for the tyres.
  const east = sideFrame(f, b, 1);
  windowAt(east, mixed(m, { stone: M.concrete }), { x: 0, y: 2.3, w: 0.95, h: 1.2, wallZ: 0, face: 1 }); // the sash texture's shape, or it stretches
  f.add(new THREE.CylinderGeometry(0.14, 0.14, 1.4, 10), M.lead, -b.halfX + 1.2, b.ridge + 0.4, 0);
  // A stack of tyres (tori), oil drums and a rack by the workshop door, an air line on a post.
  const tyreMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  for (let i = 0; i < 6; i++) {
    const t = f.add(new THREE.TorusGeometry(0.28, 0.12, 8, 16), tyreMat, -7.9 + (i % 2 ? 0.03 : 0), 0.14 + Math.floor(i / 1) * 0.0, front + 0.45);
    t.position.y = 0.15 + i * 0.24;
    t.rotation.x = Math.PI / 2;
  }
  f.solid(-7.9, 0.9, front + 0.45, 0.4, 0.9, 0.4);
  const lid = new THREE.MeshStandardMaterial({ color: 0x25282b, roughness: 0.5, metalness: 0.5 });
  const drums = [0x2f5f9a, 0x2f5f9a, 0x8a2a22].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.35 }));
  for (let i = 0; i < 3; i++) {
    const dxp = 0.5 + i * 0.62 + (i === 2 ? 0.1 : 0);
    const dzp = front + 0.55;
    // Body with its top and bottom as plain steel, three raised rolling hoops, and a bung and a cap in the lid.
    f.add(new THREE.CylinderGeometry(0.28, 0.28, 0.85, 20, 1, true), drums[i], dxp, 0.43, dzp);
    f.add(new THREE.CircleGeometry(0.28, 20), lid, dxp, 0.85, dzp).rotation.x = -Math.PI / 2;
    for (const hy of [0.12, 0.43, 0.74]) f.add(new THREE.TorusGeometry(0.285, 0.018, 6, 20), drums[i], dxp, hy, dzp).rotation.x = Math.PI / 2;
    f.add(new THREE.TorusGeometry(0.27, 0.012, 6, 20), lid, dxp, 0.855, dzp).rotation.x = Math.PI / 2;
    f.add(new THREE.CylinderGeometry(0.04, 0.04, 0.025, 10), M.iron, dxp + 0.1, 0.862, dzp + 0.08);
    f.add(new THREE.CylinderGeometry(0.025, 0.025, 0.02, 8), M.brass, dxp - 0.12, 0.86, dzp - 0.06);
    f.solid(dxp, 0.43, dzp, 0.29, 0.43, 0.29);
  }
  // The parts rack between the roller door and the office: a weathered board with three shelves of packets (plugs, tubes, belts) you buy from,
  // and the stack of tyres by the door is the tyre you buy.
  const rx = -0.6;
  f.box(1.9, 1.5, 0.08, M.weathered, rx, 1.2, front + 0.06, 0.6);
  signBoard(ctx, f, fasciaTexture(random, { text: 'PARTS FOR SALE', bg: '#a8271f', fg: '#f6f3ea', accent: '#f6f3ea', font: 'bold 84px Arial, Helvetica, sans-serif', width: 1024, height: 216 }), 1.9, 0.4, rx, 2.28, front + 0.02, 1, 0.3);
  const packets = [
    { id: 'plug', label: 'SPARK PLUG', kind: 'plug', x: rx - 0.68, colour: '#c99a14', w: 0.2, h: 0.15 },
    { id: 'tube', label: 'INNER TUBE', kind: 'tube', x: rx - 0.08, colour: '#2a5a96', w: 0.3, h: 0.225 },
    { id: 'belt', label: 'DRIVE BELT', kind: 'belt', x: rx + 0.62, colour: '#a8271f', w: 0.28, h: 0.21 },
  ].map((pk) => ({ ...pk, mat: new THREE.MeshStandardMaterial({ color: pk.colour, roughness: 0.7 }), label: new THREE.MeshStandardMaterial({ map: partPacketTexture(pk.label, pk.colour, pk.kind), roughness: 0.7 }) }));
  for (const y of [0.8, 1.2, 1.6]) {
    f.box(1.8, 0.04, 0.22, M.iron, rx, y - 0.1, front + 0.2, 0.6);
    for (const pk of packets) {
      for (let k = 0; k < 2; k++) {
        const px = pk.x + (k - 0.5) * (pk.w + 0.04);
        const py = y - 0.07 + pk.h / 2; // standing on the shelf's top (y - 0.08), not level with it
        f.box(pk.w, pk.h, 0.1, pk.mat, px, py, front + 0.2, 0.6);
        f.add(new THREE.PlaneGeometry(pk.w - 0.01, pk.h - 0.01), pk.label, px, py, front + 0.2 + 0.052); // the printed front, clear of the box's face
      }
    }
  }
  for (const pk of packets) ctx.partProxies.push(proxyAt(ctx, f, pk.id, pk.x, 1.2, front + 0.3, 0.6, 1.2, 0.5));
  ctx.partProxies.push(proxyAt(ctx, f, 'tyreQuad', -7.9, 0.75, front + 0.45, 0.9, 1.5, 0.9));
  // The forecourt's pumps: three, on an island under the canopy.
  const pumps = b.pumps;
  const island = [S.v.garage.pumps.xs[0] - 1.2, S.v.garage.pumps.xs[2] + 1.2];
  const iy = ctx.heights.heightAt((island[0] + island[1]) / 2, pumps.z);
  const world = new Frame({ group: ctx.rootGroup('garage-forecourt', iy), x: 0, z: 0, yaw: 0, y0: iy, fixedBox: ctx.fixedBox });
  forecourt(ctx, world, S, b, random);
  return f;
}

/** The forecourt in world terms (a frame at the world origin, y0 the island's ground): concrete, the island, canopy, pumps and the price board. */
function forecourt(ctx, w, S, b, random) {
  const { M } = ctx;
  const pz = b.pumps.z;
  const xs = b.pumps.xs;
  const x0 = xs[0] - 1.6;
  const x1 = xs[2] + 1.6;
  const cx = (x0 + x1) / 2;
  // The concrete forecourt from the garage front to the road's pavement.
  const fc = S.forecourt;
  const y = ctx.heights.heightAt(cx, (fc.minZ + fc.maxZ) / 2);
  const slab = w.box(fc.maxX - fc.minX + 2, 0.06, fc.maxZ - fc.minZ + 0.8, M.concrete, (fc.minX + fc.maxX) / 2, 0.03, (fc.minZ + fc.maxZ) / 2 - 0.2, 4);
  slab.position.y = y - w.y0 + 0.03;
  void slab;
  // The island: concrete with a kerb and yellow guards round each pump.
  const isl = w.box(x1 - x0, 0.16, 1.1, M.kerb, cx, 0.08, pz, 1);
  void isl;
  const colours = [{ grade: 'UNLEADED', band: '#2f8a46', price: '1.52', fuel: 'petrol' }, { grade: 'UNLEADED', band: '#2f8a46', price: '1.52', fuel: 'petrol' }, { grade: 'DIESEL', band: '#222', price: '1.58', fuel: 'diesel' }];
  const bollardMat = new THREE.MeshStandardMaterial({ map: bollardTexture(random), roughness: 0.6 });
  const steel = new THREE.MeshStandardMaterial({ color: 0xb9bcbe, roughness: 0.3, metalness: 0.8 });
  const skirt = new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.6, metalness: 0.3 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
  const lit = (tex, strength) => {
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0 });
    ctx.night.push({ mat, strength });
    return mat;
  };
  xs.forEach((px, i) => {
    const c = colours[i];
    const face = lit(pumpFaceTexture(c.grade, c.band, c.price), 0.35);
    const side = new THREE.MeshStandardMaterial({ map: pumpSideTexture(c.band), roughness: 0.45, metalness: 0.15 });
    const header = lit(pumpHeaderTexture(c.band), 0.6);
    const body = new THREE.MeshStandardMaterial({ color: 0xdcdcd4, roughness: 0.4, metalness: 0.3 });
    const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(c.band), roughness: 0.5 });
    w.box(0.7, 0.14, 0.45, M.kerb, px, 0.23, pz, 1); // the base it is bolted to
    w.box(0.6, 0.3, 0.4, skirt, px, 0.45, pz, 0.6); // the dark skirt
    w.box(0.56, 1.1, 0.36, body, px, 1.15, pz, 0.6);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) w.box(0.03, 1.1, 0.03, steel, px + sx * 0.285, 1.15, pz + sz * 0.185, 0.6); // the corner trims
    w.box(0.6, 0.04, 0.4, steel, px, 0.6, pz, 0.6); // the trim between skirt and body
    w.box(0.62, 0.3, 0.42, body, px, 1.83, pz, 0.6); // the head
    w.box(0.66, 0.05, 0.46, accent, px, 1.995, pz, 0.6); // and its cap
    for (const s of [-1, 1]) {
      const fz = pz + s * 0.185;
      const r = s > 0 ? 0 : Math.PI;
      w.add(new THREE.PlaneGeometry(0.5, 0.75), face, px, 1.15, fz + s * 0.002).rotation.y = r;
      w.add(new THREE.PlaneGeometry(0.58, 0.14), header, px, 1.83, pz + s * 0.212).rotation.y = r;
      w.add(new THREE.PlaneGeometry(0.34, 1.1), side, px + s * 0.2865, 1.15, pz).rotation.y = (s * Math.PI) / 2;
    }
    // A holster, nozzle and hose on each side, on the pump's right-hand flank: the spout hangs in the holster and the hose runs from the
    // nozzle's back, down in a loop and into the pump's base.
    for (const s of [-1, 1]) {
      const hz = pz + s * 0.09;
      const hx = px + 0.285 + 0.07;
      w.box(0.14, 0.28, 0.14, M.iron, px + 0.285 + 0.035, 0.95, hz, 0.6); // the holster, fixed to the side
      w.add(new THREE.CylinderGeometry(0.014, 0.014, 0.26, 8), steel, hx, 0.92, hz); // the spout, in the holster
      w.box(0.07, 0.11, 0.05, accent, hx, 1.1, hz, 0.6); // the nozzle's body
      w.box(0.04, 0.03, 0.16, M.iron, hx, 1.17, hz + s * 0.05, 0.6); // its grip, back towards the hose
      w.add(new THREE.TorusGeometry(0.03, 0.008, 6, 10), steel, hx, 1.19, hz + s * 0.13); // the swivel
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hx, 1.15, hz + s * 0.13),
        new THREE.Vector3(hx + 0.1, 0.8, hz + s * 0.15),
        new THREE.Vector3(hx + 0.14, 0.4, hz + s * 0.12),
        new THREE.Vector3(hx + 0.04, 0.3, hz + s * 0.04),
        new THREE.Vector3(px + 0.27, 0.3, hz),
      ]);
      w.add(new THREE.TubeGeometry(curve, 20, 0.026, 8), rubber, 0, 0, 0);
    }
    w.solid(px, 0.95, pz, 0.38, 0.95, 0.28);
    for (const s of [-1, 1]) bollard(w, bollardMat, px + s * 0.55, pz, 0.7, 0.06); // a guard each side of the pump
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
    proxy.position.set(px, y + 0.9, pz);
    proxy.userData.proxyId = `pump${i}`;
    ctx.pumpProxies.push({ id: `pump${i}`, fuel: c.fuel, mesh: proxy, grade: c.grade, x: px, z: pz });
    ctx.root.add(proxy);
  });
  // The canopy: a flat roof on two columns with a deep fascia lit from inside and a row of lights underneath.
  const cy = y - w.y0 + 4.4;
  const cw = x1 - x0 + 3.6;
  const cd = 5.6;
  w.box(cw, 0.3, cd, M.paint, cx, cy, pz, 2);
  // A deep navy band round the roof's edge, the name on a lit panel in the middle of the long sides (at its own shape, not stretched along them).
  const band = new THREE.MeshStandardMaterial({ color: 0x1b2a44, roughness: 0.5 });
  w.box(cw + 0.04, 0.62, cd + 0.04, band, cx, cy, pz, 2);
  const fascia = new THREE.MeshStandardMaterial({ map: fasciaTexture(random, { text: 'HOLLIS MOTORS', bg: '#1b2a44', fg: '#f2f2ee', accent: '#e8c23a', font: 'bold 92px Arial, Helvetica, sans-serif', width: 1536, height: 192 }), roughness: 0.5, emissive: 0xffffff, emissiveIntensity: 0 });
  fascia.emissiveMap = fascia.map;
  ctx.night.push({ mat: fascia, strength: 0.7 });
  for (const s of [-1, 1]) w.add(new THREE.PlaneGeometry(4.64, 0.58), fascia, cx, cy, pz + s * (cd / 2 + 0.025)).rotation.y = s > 0 ? 0 : Math.PI;
  w.box(cw + 0.1, 0.1, cd + 0.1, M.iron, cx, cy + 0.36, pz, 2);
  for (const px of [x0 + 0.9, x1 - 0.9]) {
    w.box(0.34, cy, 0.34, M.paint, px, cy / 2 + 0.0, pz, 0.6);
    w.solid(px, cy / 2, pz, 0.17, cy / 2, 0.17);
  }
  for (const px of xs) w.box(0.5, 0.05, 0.5, M.signGlow, px, cy - 0.17, pz, 0.6);
  // The price board on its post at the east end of the frontage, by the lane the traffic comes in on, turned (both faces) to look back along the
  // road at whoever is coming, not straight at the pavement.
  const bx = S.forecourt.maxX + 1.4;
  const bz = S.forecourt.minZ + 1.0;
  const by = ctx.heights.heightAt(bx, bz) - w.y0;
  const turn = (3 * Math.PI) / 4;
  w.box(0.12, 2.0, 0.12, M.iron, bx, by + 1.0, bz, 0.6); // the post stops at the board's foot, so it never shows through the text
  w.box(0.2, 0.2, 0.2, M.iron, bx, by + 0.1, bz, 0.6);
  const priceMat = new THREE.MeshStandardMaterial({
    map: priceBoardTexture(random, 'HOLLIS MOTORS', [{ label: 'UNLEADED', price: '1.52', band: '#2f8a46' }, { label: 'DIESEL', price: '1.58', band: '#333' }]),
    roughness: 0.5,
    emissive: 0xffffff,
    emissiveIntensity: 0,
  });
  priceMat.emissiveMap = priceMat.map;
  ctx.night.push({ mat: priceMat, strength: 0.55 });
  w.box(1.1, 2.1, 0.12, M.iron, bx, by + 3.0, bz, 0.6).rotation.y = turn;
  for (const s of [-1, 1]) {
    const face = w.add(new THREE.PlaneGeometry(1.0, 2.0), priceMat, bx + Math.sin(turn) * s * 0.065, by + 3.0, bz + Math.cos(turn) * s * 0.065);
    face.rotation.y = s > 0 ? turn : turn + Math.PI;
  }
  w.solid(bx, by + 1.6, bz, 0.1, 1.6, 0.1);
}
