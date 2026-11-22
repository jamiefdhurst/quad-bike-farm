// The Moor drawn (#713, layout 2 only): the drystone ridge wall with its ladder stile, the trig pillar and the cairn on the ridge, the two cattle grids on Back Lane with
// their bridle gates and signs, the gritstone outcrops and boulders, the peat banks' cut stones, the spring's stone ring, and the plants: heather in older and younger
// stands, bracken on the lower slopes and cotton grass, rushes and tussocks in the wet flushes. The ground under it is painted by moorPaint.js and shaped by moor.js.
// The set pieces are in the group named `moor` (a `SET_PIECE_NAMES` entry: its detail is only drawn near); the wall, the plants and the boulders are in the scene on
// their own, in tiles, the plants with the draw distance, the wall with a plain far strip swapped in by distance (hedgeFar.js).

import * as THREE from 'three';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { buildFarHedges, HedgeSwap } from './hedgeFar.js';
import { frondGeometry, matrixAt } from './hillProps.js';
import { roadNetwork } from './roads.js';
import { sidePoint, hedgeOffset } from './laneHedges.js';
import { moorStretch, MOOR_SIDE, BRIDLE_GATE_OFFSET } from './backLaneProps.js';
import { gridPlace, wallPieces } from './moor.js';
import { moorColours } from './moorCover.js';
import { gritstoneTexture } from './landmarkTextures.js';
import { concreteTexture, galvanisedTexture } from './villageTextures.js';
import { woodTexture } from './neighbourTextures.js';
import { worldBox } from './outbuildingProps.js';
import { gateLeaf } from './neighbourFarmProps.js';
import * as kit from './roadSigns.js';
import { enableShadows } from './assets.js';

const WALL_HEIGHT_FALLBACK = 1.35;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...extra });
/** A weathered grey-brown for a lit-white stone: its lightness between `l0` and `l1` (the hill's wall is 0.2 to 0.34). */
const grey = (random, l0 = 0.2, l1 = 0.36) => new THREE.Color().setHSL(0.09 + random() * 0.04, 0.05 + random() * 0.08, l0 + random() * (l1 - l0));

/**
 * Where each cattle grid and its bridle gate are, on the lane (`road`): [{ id, s, x, z, tx, tz, gate: { s, side } }]. A grid lies across the lane where the common's
 * unhedged stretch starts (the first) and ends (the second), the nearest the lane has to the plan's place for it; the bridle gate is in the hedge on the common's side
 * a few metres outside the stretch, so a walker or a horse has its own way through.
 */
export function moorGrids(road, layout) {
  const stretch = moorStretch(road);
  if (!stretch) return [];
  return layout.moor.grids.map((g) => {
    const place = gridPlace(road, g.near);
    const p = sidePoint(road, place.s, 1, 0);
    return { id: g.id, s: place.s, x: place.x, z: place.z, tx: p.tx, tz: p.tz, gate: { s: place.s + (place.s <= stretch.from + 1e-6 ? -BRIDLE_GATE_OFFSET : BRIDLE_GATE_OFFSET), side: MOOR_SIDE } };
  });
}

