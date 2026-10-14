// The things on the hill through the south gate (world/hill.js): the stream's water, gorse on the banks, bracken in the rough, tussocks all
// over, and the small wood on the west flank with oaks along the pasture's hedges. All procedural but the oaks and bushes, which are the
// farm's own models.

import * as THREE from 'three';
import { instanceModel, modelBounds } from './assets.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { buildElectricFence } from './electricFenceBuild.js';

const UP = new THREE.Vector3(0, 1, 0);

export function matrixAt(x, y, z, yaw, sx, sy = sx, sz = sx) {
  const q = new THREE.Quaternion().setFromAxisAngle(UP, yaw);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(sx, sy, sz));
}

/** Builds the hill's props and their colliders. `c` is the props context (props.js). */
export function buildHill(c) {
  const stream = buildStream(c);
  buildWood(c);
  buildGorse(c);
  buildBracken(c);
  buildTussocks(c);
  buildViewpoint(c);
  buildElectricFence(c);
  if (c.fields.hill.west) {
    buildPond(c, c.fields.hill, (x, z) => c.fields.hill.lineDistance(c.layout.hill.paddocks.west.track, x, z) < 3);
    buildMeadowTrees(c);
    buildWall(c);
    buildThorns(c);
  }
  return { stream };
}

/** Faint pale streaks along the stream, so the water's drift shows (the ribbon scrolls this across it). */
function flowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 32;
  const g = canvas.getContext('2d');
  g.fillStyle = '#808080';
  g.fillRect(0, 0, 128, 32);
  for (let i = 0; i < 26; i++) {
    const x = (i * 53) % 128;
    const y = (i * 29) % 32;
    g.fillStyle = `rgba(255,255,255,${0.12 + ((i * 7) % 5) * 0.04})`;
    g.fillRect(x, y, 14 + ((i * 11) % 22), 1.5);
    g.fillRect(x - 128, y, 14 + ((i * 11) % 22), 1.5);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const STREAM_CLEAR = new THREE.Color(0x35332a);
const STREAM_SPATE = new THREE.Color(0x5a4a34); // after rain it runs browner with the peat and mud it carries

/**
 * The stream's water: a ribbon along its line, level across, following the channel's fall along it, a little past the side hedges.
 * Returns the view: `update(dt, level, rise, flow)` lifts the surface by `rise` metres, browns it with `level` and drifts the streaks at `flow`.
 */
function buildStream({ scene, heights, fields }) {
  const hill = fields.hill;
  const p = hill.pasture;
  const xs = [];
  for (let x = p.minX - 3; x <= p.maxX + 3; x += 1) xs.push(x);
  const pos = [];
  const uv = [];
  const index = [];
  const base = [];
  for (const x of xs) {
    const z = hill.streamZ(x);
    const y = heights.heightAt(x, z) + hill.waterDepthAt(x);
    const half = hill.halfAt(x) * 0.95;
    pos.push(x, y, z - half, x, y, z + half);
    base.push(y);
    uv.push(x / 6, 0, x / 6, 1);
  }
  for (let i = 0; i < xs.length - 1; i++) {
    const a = i * 2;
    index.push(a, a + 1, a + 2, a + 2, a + 1, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  // Peaty, clear-ish moorland water: brown-green, glossy, the bed showing through.
  const map = flowTexture();
  const mat = new THREE.MeshStandardMaterial({ color: STREAM_CLEAR.clone(), map, roughness: 0.12, transparent: true, opacity: 0.86, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'stream';
  scene.add(mesh);
  let lastRise = 0;
  return {
    mesh,
    update(dt, level, rise, flow) {
      map.offset.x -= dt * 0.12 * flow;
      mat.color.copy(STREAM_CLEAR).lerp(STREAM_SPATE, level);
      mat.opacity = 0.86 + 0.1 * level;
      if (Math.abs(rise - lastRise) < 0.003) return;
      lastRise = rise;
      const attr = geo.getAttribute('position');
      for (let i = 0; i < base.length; i++) {
        attr.setY(i * 2, base[i] + rise);
        attr.setY(i * 2 + 1, base[i] + rise);
      }
      attr.needsUpdate = true;
    },
  };
}

/**
 * The small wood on the west flank: oaks of all sizes with bushes under them, trunks you can't ride through. And a few oaks standing in the
 * pasture's hedges, as old hedgerow trees do.
 */
function buildWood({ scene, models, layout, heights, fields, physics, RAPIER, random }) {
  const hill = fields.hill;
  const wood = layout.hill.wood;
  const spots = [];
  for (let tries = 0; spots.length < 34 && tries < 2000; tries++) {
    const x = wood.minX + random() * (wood.maxX - wood.minX);
    const z = wood.minZ + random() * (wood.maxZ - wood.minZ);
    // A ragged edge: fewer towards the pasture side.
    if ((x - wood.minX) / (wood.maxX - wood.minX) > 0.55 + 0.45 * random()) continue;
    if (spots.some(([sx, sz, ss]) => Math.hypot(sx - x, sz - z) < 4.5 + ss * 1.2)) continue;
    spots.push([x, z, 0.8 + random() * 1.1]);
  }
  // Hedgerow oaks along the pasture's far and side hedges.
  const p = hill.pasture;
  for (const x of [-48, -6, 22]) spots.push([x + (random() - 0.5) * 6, p.maxZ + 0.5, 1.3 + random() * 0.5]);
  spots.push([p.maxX + 0.5, 168 + random() * 8, 1.5], [p.maxX + 0.5, 190, 1.2]);

  const mats = [[], []];
  for (const [x, z, s] of spots) {
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z));
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]));
  scene.add(instanceModel(models.treeB.scene, mats[1]));

  // Hazel and holly under the oaks: the farm's bush, smaller.
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const bushes = [];
  for (let tries = 0; bushes.length < 60 && tries < 600; tries++) {
    const x = wood.minX + random() * (wood.maxX - wood.minX) * 0.8;
    const z = wood.minZ + random() * (wood.maxZ - wood.minZ);
    const s = (1.4 + random() * 1.4) / bushSize.y;
    bushes.push(matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * Math.PI * 2, s));
  }
  scene.add(instanceModel(models.bush.scene, bushes, { castShadow: false }));
}

