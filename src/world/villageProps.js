// The village drawn (world/village.js has its shapes): the side road off the lane with its pavements and kerbs, the pub with its car park and beer
// garden, the shop you can walk into, the garage and its pumps, five cottages, the green with its oak, the phone box, the bus shelter, lamps,
// the village sign and the speed limit signs, drystone walls shutting the village in and a gate across the road's end. All procedural, with
// colliders. Everything is merged into a few meshes per building, and the whole lot hides when you are a long way off (villageHost.js).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { villageShape } from './village.js';
import { makeVillageMaterials } from './villageMaterials.js';
import { buildCottage, buildPub, buildCarPark, buildShop, buildGarage, frameFor, signMaterial } from './villageBuildings.js';
import { villageSignTexture, limitSignTexture, roadClosedTexture, noticeTexture } from './villageTextures.js';
import { worldBox } from './outbuildingProps.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { enableShadows } from './assets.js';
import { buildFarVersion } from './farVersion.js';

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ROAD_LIFT = 0.075; // m above the ground, just over the lane's tarmac (0.07), with a polygon offset on top
const PAVEMENT_LIFT = 0.16;
const FLARE = 3.4; // m the road's mouth is wider by where it meets the lane
const FLARE_LENGTH = 11;

/**
 * Merges every mesh under `root` (its sub-groups too) into one mesh per material, baked into `root`'s frame. Walls, roofs and windows never move,
 * so nothing is lost; meshes with `userData.proxyId` (things to look at and press E on) and cars are left as they are.
 */
function mergeInto(root) {
  root.updateMatrixWorld(true);
  const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const byMaterial = new Map();
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh && !o.userData.proxyId && !o.userData.keep) meshes.push(o);
  });
  for (const o of meshes) {
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone()).applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, o.matrixWorld));
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    if (!byMaterial.has(o.material)) byMaterial.set(o.material, []);
    byMaterial.get(o.material).push(geo);
    o.parent.remove(o);
    o.geometry.dispose();
  }
  for (const [material, geos] of byMaterial) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), material);
    root.add(mesh);
  }
}