/** A flat-sided stone: a dodecahedron, its faces a little uneven. One geometry for every outcrop lump, boulder and wall stone. */
function stoneGeometry(random, detail = 0) {
  const geo = new THREE.DodecahedronGeometry(1, detail);
  const pos = geo.getAttribute('position');
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.86 + random() * 0.28);
    const k = seen.get(key);
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** The pieces of the wall as matrices of stones (courses and a cope) and the colliders along it. Returns the matrices and colours. */
function wallStones(c, M) {
  const { heights, fixedBox, random } = c;
  const h = M.wall.height;
  const courses = Math.round((h - 0.1) / 0.28);
  const stones = [];
  const colors = [];
  for (const piece of wallPieces(M.wall, 3)) {
    const tx = Math.cos(piece.yaw);
    const tz = -Math.sin(piece.yaw);
    const ends = [heights.heightAt(piece.x - tx * piece.len / 2, piece.z - tz * piece.len / 2), heights.heightAt(piece.x, piece.z), heights.heightAt(piece.x + tx * piece.len / 2, piece.z + tz * piece.len / 2)];
    const top = Math.max(...ends);
    fixedBox(piece.x, top + h / 2 - 0.2, piece.z, piece.len / 2 + 0.05, h / 2 + 0.2, M.wall.thickness / 2, piece.yaw);
    for (let d = -piece.len / 2; d < piece.len / 2; d += 0.42 + random() * 0.14) {
      const x = piece.x + tx * d;
      const z = piece.z + tz * d;
      const ground = heights.heightAt(x, z);
      for (let course = 0; course < courses; course++) {
        const off = (course % 2) * 0.2;
        const px = x + tx * off + (random() - 0.5) * 0.08;
        const pz = z + tz * off + (random() - 0.5) * 0.08;
        // Two stones across a course, each a face on one side of the wall, with the heart between.
        for (const side of [-1, 1]) {
          const along = 0.26 + random() * 0.1;
          const across = 0.14 + random() * 0.04;
          stones.push(matrixAt(px - tz * side * 0.17, ground + 0.15 + course * 0.28, pz + tx * side * 0.17, piece.yaw + (random() - 0.5) * 0.3, along, 0.14 + random() * 0.04, across));
          colors.push(grey(random));
        }
      }
      // The cope: flat stones set on edge along the top.
      stones.push(matrixAt(x, ground + h - 0.07, z, piece.yaw + (random() - 0.5) * 0.3, 0.3 + random() * 0.1, 0.14 + random() * 0.06, 0.26));
      colors.push(grey(random, 0.3, 0.44));
    }
  }
  return { stones, colors };
}

/** Far strips for the wall, a piece for each stretch of its collider, in the same tiles as the stones. */
function wallFar(c, M) {
  const { heights } = c;
  const pieces = wallPieces(M.wall, 3).map((p, i) => {
    const tx = Math.cos(p.yaw);
    const tz = -Math.sin(p.yaw);
    const a = [p.x - tx * p.len / 2, p.z - tz * p.len / 2];
    const b = [p.x + tx * p.len / 2, p.z + tz * p.len / 2];
    return {
      x: p.x, z: p.z, cx: p.x, cz: p.z, along: [tx, tz], length: p.len, width: M.wall.thickness, top: Math.max(heights.heightAt(...a), heights.heightAt(p.x, p.z), heights.heightAt(...b)) + M.wall.height,
      gap: i === 0, kind: 'wall', groundA: heights.heightAt(...a), groundB: heights.heightAt(...b),
    };
  });
  return buildFarHedges(pieces, { name: 'ridge wall far' });
}

/** The trig pillar: a white concrete pillar 1.2 m high on a plinth, narrowing to a flat top with a brass plate, and a brass bracket on its face. */
export function buildTrigPillar(random) {
  const g = new THREE.Group();
  g.name = 'trigPillar';
  const concrete = new THREE.MeshStandardMaterial({ map: concreteTexture(random), color: 0xe8e6de, roughness: 0.9 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08d3e, metalness: 0.75, roughness: 0.38 });
  const plinth = new THREE.Mesh(worldBox(0.72, 0.14, 0.72, 0.5), concrete);
  plinth.position.y = 0.05;
  g.add(plinth);
  // The shaft: square, 0.46 across at the foot and 0.3 at the top, 1.0 m tall, set on the plinth.
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.325, 1.0, 4, 1).rotateY(Math.PI / 4), concrete);
  shaft.position.y = 0.7;
  g.add(shaft);
  const cap = new THREE.Mesh(worldBox(0.38, 0.05, 0.38, 0.5), concrete);
  cap.position.y = 1.225;
  g.add(cap);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.012, 16), brass);
  plate.position.y = 1.2575; // sunk into the cap
  g.add(plate);
  const dimple = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.012, 8), new THREE.MeshStandardMaterial({ color: 0x3a2f14, roughness: 0.5 }));
  dimple.position.y = 1.267;
  g.add(dimple);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6), brass);
    bolt.position.set(Math.cos(a) * 0.075, 1.2625, Math.sin(a) * 0.075);
    g.add(bolt);
  }
  const bracket = new THREE.Mesh(worldBox(0.12, 0.09, 0.012, 0.5), brass); // the flush bracket plate low on the face
  bracket.position.set(0, 0.42, 0.285);
  g.add(bracket);
  return g;
}