/**
 * Gorse: dense, dark, spiny clumps flecked with yellow flower, on the steep banks (hill.gorseAt). Each clump is a few lumps stuck together,
 * with a short collider you bump off rather than ride through.
 */
function buildGorse({ scene, heights, fields, physics, RAPIER, random }) {
  const hill = fields.hill;
  const p = hill.pasture;
  const pos = [];
  const colors = [];
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + random();
    const r = k === 0 ? 0 : 0.3 + random() * 0.25;
    const geo = new THREE.IcosahedronGeometry(0.4 + random() * 0.2, 1);
    const g = geo.attributes.position;
    // Each lump's faces (three vertices at a time) all one colour: nearly black-green, the odd one yellow with flower.
    for (let i = 0; i < g.count; i += 3) {
      const flower = random() < 0.07;
      const v = random() * 0.04;
      const col = flower ? [0.78, 0.66, 0.08] : [0.07 + v, 0.13 + v, 0.05];
      for (let j = i; j < i + 3; j++) {
        const jitter = 0.85 + random() * 0.3;
        const lift = 0.45 + (k === 0 ? 0.25 : 0); // the middle lump stands taller
        pos.push(Math.cos(a) * r + g.getX(j) * jitter, lift + g.getY(j) * 1.1 * jitter, Math.sin(a) * r + g.getZ(j) * jitter);
        colors.push(...col);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const matrices = [];
  for (let tries = 0; matrices.length < 260 && tries < 30000; tries++) {
    const x = p.minX + random() * (p.maxX - p.minX);
    const z = p.minZ + random() * (p.maxZ - p.minZ);
    if (random() > hill.gorseAt(x, z)) continue;
    const s = 0.9 + random() * 1.1;
    const y = heights.heightAt(x, z) - 0.1;
    matrices.push(matrixAt(x, y, z, random() * Math.PI * 2, s * (1 + random() * 0.5), s, s * (1 + random() * 0.5)));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(0.35 * s, 0.7 * s).setTranslation(x, y + 0.35 * s, z));
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  scene.add(tiledInstances(geo, material, matrices, { tileSize: MODEL_TILE, castShadow: true, name: 'gorse' }));
}

/** A plant of fronds: each frond a curved, tapering strip, each face twice (once each way round) so it lights the same from both sides. */
export function frondGeometry(random, fronds, length, width, droop) {
  const pos = [];
  const colors = [];
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + random() * 0.8;
    const lean = 0.5 + random() * 0.5;
    const len = length * (0.75 + random() * 0.5);
    const segs = 4;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const out = len * t * lean;
      const up = len * (t * (1 - lean * 0.3) - droop * t * t);
      const w = width * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) * (1 - t * 0.6);
      pts.push({ x: Math.cos(yaw) * out, y: up, z: Math.sin(yaw) * out, sx: -Math.sin(yaw) * w, sz: Math.cos(yaw) * w, t });
    }
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const v = [
        [a.x - a.sx, a.y, a.z - a.sz, a.t],
        [a.x + a.sx, a.y, a.z + a.sz, a.t],
        [b.x + b.sx, b.y, b.z + b.sz, b.t],
        [b.x - b.sx, b.y, b.z - b.sz, b.t],
      ];
      for (const tri of [[0, 1, 2], [0, 2, 3], [0, 2, 1], [0, 3, 2]]) {
        for (const k of tri) {
          pos.push(v[k][0], v[k][1], v[k][2]);
          const t = v[k][3];
          colors.push(0.2 + t * 0.12, 0.34 + t * 0.12, 0.1 + t * 0.04);
        }
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const normals = geo.getAttribute('normal');
  for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0);
  return geo;
}

