// The village drawn (world/village.js has its shapes): the side road off the lane with its pavements and kerbs, the pub with its car park and beer
// garden, the shop you can walk into, the garage and its pumps, five cottages, the green with its oak, the phone box, the bus shelter, lamps,
// the village sign and the speed limit signs, drystone walls shutting the village in and a gate across the road's end. All procedural, with
// colliders. Everything is merged into a few meshes per building, and the whole lot hides when you are a long way off (villageHost.js).

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { villageShape, roadMarks, roadLeadIn, streetLimitSigns } from './village.js';
import { roadStrip as sharedStrip, paintMarks as sharedMarks, kerbFace as sharedKerb } from './roadMesh.js';
import { makeVillageMaterials } from './villageMaterials.js';
import { buildCottage, buildPub, buildCarPark, buildShop, buildGarage } from './villageBuildings.js';
import { buildHouse, HOUSE_DESIGNS } from './villageHouses.js';
import { buildFarm } from './villageFarm.js';
import { lampPost, signPost, limitPost, villageSignAt, phoneBox, streetBench, approachSigns } from './villageFurniture.js';
import { limitSignTexture, roadClosedTexture, noticeTexture } from './villageTextures.js';
import { worldBox } from './outbuildingProps.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { enableShadows } from './assets.js';
import { cone } from './startLine.js';
import { buildFarVersion } from './farVersion.js';

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ROAD_LIFT = 0.075; // m above the ground, just over the lane's tarmac (0.07), with a polygon offset on top
const PAVEMENT_LIFT = 0.16;
const FLARE = 3.4; // m the road's mouth is wider by where it meets the lane
const FLARE_LENGTH = 11;
const LEAD_COUNT = 6; // samples laid out over the lane ahead of the road's first, LEAD_STEP m apart (roadLeadIn)
const LEAD_STEP = 2;
const BEYOND_HALF = 5.5; // m either side of the road past the closed gate that the hedges stand within
const BEYOND_OUTER = 2.3; // m the road past the gate's hedges stand out from its edge, at their outer face
const BEYOND_HEDGE = 2.4; // m the hedges stand over that road

/**
 * Merges every mesh under `root` (its sub-groups too) into one mesh per material, baked into `root`'s frame. Walls, roofs and windows never move,
 * so nothing is lost; meshes with `userData.proxyId` (things to look at and press E on) and cars are left as they are.
 */