/** A strip along the road's samples from offset `a` to `b` across (positive is the north side, to the right heading west), lying `lift` m over the ground. */
function roadStrip(ctx, a, b, lift, material, { from = 0, to = Infinity, skip = null, flare = false, uv = 1, cols = 5 } = {}) {
  const { S, heights } = ctx;
  const runs = [];
  let run = null;
  S.road.forEach((p, i) => {
    const ok = i >= from && i <= to && !(skip && skip(p, i));
    if (ok) (run ??= []).push(i);
    else if (run) {
      runs.push(run);
      run = null;
    }
  });
  if (run) runs.push(run);
  for (const r of runs) {
    if (r.length < 2) continue;
    const pos = [];
    const uvs = [];
    const idx = [];
    r.forEach((i, k) => {
      const p = S.road[i];
      const nx = -p.tz;
      const nz = p.tx;
      const widen = flare ? FLARE * (1 - smooth(clamp01(i / FLARE_LENGTH))) : 0;
      for (let c = 0; c < cols; c++) {
        const t = c / (cols - 1);
        const o = a + (b - a) * t + (flare ? (t - 0.5) * 2 * widen : 0);
        const x = p.x + nx * o;
        const z = p.z + nz * o;
        pos.push(x, heights.heightAt(x, z) + lift, z);
        uvs.push(t * uv, i / 4);
      }
      if (k > 0) {
        for (let c = 0; c < cols - 1; c++) {
          const i0 = (k - 1) * cols + c;
          const i1 = k * cols + c;
          idx.push(i0, i0 + 1, i1, i0 + 1, i1 + 1, i1);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.userData.keep = true; // it follows the ground: merging would only bake what it is
    m.frustumCulled = false;
    ctx.root.add(m);
  }
}

/** A flat patch of paving over the ground from (x0, z0) to (x1, z1), following it on a 1 m grid, `lift` m up. */
function groundPatch(ctx, x0, z0, x1, z1, lift, material) {
  const nx = Math.max(1, Math.ceil(Math.abs(x1 - x0)));
  const nz = Math.max(1, Math.ceil(Math.abs(z1 - z0)));
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nz; j++) {
    for (let i = 0; i <= nx; i++) {
      const x = x0 + ((x1 - x0) * i) / nx;
      const z = z0 + ((z1 - z0) * j) / nz;
      pos.push(x, ctx.heights.heightAt(x, z) + lift, z);
      uv.push(x / 1.2, z / 1.2);
      if (i > 0 && j > 0) {
        const a = j * (nx + 1) + i;
        const b = (j - 1) * (nx + 1) + i;
        if ((x1 - x0) * (z1 - z0) > 0) idx.push(b - 1, a - 1, b, b, a - 1, a);
        else idx.push(b - 1, b, a - 1, b, a, a - 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.receiveShadow = true;
  m.userData.keep = true;
  m.frustumCulled = false;
  ctx.root.add(m);
}

/** A vertical face along the road at offset `off`, from `y0` to `y1` over the ground: a kerb. */
function kerbFace(ctx, off, y0, y1, material, opts) {
  const { S, heights } = ctx;
  const pos = [];
  const idx = [];
  let n = 0;
  S.road.forEach((p, i) => {
    if (i < opts.from || (opts.skip && opts.skip(p, i))) {
      n = 0;
      return;
    }
    const x = p.x + -p.tz * off;
    const z = p.z + p.tx * off;
    const g = heights.heightAt(x, z);
    pos.push(x, g + y0, z, x, g + y1, z);
    if (n > 0) {
      const a = pos.length / 3 - 4;
      idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3, a + 2, a + 1, a, a + 3, a + 1, a + 2);
    }
    n++;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, material);
  m.userData.keep = true;
  m.frustumCulled = false;
  ctx.root.add(m);
}

/** A cast-iron lamp post at (x, z) with its arm over the road: a fluted base, a tapering post, a scroll bracket and a glowing lantern. */
function lampPost(ctx, x, z, towards) {
  const { M, heights } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.atan2(towards.x - x, towards.z - z);
  const add = (geo, mat, px, py, pz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  add(new THREE.CylinderGeometry(0.17, 0.2, 0.7, 8), M.iron, 0, 0.35, 0);
  add(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 8), M.iron, 0, 0.72, 0);
  add(new THREE.CylinderGeometry(0.06, 0.11, 3.1, 8), M.iron, 0, 2.2, 0);
  add(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 8), M.iron, 0, 3.78, 0);
  const arm = add(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 6), M.iron, 0, 3.9, 0.4);
  arm.rotation.x = Math.PI / 2;
  const curl = add(new THREE.TorusGeometry(0.28, 0.02, 6, 12, Math.PI / 2), M.iron, 0, 3.55, 0.28);
  curl.rotation.y = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.14, 0.09, 0.3, 6), M.lampGlow, 0, 3.72, 0.8);
  add(new THREE.ConeGeometry(0.2, 0.14, 6), M.iron, 0, 3.94, 0.8);
  add(new THREE.SphereGeometry(0.03, 6, 4), M.iron, 0, 4.03, 0.8);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1.6, z, 0.14, 1.6, 0.14);
}

/** A sign on a post at (x, z), its face turned to look along `yaw` (0 looks south, +z): a round limit sign, a board or a roadside notice. */
function signPost(ctx, x, z, yaw, texture, w, h, { height = 2.1, round = false } = {}) {
  const { M, heights } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, height + 0.3, 8), M.lead);
  post.position.y = (height + 0.3) / 2 - 0.1;
  g.add(post);
  const face = new THREE.Mesh(round ? new THREE.CircleGeometry(w / 2, 24) : new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: texture, roughness: 0.5, metalness: 0.1 }));
  face.position.set(0, height - h / 2 + 0.1, 0.05);
  g.add(face);
  const back = new THREE.Mesh(round ? new THREE.CircleGeometry(w / 2, 24) : new THREE.PlaneGeometry(w, h), M.lead);
  back.position.set(0, height - h / 2 + 0.1, 0.04);
  back.rotation.y = Math.PI;
  g.add(back);
  const ring = new THREE.Mesh(round ? new THREE.TorusGeometry(w / 2, 0.012, 6, 28) : new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.02), M.lead);
  ring.position.set(0, height - h / 2 + 0.1, 0.045);
  g.add(ring);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1, z, 0.08, 1.1, 0.08);
}