/** A cairn: a heap of fist to head sized stones piled to a point, `radius` m across at the foot and `height` m high. */
export function buildCairn(random, radius = 1.5, height = 1.6) {
  const g = new THREE.Group();
  g.name = 'cairn';
  const geo = stoneGeometry(random, 0);
  const mat = new THREE.MeshStandardMaterial({ map: gritstoneTexture(random), roughness: 0.95, flatShading: true });
  const rings = 7;
  for (let ring = 0; ring < rings; ring++) {
    const t = ring / (rings - 1);
    const rr = radius * (1 - t) * 0.92;
    const n = Math.max(1, Math.round(3 + rr * 9));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + random() * 0.6;
      const size = 0.17 + random() * 0.14;
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * rr * (ring ? 1 : 0.3), 0.1 + t * (height - 0.28) + random() * 0.05, Math.sin(a) * rr * (ring ? 1 : 0.3));
      m.scale.set(size * (1.1 + random() * 0.5), size * (0.7 + random() * 0.3), size * (1 + random() * 0.4));
      m.rotation.set(random() * 0.6, random() * Math.PI * 2, random() * 0.6);
      g.add(m);
    }
  }
  return g;
}

/**
 * A cattle grid across the lane, its deck along the road: steel bars over a pit between concrete sills, kerbs painted white on top (the bridle gate and the signs are placed
 * round it in `buildMoorProps`). Local +x is the way along the road and the grid's middle is the origin.
 */
export const MOOR_GRID_LENGTH = 3.6; // m of bars along the lane
export const MOOR_GRID_PITCH = 0.16; // m from one bar to the next
export function buildMoorGrid(c, halfRoad) {
  const { random } = c;
  const group = new THREE.Group();
  group.name = 'moorGrid';
  const length = MOOR_GRID_LENGTH;
  const width = 2 * halfRoad + 0.5;
  const pitch = MOOR_GRID_PITCH;
  const concrete = std(concreteTexture(random));
  const steel = std(galvanisedTexture(random), { metalness: 0.65, roughness: 0.42 });
  const pitMat = std(concreteTexture(random), { color: 0x2a2926, roughness: 1 });
  const paint = new THREE.MeshStandardMaterial({ color: 0xe8e6de, roughness: 0.85 });
  const add = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    group.add(m);
    return m;
  };
  add(worldBox(length, 0.02, width - 0.1, 1), pitMat, 0, 0.065, 0); // the pit's floor, dark under the bars
  for (const sx of [-1, 1]) add(worldBox(0.1, 0.07, width - 0.1, 0.5), steel, sx * (length / 2 - 0.22), 0.1, 0); // the bearers
  const n = Math.floor(length / pitch);
  const bars = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.035, 0.035, width - 0.12, 8).rotateX(Math.PI / 2), steel, n);
  const m = new THREE.Matrix4();
  for (let i = 0; i < n; i++) bars.setMatrixAt(i, m.makeTranslation(-length / 2 + (i + 0.5) * pitch, 0.14, 0));
  group.add(bars);
  for (const sx of [-1, 1]) add(worldBox(0.4, 0.11, width + 0.1, 1), concrete, sx * (length / 2 + 0.2), 0.11, 0); // the sills
  const kerb = [paint, paint, paint, concrete, concrete, concrete];
  for (const sz of [-1, 1]) add(worldBox(length + 0.76, 0.21, 0.28, 1), kerb, 0, 0.15, sz * (width / 2 + 0.14));
  return group;
}

/** A steel bridle gate, 1.4 m between its stone-capped timber posts, swung shut: a leaf of rails, a hanging stile, a latch. Its length along local z; shut. */
export function buildBridleGate(random) {
  const g = new THREE.Group();
  g.name = 'bridleGate';
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [92, 74, 54]), roughness: 0.95 });
  const iron = new THREE.MeshStandardMaterial({ color: 0x24282a, metalness: 0.6, roughness: 0.5 });
  const w = 1.4;
  for (const sz of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.5, 0.16), wood);
    post.position.set(0, 0.7, sz * (w / 2 + 0.08));
    g.add(post);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), iron);
    cap.position.set(0, 1.47, sz * (w / 2 + 0.08));
    g.add(cap);
  }
  const leaf = gateLeaf(wood, iron, w - 0.1);
  leaf.position.z = -(w - 0.1) / 2; // the leaf's hinge end is at its origin: slide it between the posts
  g.add(leaf);
  return g;
}