/** Bracken in thick patches over the rough (hill.brackenAt), knee to waist high, some turning russet. No collider: you ride through it. */
function buildBracken({ scene, heights, fields, random, drawDistance }) {
  const hill = fields.hill;
  const p = hill.pasture;
  const geo = frondGeometry(random, 4, 0.9, 0.16, 0.45);
  const count = 4500;
  const matrices = [];
  const colors = [];
  for (let tries = 0; matrices.length < count && tries < count * 12; tries++) {
    const x = p.minX + random() * (p.maxX - p.minX);
    const z = p.minZ + random() * (p.maxZ - p.minZ);
    if (random() > hill.brackenAt(x, z)) continue;
    const s = 0.7 + random() * 0.6;
    matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.03, z, random() * 6.28, s, s * (0.8 + random() * 0.4), s));
    // Most green; some turning, the way it does from late summer.
    const turning = random() < 0.25;
    const col = new THREE.Color();
    if (turning) col.setHSL(0.07 + random() * 0.03, 0.5, 0.5);
    else col.setHSL(0.23 + random() * 0.04, 0.35 + random() * 0.15, 0.5 + random() * 0.15);
    colors.push(col);
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors, name: 'bracken' }), 'roughDistance'));
}

/** Tussocks of long, coarse grass all over the pasture, the two fields beside the lane and along the lane's banks: rough grazing, never mown. */
function buildTussocks({ scene, heights, fields, random, drawDistance }) {
  const hill = fields.hill;
  const geo = frondGeometry(random, 9, 0.38, 0.025, 0.55);
  const count = 20000;
  const matrices = [];
  const colors = [];
  // Where they grow and how thick (the fields beside the lane are grazed a little closer).
  const areas = [{ r: hill.laneRect, k: 1, lane: true }, { r: hill.pasture, k: 1 }];
  if (hill.west) areas.push({ r: hill.west, k: 0.5 }, { r: hill.east, k: 0.5 });
  const weights = areas.map((a) => (a.r.maxX - a.r.minX) * (a.r.maxZ - a.r.minZ) * a.k);
  const total = weights.reduce((a, b) => a + b, 0);
  for (let tries = 0; matrices.length < count && tries < count * 4; tries++) {
    let pick = random() * total;
    let i = 0;
    while (i < areas.length - 1 && pick > weights[i]) pick -= weights[i++];
    const { r, lane: inLane } = areas[i];
    const x = r.minX + random() * (r.maxX - r.minX);
    const z = r.minZ + random() * (r.maxZ - r.minZ);
    if (heights.puddleAt(x, z) > 0 || heights.mudAt(x, z) > 0.2 || hill.inWood(x, z, 2)) continue;
    // In the lane, on the banks and up the middle between the wheel tracks, not in them.
    if (inLane) {
      const dx = Math.abs(x - hill.lane.x);
      if (dx > 0.3 && dx < 1.3) continue;
    }
    const s = 0.7 + random() * 0.8;
    matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.02, z, random() * 6.28, s, s * (0.7 + random() * 0.7), s));
    colors.push(new THREE.Color().setHSL(0.15 + random() * 0.07, 0.3 + random() * 0.2, 0.7 + random() * 0.3));
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors, name: 'tussocks' }), 'roughDistance'));
}