/** The village entrance sign: a painted board on two posts with a little tiled roof, facing the traffic coming in from the lane. */
function villageSign(ctx) {
  const { M, S, heights, random } = ctx;
  const { x, z } = S.v.sign;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.PI / 2; // looks along +x, towards the lane
  const box = (w, h, d, mat, px, py, pz) => {
    const o = new THREE.Mesh(worldBox(w, h, d, 0.6), mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  for (const sx of [-1, 1]) box(0.14, 2.7, 0.14, M.timber, sx * 1.1, 1.35, 0);
  box(2.5, 0.2, 0.18, M.timber, 0, 2.62, 0);
  const board = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.3), signMaterial(ctx, villageSignTexture(random, S.name), 0.2));
  board.position.set(0, 1.78, 0.1);
  g.add(board);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(1.95, 1.3), signMaterial(ctx, villageSignTexture(random, S.name), 0.2));
  back.position.set(0, 1.78, -0.1);
  back.rotation.y = Math.PI;
  g.add(back);
  box(2.1, 1.4, 0.16, M.paintDark, 0, 1.78, 0);
  // The little roof: two boards in a ridge over the top, and a finial.
  for (const s of [-1, 1]) {
    const roof = box(1.7, 0.06, 0.8, M.clay, 0, 2.95, s * 0.32);
    roof.rotation.x = s * 0.5;
  }
  box(2.9, 0.08, 0.1, M.timber, 0, 3.15, 0);
  // A flower bed in front of it.
  box(2.4, 0.3, 0.9, M.stone, 0, 0.15, 0.95);
  for (let k = 0; k < 14; k++) {
    const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), M.blooms[k % 4]);
    b.position.set(-1 + (k * 2) / 13, 0.38 + (k % 3) * 0.04, 0.95 + ((k % 2) - 0.5) * 0.4);
    g.add(b);
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 0.8, z, 0.5, 0.8, 1.3);
}

/** A telephone box: red cast frame, eight panes a side, a domed roof with the crown plate, and a lit lamp inside after dark. */
function phoneBox(ctx) {
  const { M, S, heights } = ctx;
  const { x, z } = S.v.phone;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.PI; // the door faces the road (north)
  const w = 0.95;
  const h = 2.4;
  const add = (geo, mat, px, py, pz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  add(new THREE.BoxGeometry(w + 0.1, 0.12, w + 0.1), M.red, 0, 0.06, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.07, h, 0.07), M.red, sx * w / 2, h / 2, sz * w / 2);
  for (const side of [0, 1, 2, 3]) {
    const pane = add(new THREE.PlaneGeometry(w - 0.08, h - 0.2), M.phoneGlow, 0, h / 2 + 0.02, 0);
    pane.rotation.y = (side * Math.PI) / 2;
    pane.position.set(Math.sin((side * Math.PI) / 2) * (w / 2 - 0.02), h / 2 + 0.02, Math.cos((side * Math.PI) / 2) * (w / 2 - 0.02));
  }
  add(new THREE.BoxGeometry(w + 0.18, 0.2, w + 0.18), M.red, 0, h + 0.1, 0);
  const dome = add(new THREE.ConeGeometry((w + 0.18) * 0.72, 0.32, 4), M.red, 0, h + 0.36, 0);
  dome.rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(0.4, 0.2, 0.03), M.paint, 0, h + 0.02, w / 2 + 0.06); // the TELEPHONE sign
  add(new THREE.BoxGeometry(0.3, 0.3, 0.3), M.iron, 0.3, 1.0, -0.3); // the phone
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1.25, z, 0.5, 1.25, 0.5);
}