/** A ring of dressed stones round the spring, with a dark wet hollow in the middle. */
function buildSpring(c, M, group) {
  const { heights, random } = c;
  const [sx, sz] = M.spring.at;
  const geo = stoneGeometry(random, 0);
  const mat = new THREE.MeshStandardMaterial({ map: gritstoneTexture(random), roughness: 0.95, flatShading: true });
  const water = new THREE.MeshStandardMaterial({ color: 0x1c2a22, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.85 });
  const y = heights.heightAt(sx, sz);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(0.7, 16).rotateX(-Math.PI / 2), water);
  pool.position.set(sx, y + 0.02, sz);
  group.add(pool);
  for (let i = 0; i < 13; i++) {
    const a = (i / 13) * Math.PI * 2 + random() * 0.3;
    if (Math.cos(a) > 0.7) continue; // the east side is open: the stream leaves that way
    const size = 0.2 + random() * 0.12;
    const m = new THREE.Mesh(geo, mat);
    m.position.set(sx + Math.cos(a) * 0.95, y + size * 0.3, sz + Math.sin(a) * 0.95);
    m.scale.set(size * 1.3, size * 0.8, size);
    m.rotation.y = random() * Math.PI;
    group.add(m);
  }
}

/** Where the plants must not grow: on the lane, in the stream's bed and its banks, on the pillar's and the spring's ground. */
function bareAt(c, M, net, lane) {
  const stream = c.layout.hill?.stream;
  const west = stream?.west?.minX ?? -Infinity;
  const zAt = (x) => (stream ? stream.z + stream.wander * Math.sin(x * 0.05 + 1.1) : Infinity);
  return (x, z) => !!net.nearest(x, z, lane.halfWidth + 2.2) || (x > west - 4 && Math.abs(z - zAt(x)) < 3.2)
    || Math.hypot(x - M.trig.at[0], z - M.trig.at[1]) < 1.6 || Math.hypot(x - M.spring.at[0], z - M.spring.at[1]) < 1.4;
}

/** A small clump of heather: a flattened dome of 80 faces, uneven, dark at the foot. */
function heatherGeometry(random) {
  const geo = new THREE.IcosahedronGeometry(1, 1);
  const pos = geo.getAttribute('position');
  const colors = [];
  const seen = new Map(); // the geometry is not indexed: one jitter for every corner at the same place, or the dome cracks open
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, 0.78 + random() * 0.34);
    const k = seen.get(key);
    const y = Math.max(pos.getY(i), -0.2);
    pos.setXYZ(i, pos.getX(i) * k, y * 0.5 * k + 0.12, pos.getZ(i) * k);
    const l = 0.62 + 0.38 * Math.min(1, Math.max(0, (y + 0.2) / 1.2));
    colors.push(l, l, l);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  // Lit as a soft dome, not as facets: each normal leans up from the clump's middle, so a heap of twigs reads as one rounded clump from any side.
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3(pos.getX(i), pos.getY(i) * 1.6 + 0.5, pos.getZ(i)).normalize();
    normals.setXYZ(i, n.x, n.y, n.z);
  }
  return geo;
}