/**
 * A pond: its water a fan out to the edge of where the dished ground holds it, level, and reeds standing round the shore. `source` is the
 * hill or the wood (its `pond` and `waterAt`); `keepClear(x, z)` says where reeds mustn't grow (the way down to drink).
 */
export function buildPond({ scene, heights, random, drawDistance }, source, keepClear) {
  const hill = source;
  const pond = hill.pond;
  const level = heights.heightAt(pond.x, pond.z) + pond.water;
  const pos = [pond.x, level, pond.z];
  const index = [];
  const edge = [];
  const steps = 48;
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    // March out along this bearing to where the water runs out.
    let r = 0;
    while (r < 1.3 && hill.waterAt(pond.x + Math.cos(a) * r * pond.rx, pond.z + Math.sin(a) * r * pond.rz) > 0.05) r += 0.02;
    edge.push(r);
    pos.push(pond.x + Math.cos(a) * r * 0.97 * pond.rx, level, pond.z + Math.sin(a) * r * 0.97 * pond.rz);
  }
  for (let i = 0; i < steps; i++) index.push(0, 1 + ((i + 1) % steps), 1 + i);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ color: 0x35332a, roughness: 0.12, transparent: true, opacity: 0.86, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'pond';
  scene.add(mesh);

  // Reeds: tall, stiff clumps just in and just out of the water's edge, thinner on the track's side so there is a way down to drink.
  const reeds = frondGeometry(random, 6, 1.3, 0.035, 0.12);
  const matrices = [];
  const colors = [];
  for (let tries = 0; matrices.length < 260 && tries < 4000; tries++) {
    const i = Math.floor(random() * steps);
    const a = (i / steps) * Math.PI * 2;
    const r = edge[i] * (0.9 + random() * 0.45);
    const x = pond.x + Math.cos(a) * r * pond.rx;
    const z = pond.z + Math.sin(a) * r * pond.rz;
    if (keepClear(x, z)) continue;
    const s = 0.8 + random() * 0.6;
    matrices.push(matrixAt(x, heights.heightAt(x, z) - 0.05, z, random() * 6.28, s, s * (0.8 + random() * 0.6), s));
    colors.push(new THREE.Color().setHSL(0.17 + random() * 0.05, 0.3 + random() * 0.15, 0.3 + random() * 0.15));
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(drawDistance.add(tiledInstances(reeds, material, matrices, { colors, name: 'reeds' }), 'roughDistance'));
}

/** Oaks round the pond with hazel under them: the farm's models, trunks you cannot ride through. */
function buildMeadowTrees({ scene, models, layout, heights, physics, RAPIER, random }) {
  const west = layout.hill.paddocks.west;
  const mats = [[], []];
  for (const [x, z] of west.trees) {
    const s = 1.1 + random() * 0.6;
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z));
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]));
  scene.add(instanceModel(models.treeB.scene, mats[1]));
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const bushes = [];
  for (const [tx, tz] of west.trees) {
    if (random() < 0.4) continue;
    const x = tx + (random() - 0.5) * 6;
    const z = tz + (random() - 0.5) * 6;
    bushes.push(matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * Math.PI * 2, (1.4 + random() * 1.2) / bushSize.y));
  }
  scene.add(instanceModel(models.bush.scene, bushes, { castShadow: false }));
}