/** A bus shelter: timber posts and roof rail, glazed back and ends, a bench, a timetable, facing the road. */
function busShelter(ctx) {
  const { M, S, heights, random } = ctx;
  const { x, z } = S.v.busStop;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = Math.PI; // open to the north
  const add = (geo, mat, px, py, pz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  const W = 3.2;
  const D = 1.3;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(new THREE.BoxGeometry(0.12, 2.5, 0.12), M.timber, sx * W / 2, 1.25, sz * D / 2);
  add(worldBox(W + 0.4, 0.1, D + 0.4, 0.6), M.timber, 0, 2.55, 0);
  const roof = add(new THREE.BoxGeometry(W + 0.5, 0.06, D + 0.5), M.lead, 0, 2.66, 0);
  roof.rotation.x = 0.06;
  add(new THREE.PlaneGeometry(W - 0.1, 1.9), M.clear, 0, 1.4, -D / 2);
  for (const sx of [-1, 1]) {
    const e = add(new THREE.PlaneGeometry(D - 0.1, 1.9), M.clear, sx * W / 2, 1.4, 0);
    e.rotation.y = Math.PI / 2;
  }
  add(new THREE.BoxGeometry(W - 0.2, 0.05, 0.4), M.timber, 0, 0.5, -D / 2 + 0.3);
  for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.05, 0.5, 0.35), M.iron, sx * (W / 2 - 0.3), 0.25, -D / 2 + 0.3);
  add(new THREE.PlaneGeometry(0.5, 0.7), new THREE.MeshStandardMaterial({ map: noticeTexture(random, 'BUS TIMES', 10), roughness: 0.6 }), 0.9, 1.3, -D / 2 + 0.03);
  add(new THREE.BoxGeometry(0.7, 0.12, 0.05), M.signGlow, 0, 2.45, -D / 2 + 0.05);
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1.2, z, W / 2 + 0.1, 1.25, D / 2 + 0.1);
}

/** An oak: a tapering trunk, three boughs and a crown of leafy blobs. Solid at the trunk. */
function oak(ctx, x, z, scale = 1) {
  const { M, heights, random } = ctx;
  const y = heights.heightAt(x, z);
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.55, 4, 9), M.bark);
  trunk.position.y = 1.9;
  g.add(trunk);
  for (let i = 0; i < 3; i++) {
    const a = i * 2.1 + 0.4;
    const bough = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.6, 7), M.bark);
    bough.position.set(Math.cos(a) * 0.9, 4.6, Math.sin(a) * 0.9);
    bough.rotation.set(Math.sin(a) * 0.65, 0, -Math.cos(a) * 0.65);
    g.add(bough);
  }
  for (let i = 0; i < 12; i++) {
    const a = random() * Math.PI * 2;
    const r = 0.8 + random() * 2.1;
    const blob = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2 + random() * 1.0, 1), M.crown);
    blob.position.set(Math.cos(a) * r, 5.6 + random() * 2.2, Math.sin(a) * r);
    blob.scale.y = 0.8;
    g.add(blob);
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 2, z, 0.5 * scale, 2, 0.5 * scale);
}

/** The green: an oak, a bench to look at it from, the war memorial's cross, a flower tub, and a cast-iron litter bin. */
function green(ctx) {
  const { M, S, heights } = ctx;
  const gr = S.v.green;
  oak(ctx, gr.x - 1.5, gr.z - 1.5, 1.05);
  // The bench.
  const bx = gr.x + 0.4;
  const bz = gr.z + 2.4;
  const y = heights.heightAt(bx, bz);
  const g = new THREE.Group();
  g.position.set(bx, y, bz);
  g.rotation.y = 0; // faces south, to the road
  const add = (geo, mat, px, py, pz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  for (const dz of [-0.14, 0, 0.14]) add(worldBox(1.6, 0.04, 0.12, 0.6), M.weathered, 0, 0.47, dz);
  for (const dy of [0.72, 0.86]) add(worldBox(1.6, 0.1, 0.03, 0.6), M.weathered, 0, dy, -0.22);
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(0.06, 0.48, 0.5), M.iron, sx * 0.72, 0.24, 0);
    add(new THREE.BoxGeometry(0.06, 0.5, 0.05), M.iron, sx * 0.72, 0.72, -0.22);
  }
  add(new THREE.BoxGeometry(0.3, 0.16, 0.04), M.brass, 0, 0.9, -0.24); // the memorial plaque on the back
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(bx, y + 0.45, bz, 0.85, 0.45, 0.3);
  // The memorial cross on three steps.
  const mx = gr.x + 3.2;
  const mz = gr.z - 0.2;
  const my = heights.heightAt(mx, mz);
  const mem = new THREE.Group();
  mem.position.set(mx, my, mz);
  const padd = (w, h, d, px, py, pz) => {
    const o = new THREE.Mesh(worldBox(w, h, d, 1), M.stone);
    o.position.set(px, py, pz);
    mem.add(o);
  };
  padd(1.6, 0.14, 1.6, 0, 0.07, 0);
  padd(1.2, 0.14, 1.2, 0, 0.21, 0);
  padd(0.8, 0.14, 0.8, 0, 0.35, 0);
  padd(0.5, 0.9, 0.5, 0, 0.87, 0);
  padd(0.34, 1.6, 0.34, 0, 2.1, 0);
  padd(1.0, 0.3, 0.3, 0, 2.55, 0);
  ctx.root.add(mem);
  ctx.groups.push(mem);
  ctx.fixedBox(mx, my + 1.3, mz, 0.8, 1.3, 0.8);
}