export function mergeInto(root) {
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

/** A strip along the road's samples from offset `a` to `b` across (positive is the right of the way it runs: the north side heading west, the south heading east), lying `lift` m over the ground. */
function roadStrip(ctx, a, b, lift, material, { flare = false, clampX = Infinity, clampMin = -Infinity, ...opts } = {}) {
  // A strip clamped to the lane's edge starts out over the lane, so its slanting end is squashed flat onto the edge whole.
  const lead = Number.isFinite(clampX) || Number.isFinite(clampMin) ? roadLeadIn(ctx.S.road[0], LEAD_COUNT, LEAD_STEP) : [];
  for (const m of sharedStrip({ samples: ctx.S.road, heights: ctx.heights }, a, b, lift, material, { ...opts, clampX, clampMin, lead, flare: flare ? { width: FLARE, length: FLARE_LENGTH } : null })) ctx.root.add(m);
}

/** Paint on the road: each mark is { s, len, a, b } (world/roadMesh.js), merged into one mesh. */
function paintMarks(ctx, marks, material, lift) {
  const mesh = sharedMarks({ samples: ctx.S.road, heights: ctx.heights }, marks, material, lift);
  if (mesh) ctx.root.add(mesh);
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
  ctx.root.add(sharedKerb({ samples: ctx.S.road, heights: ctx.heights }, off, y0, y1, material, opts));
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
    // The wall stops at the hedge either side of the road that goes on past the gate (`beyondRoad`), tucked a hand into it; the collider below stays whole,
    // so nothing rides out that way. The road crosses at the beyond sample nearest the wall's line.
    const mid = alongX ? w.x : w.z;
    const q = S.beyond.reduce((best, p) => (Math.abs((alongX ? p.z - w.z : p.x - w.x)) < Math.abs((alongX ? best.z - w.z : best.x - w.x)) ? p : best));
    const crossing = Math.abs(alongX ? q.z - w.z : q.x - w.x) < 1 ? (alongX ? q.x : q.z) - mid : null;
    const gap = S.roadHalfWidth + BEYOND_OUTER - 0.1;
    const spans = crossing === null ? [[-len / 2, len / 2]] : [[-len / 2, crossing - gap], [crossing + gap, len / 2]].filter(([lo, hi]) => hi - lo > 0.05);
    for (const [lo, hi] of spans) {
      const n = Math.ceil((hi - lo) / run);
      const l = (hi - lo) / n;
      for (let i = 0; i < n; i++) {
        const c = lo + (i + 0.5) * l;
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
    }
    ctx.fixedBox(w.x, heights.heightAt(w.x, w.z) + 1, w.z, w.hx, 1.5, w.hz);
  }
}

/** Rows of vertices { x, y, z, u, v } (the same count in each) joined into a sheet added to `parts` under its material (drawn both sides). */
function sheet(parts, rows, material) {
  const part = parts.get(material) ?? { pos: [], uv: [], idx: [] };
  parts.set(material, part);
  const w = rows[0].length;
  rows.forEach((row, r) => {
    const base = part.pos.length / 3;
    for (const v of row) {
      part.pos.push(v.x, v.y, v.z);
      part.uv.push(v.u, v.v);
    }
    if (r > 0) {
      for (let c = 0; c < w - 1; c++) {
        const a = base - w + c;
        const b = base + c;
        part.idx.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  });
}

/** One mesh for each material's sheets, so a whole stretch of road and hedge is three draw calls. */
function flushSheets(ctx, parts) {
  for (const [material, part] of parts) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(part.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(part.uv, 2));
    g.setIndex(part.idx);
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, material);
    m.receiveShadow = true;
    m.userData.keep = true;
    m.frustumCulled = false;
    ctx.root.add(m);
  }
}

/**
 * The road past the closed gate: it carries on between tall hedges, bending away and climbing out of reach, and ends behind a hedge and trees,
 * so it reads as shut and not as never having gone anywhere. Only seen; the village's west wall still keeps you in.
 */
function beyondRoad(ctx) {
  const { S, M, heights } = ctx;
  const pts = S.beyond;
  const parts = new Map();
  const last = pts.length - 1;
  const hw = S.roadHalfWidth;
  const both = (mat) => {
    const m = mat.clone();
    m.side = THREE.DoubleSide;
    return m;
  };
  const tarmac = new THREE.MeshStandardMaterial({ map: ctx.tarmac, roughness: 0.92, side: THREE.DoubleSide });
  const verge = new THREE.MeshStandardMaterial({ color: 0x55672f, roughness: 1, side: THREE.DoubleSide });
  const hedge = both(M.hedge);
  const level = (i) => heights.heightAt(pts[i].x, pts[i].z) + ROAD_LIFT + S.beyondRise * smooth(clamp01(i / last));
  const vert = (i, o, y, u, v) => ({ x: pts[i].x - pts[i].tz * o, y, z: pts[i].z + pts[i].tx * o, u, v });
  const rowsOf = (make) => pts.map((_, i) => make(i));
  sheet(parts, rowsOf((i) => [-hw, 0, hw].map((o, k) => vert(i, o, level(i), k / 2, i / 4))), tarmac);
  for (const side of [-1, 1]) {
    const inner = side * (hw + 0.9);
    const outer = side * (hw + BEYOND_OUTER);
    sheet(parts, rowsOf((i) => [side * (hw - 0.1), inner].map((o, k) => vert(i, o, level(i) - 0.02, k, i / 2))), verge);
    sheet(parts, rowsOf((i) => [level(i) - 0.02, level(i) + BEYOND_HEDGE].map((y, k) => vert(i, inner, y, i / 3, k * 0.5))), hedge);
    // The hedge's near end, by the gate, is shut with a face, so there is no looking up into its hollow.
    sheet(parts, [level(0) - 0.02, level(0) + BEYOND_HEDGE].map((y, k) => [inner, outer].map((o, j) => vert(0, o, y, j * 0.5, k * 0.5))), hedge);
    sheet(parts, rowsOf((i) => [inner, outer].map((o, k) => vert(i, o, level(i) + BEYOND_HEDGE, i / 3, 0.5 + k * 0.25))), hedge);
    sheet(parts, rowsOf((i) => {
      const x = pts[i].x - pts[i].tz * outer;
      const z = pts[i].z + pts[i].tx * outer;
      return [level(i) + BEYOND_HEDGE, heights.heightAt(x, z) - 1.5].map((y, k) => vert(i, outer, y, i / 3, 0.75 + k * 0.25));
    }), hedge);
  }
  // A hedge across the end, and trees behind it.
  const end = [last, last].map((i, k) => [-1, 1].map((side) => vert(i, side * (hw + BEYOND_OUTER), k ? level(i) + BEYOND_HEDGE : level(i) - 0.02, 0.5 + side * 0.5, k * 0.5)));
  sheet(parts, end, hedge);
  flushSheets(ctx, parts);
  const tip = pts[last];
  oak(ctx, tip.x + tip.tx * 2.5 - tip.tz * 3, tip.z + tip.tz * 2.5 + tip.tx * 3, 1.1);
  oak(ctx, tip.x + tip.tx * 3 + tip.tz * 3, tip.z + tip.tz * 3 - tip.tx * 3, 0.9);
}

/**
 * The road's end: a five-bar gate across it, a "road closed" board on a stand, two cones and a hedge each side. The group is built facing west
 * (+x is back along the road) and turned to the road's heading at the gate, which runs south now.
 */
function roadEnd(ctx) {
  const { M, S, heights } = ctx;
  const { x, z: rz, tx, tz } = S.gate;
  const y = heights.heightAt(x, rz);
  const g = new THREE.Group();
  g.position.set(x, y + ROAD_LIFT, rz); // on the road's surface, not the ground under it
  g.rotation.y = Math.atan2(tz, -tx);
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
  // The "road closed" board stands in the road in front of the gate (on the village side), on two legs with feet, facing the traffic; its back is plain.
  const bx = 1.3;
  const faceMat = new THREE.MeshStandardMaterial({ map: roadClosedTexture(), roughness: 0.6 });
  const front = add(new THREE.PlaneGeometry(1.6, 0.6), faceMat, bx + 0.012, 1.1, 0);
  front.rotation.y = Math.PI / 2;
  const back = add(new THREE.PlaneGeometry(1.6, 0.6), M.iron, bx - 0.052, 1.1, 0);
  back.rotation.y = -Math.PI / 2;
  add(worldBox(0.05, 0.64, 1.66, 1), M.iron, bx - 0.02, 1.1, 0); // its frame
  for (const s of [-0.65, 0.65]) {
    add(worldBox(0.06, 1.1, 0.06, 1), M.iron, bx - 0.02, 0.55, s); // legs
    add(worldBox(0.5, 0.05, 0.06, 1), M.iron, bx - 0.02, 0.025, s); // and feet
  }
  for (const s of [-1.6, 1.8]) {
    const c = cone(); // the same cone as the lap line and the climbs
    c.position.set(2.4, 0, s);
    g.updateMatrixWorld();
    const at = g.localToWorld(c.position.clone());
    c.position.y = heights.heightAt(at.x, at.z) + ROAD_LIFT + 0.02 - g.position.y; // each on the road where it stands, the road being on a cross-slope
    g.add(c);
  }
  ctx.root.add(g);
  ctx.groups.push(g);
  // Colliders are upright boxes, so they are laid across or along the road by which way it runs at the gate.
  const alongX = Math.abs(tx) > Math.abs(tz);
  const box = (along, across, hAlong, hAcross, up, hUp) => {
    const [px, pz] = alongX ? [x + along, rz + across] : [x + across, rz + along];
    ctx.fixedBox(px, y + up, pz, alongX ? hAlong : hAcross, hUp, alongX ? hAcross : hAlong);
  };
  box(0, 0, 0.3, half + 0.3, 1, 1.2);
  // Back to the village's wall past the gate, so there is no way round it.
  const wall = alongX ? (tx < 0 ? S.area.minX : S.area.maxX) : tz > 0 ? S.area.maxZ : S.area.minZ;
  const ahead = Math.abs(wall - (alongX ? x : rz));
  for (const s of [-1, 1]) box(Math.sign(alongX ? tx : tz) * ahead / 2, s * (half + 3.2), ahead / 2, 3.2, 0.9, 0.9);
}

/** Builds the village and its colliders. `c` is the props context (props.js). Returns null on a farm without one. */
/** The village from afar (world/farVersion.js): each building a box with a gabled roof in the colour of its walls and its roof. */
const WALLS = { stone: '#8c877a', brick: '#9a5c48' };
export function farVillage(S, heights) {
  const buildings = [...S.buildings, ...S.laneBuildings].map((b) => {
    const wall = b.kind === 'cottage' || b.kind === 'farmhouse' || b.kind === 'barn' ? (b.wall === 'render' ? b.paint : WALLS[b.wall]) : b.kind === 'shop' ? WALLS.brick : b.kind === 'pub' ? '#ece5d0' : WALLS.brick;
    const roof = b.kind === 'garage' || b.kind === 'barn' ? '#8d9294' : b.design === 'thatched' ? '#8a7440' : b.kind === 'cottage' && b.wall !== 'stone' ? '#a85a3e' : '#42474c';
    const turned = Math.abs(Math.sin(b.yaw ?? 0)) > 0.5; // a house facing the lane has its frontage along z
    return { x: b.x, z: b.z, y: heights.heightAt(b.x, b.z), halfX: turned ? b.halfZ : b.halfX, halfZ: turned ? b.halfX : b.halfZ, wallHeight: b.wallHeight, ridge: b.ridge, wall, roof };
  });
  return buildFarVersion('villageFar', { buildings });
}

export function buildVillage(c) {
  const { scene, layout, heights, fixedBox, random } = c;
  const S = villageShape(layout);
  if (!S) return null;
  const root = new THREE.Group();
  root.name = 'village';
  const homes = [...layout.village.cottages, ...(layout.village.approach?.houses ?? []), ...(layout.village.approach ? [layout.village.approach.farm.house] : [])];
  const doorColours = ['#2d4a3a', '#7a1f2b', ...homes.flatMap((b) => [b.door, ...(b.doors ?? [])])];
  const renders = ['#ece5d0', ...homes.filter((b) => b.paint).map((b) => b.paint)];
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
    furniture: null, // every lamp post and road sign in one group, so the street's lot merge into a mesh or two a material, not two a post
    rootGroup: (name, y = 0) => {
      const g = new THREE.Group();
      g.name = name;
      g.position.y = y;
      root.add(g);
      ctx.groups.push(g);
      return g;
    },
  };

  ctx.furniture = ctx.rootGroup('village-furniture');

  // The road and its pavements. The road is the lane's tarmac, widening at its mouth; the pavements stand 8 cm proud with a kerb; they stop for the
  // garage's forecourt and the car park's mouth.
  const poly = { polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 };
  const road = new THREE.MeshStandardMaterial({ map: tarmac, roughness: 0.92, ...poly });
  const hw = S.roadHalfWidth;
  const curb = S.curb;
  const gap = (s) => (p) => p.x > s.x0 && p.x < s.x1;
  // The street's two sides are the sign of an offset across it: positive is the right of the way it is drawn, the north heading west and the south
  // heading east. The garage's forecourt opens onto the street on today's farm (the south side); on the new farm it opens onto the lane instead.
  const northSign = S.eastward ? -1 : 1;
  const forecourtOnStreet = !S.v.garage.forecourt;
  const none = () => false;
  const garageGap = forecourtOnStreet ? gap({ x0: S.garage.outer.minX - 0.5, x1: S.garage.outer.maxX + 0.5 }) : none;
  // The pavement and the road's edge line stop where the car park opens onto the road (a dropped kerb).
  const carParkGap = gap({ x0: S.carPark.entry.minX - 0.5, x1: S.carPark.entry.maxX + 0.5 });
  const skipFor = (side) => (side === northSign ? carParkGap : garageGap);
  // The road ends at the lane's west edge, not its middle: the lane's tarmac is under the rest, so no texture is drawn over another. It is built
  // from its first sample (on the lane's middle) so the cross-sections the clamp squashes onto the edge cover the whole bellmouth: starting at the
  // last sample outside the edge left its slanting end short of the lane, a wedge of bare ground at the junction.
  roadStrip(ctx, -hw, hw, ROAD_LIFT, road, { flare: true, from: 0, ...(S.eastward ? { clampMin: S.laneEdge } : { clampX: S.laneEdge }) });
  // A broken line down the middle, a give-way line across the way out onto the lane, and a pale edge line either side.
  const line = new THREE.MeshStandardMaterial({ color: 0xcfcfc4, roughness: 0.9, ...poly, polygonOffsetFactor: -5 });
  const marks = roadMarks(S);
  paintMarks(ctx, [...marks.centre, ...marks.giveWay], line, ROAD_LIFT + 0.004);
  for (const side of S.street.markings.edge ? [-1, 1] : []) {
    roadStrip(ctx, side * (hw - 0.3), side * (hw - 0.2), ROAD_LIFT + 0.004, line, { from: 14, skip: skipFor(side), cols: 2 });
  }
  // Pavements start past the mouth (the road is wider there), one each side, with kerbs.
  for (const side of [-1, 1]) {
    const skip = skipFor(side);
    const [a, b] = side < 0 ? [-curb, -hw] : [hw, curb];
    roadStrip(ctx, a, b, PAVEMENT_LIFT, M.paving, { from: 16, skip, uv: 1 });
    kerbFace(ctx, side * hw, ROAD_LIFT, PAVEMENT_LIFT, M.kerb, { from: 16, skip });
  }

  // Paving from each building's front to the pavement (the cottages' doorsteps, the shop's frontage, the pub's terrace). Where a building stands well back
  // (the new farm's, whose fronts are 10 m and more from the street) it is a terrace by the door of the depth it needs and a path across the rest.
  const TERRACE = { pub: 7, shop: 5, cottage: 3 };
  for (const b of S.buildings) {
    if (b.kind === 'garage') continue;
    const front = b.yaw === 0 ? b.outer.maxZ : b.outer.minZ;
    const face = b.yaw === 0 ? 1 : -1;
    const at = S.roadAt(b.x, front + face * 4).at;
    const edge = at.z + (face > 0 ? -curb : curb);
    const gapZ = Math.abs(edge - front);
    if (gapZ < 0.4) continue;
    const reach = Math.min(gapZ, TERRACE[b.kind]);
    groundPatch(ctx, b.outer.minX - 0.3, front - face * 0.1, b.outer.maxX + 0.3, front + face * reach, 0.09, M.paving);
    if (gapZ > reach + 0.2) {
      const px = b.door?.x ?? b.x;
      groundPatch(ctx, px - 0.8, front + face * (reach - 0.1), px + 0.8, edge, 0.09, M.paving);
    }
  }

  // Buildings.
  // The street's cottages and the lane's houses: the plain pair of storeys, or one of the other designs (#543).
  [...S.buildings.filter((b) => b.kind === 'cottage'), ...S.laneBuildings.filter((b) => b.kind !== 'barn')].forEach((b, i) => (HOUSE_DESIGNS.includes(b.design) ? buildHouse(ctx, b, i) : buildCottage(ctx, b, i)));
  buildFarm(ctx);
  buildPub(ctx, S.pub);
  const cars = buildCarPark(ctx);
  buildShop(ctx, S.shop);
  buildGarage(ctx, S.garage);

  // Street furniture.
  const lamps = S.closed ? 6 : Math.floor((S.road.length - 40) / 15);
  for (let k = 0; k < lamps; k++) {
    const i = 24 + k * 15;
    const p = S.road[Math.min(S.road.length - 2, i)];
    const side = k % 2 ? -1 : 1;
    const off = side * (curb - 0.35);
    const x = p.x + -p.tz * off;
    const z = p.z + p.tx * off;
    if (skipFor(side)(p) || S.builtAt(x, z, 0.3)) continue;
    lampPost(ctx, x, z, { x: p.x, z: p.z });
  }
  phoneBox(ctx, S.v.phone);
  busShelter(ctx);
  green(ctx);
  // The village sign at the junction, facing the traffic coming in from the lane, and one on the other side of the street too (#537).
  const signYaw = S.eastward ? -Math.PI / 2 : Math.PI / 2;
  villageSignAt(ctx, S.v.sign.x, S.v.sign.z, signYaw);
  if (!S.closed) {
    const at = S.roadAt(S.v.sign.x, S.v.sign.z).at;
    villageSignAt(ctx, S.v.sign.x, 2 * at.z - S.v.sign.z, signYaw);
    streetBench(ctx, S.v.farBench, 0);
    approachSigns(ctx);
  }
  const limit = limitSignTexture(S.limit);
  const at = (i, side) => {
    const p = S.road[Math.min(S.road.length - 2, i)];
    const off = side * (curb + 0.1);
    return { x: p.x + -p.tz * off, z: p.z + p.tx * off };
  };
  if (S.closed) {
    // A sign each side as you turn in, and repeaters (a 20 on a lamp-height post) through the village.
    for (const [i, side] of [[18, 1], [18, -1], [58, 1], [92, -1]]) {
      const { x, z } = at(i, side);
      if (S.builtAt(x, z, 0.6)) continue;
      signPost(ctx, x, z, side * (S.eastward ? -1 : 1) < 0 ? Math.PI / 2 : -Math.PI / 2, limit, 0.75, 0.75, { round: true, height: 2.2 });
    }
  } else {
    // The 20 mph limit (#537), at the street's two ends and halfway; the lane gets none (its 30s are `approachSigns`).
    for (const p of streetLimitSigns(S)) limitPost(ctx, p);
  }
  if (S.closed) {
    boundaryWalls(ctx);
    roadEnd(ctx);
    beyondRoad(ctx);
  }
  // The oaks: the green's, and two in the gaps behind the houses (layout.village.trees, kept clear of every building).
  for (const t of S.v.trees) oak(ctx, t.x, t.z, t.scale);

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