/** The drystone wall across the sheep field (layout.hill.paddocks.east.wall): three courses of grey stones and a capping row, a gap in it, a collider along each side. */
function buildWall({ scene, layout, heights, fixedBox, random }) {
  const w = layout.hill.paddocks.east.wall;
  if (!w) return;
  const spans = [[w.from, w.gap.at - w.gap.half], [w.gap.at + w.gap.half, w.to]];
  const stones = [];
  for (const [a, b] of spans) {
    for (let x = a; x < b; x += 0.45 + random() * 0.15) {
      const ground = heights.heightAt(x, w.z);
      for (let course = 0; course < 3; course++) {
        const y = ground + 0.18 + course * 0.28;
        stones.push(matrixAt(x + (random() - 0.5) * 0.1, y, w.z + (random() - 0.5) * 0.12, random() * 0.3, 0.3 + random() * 0.12, 0.15 + random() * 0.05, 0.22 + random() * 0.06));
      }
      // The top: flat capstones, set on edge now and then.
      stones.push(matrixAt(x, ground + w.height - 0.02, w.z, (random() - 0.5) * 0.4, 0.34 + random() * 0.1, 0.12 + random() * 0.08, 0.26));
    }
    // A collider a few metres at a time, following the ground.
    const pieces = Math.max(1, Math.ceil((b - a) / 3));
    for (let k = 0; k < pieces; k++) {
      const pa = a + ((b - a) * k) / pieces;
      const pb = a + ((b - a) * (k + 1)) / pieces;
      let top = -Infinity;
      for (let x = pa; x <= pb + 1e-6; x += 1) top = Math.max(top, heights.heightAt(x, w.z));
      fixedBox((pa + pb) / 2, top + w.height / 2 - 0.2, w.z, (pb - pa) / 2, w.height / 2 + 0.2, 0.25);
    }
  }
  const mesh = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, flatShading: true }),
    stones.length,
  );
  const col = new THREE.Color();
  stones.forEach((m, i) => {
    mesh.setMatrixAt(i, m);
    col.setHSL(0.1 + random() * 0.05, 0.05 + random() * 0.08, 0.2 + random() * 0.14); // the material is lit white, so this reads as weathered grey
    mesh.setColorAt(i, col);
  });
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'drystone wall';
  scene.add(mesh);
}

/** Thorn bushes in the sheep field: the farm's bush, big, with a trunk's worth of collider. */
function buildThorns({ scene, models, layout, heights, physics, RAPIER, random }) {
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const mats = [];
  for (const [x, z] of layout.hill.paddocks.east.thorns) {
    const h = 2.4 + random() * 1.2;
    const y = heights.heightAt(x, z);
    mats.push(matrixAt(x, y - 0.25, z, random() * Math.PI * 2, h / bushSize.y));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(h * 0.4, h * 0.22).setTranslation(x, y + h * 0.4, z));
  }
  scene.add(instanceModel(models.bush.scene, mats));
}

/** The flat rock at the top of the pasture (layout.hill.viewpoint) where the girls sit with the flask: a squat grey boulder with a smaller one by it. */
function buildViewpoint({ scene, layout, heights, physics, RAPIER }) {
  const v = layout.hill.viewpoint;
  if (!v) return;
  const ground = heights.heightAt(v.x, v.z);
  const mat = new THREE.MeshStandardMaterial({ color: 0x8a877d, roughness: 0.95, flatShading: true });
  const group = new THREE.Group();
  group.name = 'viewpoint';
  group.position.set(v.x, ground, v.z);
  group.rotation.y = v.yaw;
  const lump = (rx, ry, rz, x, y, z, detail) => {
    const m = new THREE.Mesh(new THREE.IcosahedronGeometry(1, detail), mat);
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  };
  // The seat: a wide flat-topped lump whose top is at `height` (the scale squashes it, the lower half sunk in the grass).
  lump(0.75, v.height, 0.5, 0, 0, 0, 1);
  lump(0.35, 0.22, 0.3, 0.95, -0.02, 0.15, 0);
  lump(0.28, 0.16, 0.25, -0.9, -0.02, -0.2, 0);
  scene.add(group);
  physics.createCollider(RAPIER.ColliderDesc.cuboid(0.7, v.height / 2, 0.45).setTranslation(v.x, ground + v.height / 2, v.z).setRotation({ x: 0, y: Math.sin(v.yaw / 2), z: 0, w: Math.cos(v.yaw / 2) }));
}