/** Drystone walls along the village's north, south and west edges, in runs of 4 m that follow the ground, capped; the lane's own barrier is the east. */
function boundaryWalls(ctx) {
  const { M, S, heights } = ctx;
  const t = 0.55;
  const h = 1.25;
  const run = 4;
  const cap = new THREE.MeshStandardMaterial({ color: 0x77736a, roughness: 0.95 });
  const group = ctx.rootGroup('village-walls');
  for (const w of S.walls) {
    const alongX = w.hx > w.hz;
    const len = (alongX ? w.hx : w.hz) * 2;
    const n = Math.ceil(len / run);
    for (let i = 0; i < n; i++) {
      const a = -len / 2 + i * run;
      const l = Math.min(run, len / 2 - a);
      const c = a + l / 2;
      const px = alongX ? w.x + c : w.x;
      const pz = alongX ? w.z : w.z + c;
      const gy = Math.max(heights.heightAt(px, pz), heights.heightAt(px + (alongX ? l / 2 : 0), pz + (alongX ? 0 : l / 2)), heights.heightAt(px - (alongX ? l / 2 : 0), pz - (alongX ? 0 : l / 2)));
      const bw = alongX ? l + 0.02 : t;
      const bd = alongX ? t : l + 0.02;
      const stone = new THREE.Mesh(worldBox(bw, h + 0.6, bd, 1), M.stone);
      stone.position.set(px, gy - 0.6 + (h + 0.6) / 2, pz);
      group.add(stone);
      const top = new THREE.Mesh(worldBox(bw + 0.1, 0.1, bd + 0.1, 1), cap);
      top.position.set(px, gy + h + 0.05, pz);
      group.add(top);
    }
    ctx.fixedBox(w.x, heights.heightAt(w.x, w.z) + 1, w.z, w.hx, 1.5, w.hz);
  }
}

/** The road's end: a five-bar gate across it, a "road closed" board on a stand, two cones and a hedge each side. */
function roadEnd(ctx) {
  const { M, S, heights } = ctx;
  const last = S.road[S.road.length - 1];
  const x = S.v.end.barrierX;
  const rz = S.roadAt(x, last.z).at.z;
  const y = heights.heightAt(x, rz);
  const g = new THREE.Group();
  g.position.set(x, y, rz);
  const half = S.roadHalfWidth + S.v.road.pavement;
  const add = (geo, mat, px, py, pz) => {
    const o = new THREE.Mesh(geo, mat);
    o.position.set(px, py, pz);
    g.add(o);
    return o;
  };
  for (const s of [-1, 1]) add(worldBox(0.3, 1.7, 0.3, 0.6), M.timber, 0, 0.85, s * (half + 0.2));
  for (const s of [-1, 1]) {
    const leaf = gateLeaf(M.weathered, M.iron, half);
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.02, s * (half + 0.05));
    if (s > 0) leaf.rotation.y = Math.PI;
    pivot.add(leaf);
    g.add(pivot);
  }
  const board = add(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshStandardMaterial({ map: roadClosedTexture(), roughness: 0.6 }), 0.0, 1.35, -0.0);
  board.position.x = -0.2;
  board.rotation.y = Math.PI / 2;
  const cone = new THREE.MeshStandardMaterial({ color: 0xe8591f, roughness: 0.6 });
  for (const s of [-1.6, 1.8]) {
    add(new THREE.ConeGeometry(0.17, 0.6, 12), cone, 1.4, 0.3, s);
    add(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 12), M.iron, 1.4, 0.025, s);
    add(new THREE.CylinderGeometry(0.13, 0.11, 0.1, 12), M.paint, 1.4, 0.34, s);
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  ctx.fixedBox(x, y + 1, rz, 0.3, 1.2, half + 0.3);
  for (const s of [-1, 1]) {
    const hz = rz + s * (half + 3.2);
    ctx.fixedBox(x - 1.2, y + 0.9, hz, 1.2, 0.9, 3.2);
  }
}