/** The plants: [{ mesh group, material, kind }] in the scene, coloured for the day by `setDate`. */
function buildPlants(c, M, moor, bare) {
  const { scene, heights, random, drawDistance } = c;
  const b = M.bounds;
  const lambert = (extra = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...extra });
  // The fronds' own vertex colours are the hill's greens: here the day's colour is the whole of it, so they are left off.
  const mats = { heather: lambert(), bracken: lambert({ vertexColors: false, side: THREE.DoubleSide }), tussock: lambert({ vertexColors: false, side: THREE.DoubleSide }), cotton: new THREE.MeshLambertMaterial({ color: 0xffffff }) };
  const scatter = (count, accept, make) => {
    const matrices = [];
    const colors = [];
    for (let tries = 0; matrices.length < count && tries < count * 14; tries++) {
      const x = b.minX + random() * (b.maxX - b.minX);
      const z = b.minZ + random() * (b.maxZ - b.minZ);
      if (!moor.onCommon(x, z) || bare(x, z) || !accept(x, z)) continue; // the common only: never the farm's side of the lane
      make(x, z, matrices, colors);
    }
    return { matrices, colors };
  };
  const light = (l0, l1) => new THREE.Color().setHSL(0, 0, l0 + random() * (l1 - l0));

  // Heather: clumps 0.35 to 0.7 m, in older (bigger, darker) and younger stands.
  const heather = scatter(44000, (x, z) => random() < moor.heatherAt(x, z), (x, z, m, col) => {
    const age = moor.heatherAge(x, z);
    const s = 0.5 + age * 0.3 + random() * 0.25;
    m.push(matrixAt(x, heights.heightAt(x, z) - 0.04, z, random() * 6.28, s * 1.2, s * (0.8 + random() * 0.4), s * 1.2));
    col.push(light(0.8 - age * 0.18, 1));
  });
  scene.add(drawDistance.add(tiledInstances(heatherGeometry(random), mats.heather, heather.matrices, { colors: heather.colors, name: 'moor heather' }), 'roughDistance'));

  // Bracken on the lower slopes.
  const fronds = frondGeometry(random, 4, 0.95, 0.17, 0.45);
  const bracken = scatter(6500, (x, z) => random() < moor.brackenAt(x, z), (x, z, m, col) => {
    const s = 0.7 + random() * 0.6;
    m.push(matrixAt(x, heights.heightAt(x, z) - 0.03, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
    col.push(light(0.7, 1));
  });
  scene.add(drawDistance.add(tiledInstances(fronds, mats.bracken, bracken.matrices, { colors: bracken.colors, name: 'moor bracken' }), 'roughDistance'));

  // Cotton grass, rushes and tussocks in the flushes, and the white heads of the cotton grass on stalks over them.
  const tussockGeo = frondGeometry(random, 9, 0.5, 0.03, 0.55);
  const tufts = scatter(6500, (x, z) => random() < moor.wetAt(x, z) * 0.9, (x, z, m, col) => {
    const s = 0.7 + random() * 0.9;
    m.push(matrixAt(x, heights.heightAt(x, z) - 0.02, z, random() * 6.28, s, s * (0.7 + random() * 0.8), s));
    col.push(light(0.65, 1));
  });
  scene.add(drawDistance.add(tiledInstances(tussockGeo, mats.tussock, tufts.matrices, { colors: tufts.colors, name: 'moor tussocks' }), 'roughDistance'));
  const heads = [];
  for (const m of tufts.matrices) {
    if (random() < 0.5) continue;
    const x = m.elements[12] + (random() - 0.5) * 0.3;
    const z = m.elements[14] + (random() - 0.5) * 0.3;
    const s = 0.05 + random() * 0.03;
    heads.push(matrixAt(x, heights.heightAt(x, z) + 0.32 + random() * 0.22, z, 0, s, s * 1.3, s));
  }
  const cottonGroup = drawDistance.add(tiledInstances(new THREE.IcosahedronGeometry(1, 0), mats.cotton, heads, { name: 'moor cotton grass' }), 'roughDistance');
  scene.add(cottonGroup);
  return { mats, cottonGroup };
}

/**
 * The Moor's things. `c` is the props context (props.js). Returns { group, hedgeSwap, setDate(date), grids, parts } or null on a farm with no moor.
 * `setDate` colours the plants for the farm's date (moorCover.js): purple heather in August and September, rust bracken in the autumn, white cotton grass in June.
 */
export function buildMoorProps(c) {
  const { scene, layout, heights, fixedBox, random, physics, RAPIER } = c;
  const M = layout.moor;
  if (!M) return null;
  const moor = heights.moor;
  const net = roadNetwork(layout);
  const lane = net.road('backLane');
  const group = new THREE.Group();
  group.name = 'moor';
  const wallH = M.wall.height ?? WALL_HEIGHT_FALLBACK;

  // The ridge wall: courses of weathered stones either side of a heart, a cope, with a collider all along it.
  const { stones, colors } = wallStones(c, M);
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true });
  const near = tiledInstances(stoneGeometry(random), stoneMat, stones, { colors, tileSize: MODEL_TILE, castShadow: true, name: 'ridge wall' });
  const far = wallFar(c, M);
  scene.add(near, far);

  // The ladder stile over it, turned to the wall's line there.
  const [stx, stz] = M.stile.at;
  const stileTangent = (() => {
    const pts = M.wall.points;
    const k = pts.findIndex((p) => Math.hypot(p[0] - stx, p[1] - stz) < 0.01);
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    return { x: (b[0] - a[0]) / len, z: (b[1] - a[1]) / len };
  })();
  const stile = kit.buildLadderStile(random, wallH, M.wall.thickness);
  stile.position.set(stx, heights.heightAt(stx, stz), stz);
  stile.rotation.y = Math.atan2(stileTangent.x, stileTangent.z); // local z along the wall
  group.add(stile);

  // The trig pillar and the cairn on the ridge.
  const trig = buildTrigPillar(random);
  const [tx, tz] = M.trig.at;
  trig.position.set(tx, heights.heightAt(tx, tz) - 0.02, tz);
  trig.rotation.y = 0.35;
  group.add(trig);
  fixedBox(tx, heights.heightAt(tx, tz) + 0.62, tz, 0.32, 0.62, 0.32);
  const cairn = buildCairn(random, M.cairn.radius, M.cairn.height);
  const [cx, cz] = M.cairn.at;
  cairn.position.set(cx, heights.heightAt(cx, cz) - 0.05, cz);
  group.add(cairn);
  physics.createCollider(RAPIER.ColliderDesc.cylinder(M.cairn.height * 0.45, M.cairn.radius * 0.7).setTranslation(cx, heights.heightAt(cx, cz) + M.cairn.height * 0.45, cz));

  // The cattle grids, each with its bridle gate in the hedge, a warning sign each way and a sheep sign.
  const grids = lane ? moorGrids(lane, layout) : [];
  const signs = { grid: kit.buildCattleGridSign(), sheep: kit.buildSheepSign() };
  for (const gr of grids) {
    const deck = buildMoorGrid(c, lane.halfWidth);
    const along = Math.atan2(-gr.tz, gr.tx); // local x along the lane
    const y0 = heights.heightAt(gr.x - gr.tx * 1.8, gr.z - gr.tz * 1.8);
    const y1 = heights.heightAt(gr.x + gr.tx * 1.8, gr.z + gr.tz * 1.8);
    deck.position.set(gr.x, (y0 + y1) / 2 + (lane.lift ?? 0.05) - 0.07, gr.z);
    deck.rotation.order = 'YZX'; // along the lane, then tilted with its fall
    deck.rotation.set(0, along, Math.atan2(y1 - y0, 3.6));
    group.add(deck);
    // The bridle gate, in the hedge on the common's side, shut.
    const gate = buildBridleGate(random);
    const gp = sidePoint(lane, gr.gate.s, gr.gate.side, hedgeOffset(lane, gr.gate.s, gr.gate.side));
    const gy = heights.heightAt(gp.x, gp.z);
    gate.position.set(gp.x, gy, gp.z);
    gate.rotation.y = Math.atan2(gp.tx, gp.tz); // its length along the lane
    group.add(gate);
    fixedBox(gp.x, gy + 0.6, gp.z, 0.75, 0.6, 0.08, Math.atan2(-gp.tz, gp.tx));
    // The signs: the grid warning 24 m out each way and the sheep sign 40 m out, on the verge, each facing the traffic that comes to it.
    for (const dir of [-1, 1]) {
      for (const [kind, away] of [['grid', 24], ['sheep', 40]]) {
        const at = sidePoint(lane, gr.s + dir * away, -MOOR_SIDE, lane.halfWidth + 1.3);
        const sg = signs[kind].clone();
        sg.position.set(at.x, heights.heightAt(at.x, at.z), at.z);
        sg.rotation.y = Math.atan2(dir * at.tx, dir * at.tz);
        group.add(sg);
        fixedBox(at.x, heights.heightAt(at.x, at.z) + 1, at.z, 0.07, 1.1, 0.07);
      }
    }
  }

  // The gritstone outcrops and boulders, lichened, with a collider for each outcrop and the bigger boulders.
  const lumpGeo = stoneGeometry(random, 0);
  const lumps = [];
  const lumpColors = [];
  const lichen = () => new THREE.Color(0.72, 0.8, 0.5);
  const lump = (x, z, sx, sy, sz, yaw, lift = 0) => {
    lumps.push(matrixAt(x, heights.heightAt(x, z) + sy * 0.5 + lift, z, yaw, sx, sy, sz));
    lumpColors.push(random() < 0.3 ? grey(random, 0.45, 0.7).multiply(lichen()) : grey(random, 0.4, 0.75));
  };
  for (const o of moor.outcrops) {
    const n = 7 + Math.floor(random() * 5);
    for (let i = 0; i < n; i++) {
      const a = random() * Math.PI * 2;
      const d = Math.sqrt(random()) * o.r * 0.7;
      const big = 1 - d / (o.r * 0.9);
      const w = o.r * (0.28 + 0.2 * random()) * (0.6 + 0.6 * big);
      lump(o.x + Math.cos(a) * d, o.z + Math.sin(a) * d, w, o.h * (0.5 + 0.7 * big) * (0.7 + random() * 0.5), w * (0.8 + random() * 0.4), random() * Math.PI, o.h * 0.25 * big);
    }
    physics.createCollider(RAPIER.ColliderDesc.cylinder(o.h * 0.5, o.r * 0.5).setTranslation(o.x, heights.heightAt(o.x, o.z) + o.h * 0.4, o.z));
  }
  for (const b of moor.boulders) {
    lump(b.x, b.z, b.size * 0.8, b.size * 0.6, b.size * 0.7, b.yaw);
    if (b.size > 0.6) physics.createCollider(RAPIER.ColliderDesc.cylinder(b.size * 0.25, b.size * 0.45).setTranslation(b.x, heights.heightAt(b.x, b.z) + b.size * 0.25, b.z));
  }
  const rockMat = new THREE.MeshStandardMaterial({ map: gritstoneTexture(random), color: 0xffffff, roughness: 0.96, flatShading: true });
  scene.add(c.drawDistance.add(tiledInstances(lumpGeo, rockMat, lumps, { colors: lumpColors, tileSize: MODEL_TILE, castShadow: true, name: 'moor rocks' }), 'roughDistance')); // cut off with the plants (#821)

  // The peat banks: dark turves cut and left to dry on the lip of each, a few stacked on end.
  const turfGeo = worldBox(0.3, 0.12, 0.16, 0.3);
  const turfMat = new THREE.MeshStandardMaterial({ color: 0x241b13, roughness: 1 });
  const turves = [];
  for (const p of M.peat) {
    const len = Math.hypot(p.b[0] - p.a[0], p.b[1] - p.a[1]);
    const ux = (p.b[0] - p.a[0]) / len;
    const uz = (p.b[1] - p.a[1]) / len;
    for (let d = 2; d < len - 2; d += 1.1 + random() * 1.4) {
      const x = p.a[0] + ux * d - uz * (1.6 + random());
      const z = p.a[1] + uz * d + ux * (1.6 + random());
      const stack = 1 + Math.floor(random() * 3);
      for (let k = 0; k < stack; k++) turves.push(matrixAt(x + (random() - 0.5) * 0.1, heights.heightAt(x, z) + 0.06 + k * 0.12, z, Math.atan2(-uz, ux) + (random() - 0.5) * 0.5, 1, 1, 1));
    }
  }
  scene.add(tiledInstances(turfGeo, turfMat, turves, { tileSize: MODEL_TILE, name: 'peat turves' }));

  buildSpring(c, M, group);
  enableShadows(group);
  scene.add(group);

  const bare = bareAt(c, M, net, lane);
  const plants = buildPlants(c, M, moor, bare);
  let shown = null;
  const setDate = (date) => {
    shown = date;
    const k = moorColours(date);
    plants.mats.heather.color.setHex(k.heather);
    plants.mats.bracken.color.setHex(k.bracken);
    plants.mats.tussock.color.setHex(k.tussock);
    plants.mats.cotton.color.setHex(0xf4f2ea);
    plants.cottonGroup.visible = k.cotton > 0.05;
  };
  /** One line for the console and the panel: which month the plants are dressed for and what stands on the common. */
  const describe = () => `${grids.length} cattle grids, ${M.flushes.length} flushes, ${moor.outcrops.length} outcrops, ${M.peat.length} peat banks; plants dressed for ${shown ? MONTHS[shown.month] : 'no date yet'}`;
  return { group, hedgeSwap: new HedgeSwap(near, far), setDate, describe, get month() { return shown?.month ?? 0; }, grids, plants };
}