/** Builds the village and its colliders. `c` is the props context (props.js). Returns null on a farm without one. */
/** The village from afar (world/farVersion.js): each building a box with a gabled roof in the colour of its walls and its roof. */
const WALLS = { stone: '#8c877a', brick: '#9a5c48' };
export function farVillage(S, heights) {
  const buildings = S.buildings.map((b) => {
    const wall = b.kind === 'cottage' ? (b.wall === 'render' ? b.paint : WALLS[b.wall]) : b.kind === 'shop' ? WALLS.brick : b.kind === 'pub' ? '#ece5d0' : WALLS.brick;
    const roof = b.kind === 'garage' ? '#8d9294' : b.kind === 'cottage' && b.wall !== 'stone' ? '#a85a3e' : '#42474c';
    return { x: b.x, z: b.z, y: heights.heightAt(b.x, b.z), halfX: b.halfX, halfZ: b.halfZ, wallHeight: b.wallHeight, ridge: b.ridge, wall, roof };
  });
  return buildFarVersion('villageFar', { buildings });
}

export function buildVillage(c) {
  const { scene, layout, heights, fixedBox, random } = c;
  const S = villageShape(layout);
  if (!S) return null;
  const root = new THREE.Group();
  root.name = 'village';
  const doorColours = ['#2d4a3a', '#7a1f2b', ...layout.village.cottages.map((b) => b.door)];
  const renders = ['#ece5d0', ...layout.village.cottages.filter((b) => b.paint).map((b) => b.paint)];
  const M = makeVillageMaterials(random, { doorColours: [...new Set(doorColours)], renders: [...new Set(renders)] });
  const tarmac = new THREE.CanvasTexture(c.laneTexture());
  tarmac.wrapS = tarmac.wrapT = THREE.RepeatWrapping;
  tarmac.colorSpace = THREE.SRGBColorSpace;
  const ctx = {
    root,
    S,
    M,
    heights,
    fixedBox,
    random,
    tarmac,
    groups: [],
    night: [],
    shopProxies: [],
    partProxies: [],
    pumpProxies: [],
    rootGroup: (name, y = 0) => {
      const g = new THREE.Group();
      g.name = name;
      g.position.y = y;
      root.add(g);
      ctx.groups.push(g);
      return g;
    },
  };

  // The road and its pavements. The road is the lane's tarmac, widening at its mouth; the pavements stand 8 cm proud with a kerb; they stop for the
  // garage's forecourt and the car park's mouth.
  const poly = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
  const road = new THREE.MeshStandardMaterial({ map: tarmac, roughness: 0.92, ...poly });
  const hw = S.roadHalfWidth;
  const curb = S.curb;
  const gap = (s) => (p) => p.x > s.x0 && p.x < s.x1;
  const south = gap({ x0: S.garage.outer.minX - 0.5, x1: S.garage.outer.maxX + 0.5 });
  const north = () => false;
  roadStrip(ctx, -hw, hw, ROAD_LIFT, road, { flare: true });
  // A give-way line at the junction and a pale edge line either side of the road.
  const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...poly, polygonOffsetFactor: -5 });
  roadStrip(ctx, -hw, hw, ROAD_LIFT + 0.004, line, { from: 13, to: 14, cols: 2 });
  for (const side of [-1, 1]) {
    roadStrip(ctx, side * (hw - 0.3), side * (hw - 0.2), ROAD_LIFT + 0.004, line, { from: 14, skip: (p) => (side < 0 ? south(p) : north(p)), cols: 2 });
  }
  // Pavements start past the mouth (the road is wider there), one each side, with kerbs.
  for (const side of [-1, 1]) {
    const skip = side < 0 ? south : north;
    const [a, b] = side < 0 ? [-curb, -hw] : [hw, curb];
    roadStrip(ctx, a, b, PAVEMENT_LIFT, M.paving, { from: 16, skip, uv: 1 });
    kerbFace(ctx, side * hw, ROAD_LIFT, PAVEMENT_LIFT, M.kerb, { from: 16, skip });
  }

  // Paving from each building's front to the pavement (the cottages' doorsteps, the shop's frontage, the pub's terrace).
  for (const b of S.buildings) {
    if (b.kind === 'garage') continue;
    const front = b.yaw === 0 ? b.outer.maxZ : b.outer.minZ;
    const face = b.yaw === 0 ? 1 : -1;
    const at = S.roadAt(b.x, front + face * 4).at;
    const edge = at.z + (face > 0 ? -curb : curb);
    if (Math.abs(edge - front) < 0.4) continue;
    groundPatch(ctx, b.outer.minX - 0.3, front - face * 0.1, b.outer.maxX + 0.3, edge, 0.09, M.paving);
  }

  // Buildings.
  S.buildings.filter((b) => b.kind === 'cottage').forEach((b, i) => buildCottage(ctx, b, i));
  buildPub(ctx, S.pub);
  const cars = buildCarPark(ctx);
  buildShop(ctx, S.shop);
  buildGarage(ctx, S.garage);

  // Street furniture.
  for (let k = 0; k < 6; k++) {
    const i = 24 + k * 15;
    const p = S.road[Math.min(S.road.length - 2, i)];
    const side = k % 2 ? -1 : 1;
    const off = side * (curb - 0.35);
    const x = p.x + -p.tz * off;
    const z = p.z + p.tx * off;
    if ((side < 0 ? south : north)(p) || S.builtAt(x, z, 0.3)) continue;
    lampPost(ctx, x, z, { x: p.x, z: p.z });
  }
  phoneBox(ctx);
  busShelter(ctx);
  green(ctx);
  villageSign(ctx);
  // The 20 mph limit: a sign each side as you turn in, and repeaters (a 20 on a lamp-height post) through the village.
  const limit = limitSignTexture(S.limit);
  for (const [i, side] of [[18, 1], [18, -1], [58, 1], [92, -1]]) {
    const p = S.road[Math.min(S.road.length - 2, i)];
    const off = side * (curb + 0.1);
    const x = p.x + -p.tz * off;
    const z = p.z + p.tx * off;
    if (S.builtAt(x, z, 0.6)) continue;
    signPost(ctx, x, z, side < 0 ? Math.PI / 2 : -Math.PI / 2, limit, 0.75, 0.75, { round: true, height: 2.2 });
  }
  boundaryWalls(ctx);
  roadEnd(ctx);
  // A hedge-and-tree backdrop: three small trees in the cottages' back gardens.
  for (const [x, z] of [[170, 168.8], [150, 205 - 0.5 - 1], [125, 168]]) oak(ctx, x, z, 0.7);

  for (const g of ctx.groups) mergeInto(g);
  enableShadows(root);
  scene.add(root);
  const far = farVillage(S, heights);
  root.userData.farVersion = far;
  far.visible = false; // FarDetail shows it, and hides the full village, from a distance
  scene.add(far);

  return {
    group: root,
    far,
    shape: S,
    cars,
    shopProxies: ctx.shopProxies,
    partProxies: ctx.partProxies,
    pumpProxies: ctx.pumpProxies,
    motProxy: ctx.motProxy,
    motBay: ctx.motBay,
    /** 0..1 how dark it is: the windows, lamps and lit signs glow once it is (never a light). */
    setNight(darkness) {
      M.setNight(darkness);
      const k = Math.max(0, Math.min(1, (darkness - 0.3) / 0.5));
      for (const n of ctx.night) n.mat.emissiveIntensity = k * n.strength;
    },
  };
}
