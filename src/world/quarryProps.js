// The things in and round the gravel pit (world/quarry.js): a tumbledown post-and-wire fence round the lip with its danger signs, the site's
// steel container, an old excavator left on the floor and a screening plant (a hopper over a conveyor, delivering onto a heap), drums and
// tyres by the pond, hawthorn and gorse along the lip, boulders and flints fallen from the walls, dead trees, and the pond with its reeds.
// All procedural, with canvas textures; the big pieces have colliders. The ground itself (the walls, the heaps, the road) is the terrain's.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanceModel, modelBounds, enableShadows } from './assets.js';
import { matrixAt, buildPond, gorseGeometry } from './hillProps.js';
import { canvasTexture, corrugatedTexture, worldBox } from './outbuildingProps.js';
import { barrelTexture, woodTexture } from './neighbourTextures.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { quarryPlants } from './quarry.js';

const TAU = Math.PI * 2;

/** Builds the pit's props and their colliders. `c` is the props context (props.js). */
export function buildQuarry(c) {
  const quarry = c.fields.quarry;
  const plants = quarryPlants(quarry, c.random);
  buildScrub(c, quarry, plants);
  buildBoulders(c, quarry, plants);
  buildSite(c, quarry);
  buildPond(c, quarry, () => false);
}

/** A rusty steel plate texture, one tile 2 m square: orange and brown blotches, streaks, and the odd pale patch of old paint. */
function rustTexture(random, base = '#7a4a30') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 8 + random() * 40;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = random() < 0.5 ? '150,78,34' : random() < 0.5 ? '70,38,24' : '176,120,64';
      g.addColorStop(0, `rgba(${col},0.4)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      const x = random() * w;
      const y = random() * h * 0.6;
      const len = 20 + random() * 120;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(90,40,18,0.5)');
      g.addColorStop(1, 'rgba(90,40,18,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 5, len);
    }
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = 'rgba(190,170,110,0.28)';
      ctx.fillRect(random() * w, random() * h, 10 + random() * 40, 6 + random() * 24);
    }
  });
}

/** A faded paint-and-rust texture for the excavator's body: `colour` worn through to the rust in streaks and edges, dirt low down. */
function diggerTexture(random, colour) {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = colour;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = random() * w;
      const y = random() * h;
      const r = 20 + random() * 60;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const col = random() < 0.5 ? '120,64,30' : random() < 0.5 ? '70,56,40' : '214,186,96';
      g.addColorStop(0, `rgba(${col},${0.1 + random() * 0.14})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 40; i++) {
      const x = random() * w;
      const y = random() * h * 0.7;
      const len = 14 + random() * 90;
      const g = ctx.createLinearGradient(0, y, 0, y + len);
      g.addColorStop(0, 'rgba(110,52,22,0.45)');
      g.addColorStop(1, 'rgba(110,52,22,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, 1 + random() * 4, len);
    }
    ctx.strokeStyle = 'rgba(100,48,20,0.55)';
    ctx.lineWidth = 6;
    ctx.strokeRect(0, 0, w, h);
    const dirt = ctx.createLinearGradient(0, h * 0.6, 0, h);
    dirt.addColorStop(0, 'rgba(120,100,70,0)');
    dirt.addColorStop(1, 'rgba(120,100,70,0.5)');
    ctx.fillStyle = dirt;
    ctx.fillRect(0, h * 0.6, w, h * 0.4);
  });
}

/** A hazard sign: black on yellow, a heading and up to three lines, readable on a flat face. */
function signTexture(heading, lines, { bg = '#e8c52a', fg = '#1a1a1a' } = {}) {
  return canvasTexture(512, 360, (ctx, w, h) => {
    ctx.fillStyle = '#d9d6cb';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = bg;
    ctx.fillRect(14, 14, w - 28, h - 28);
    ctx.strokeStyle = fg;
    ctx.lineWidth = 8;
    ctx.strokeRect(24, 24, w - 48, h - 48);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.font = 'bold 70px Arial, Helvetica, sans-serif';
    ctx.fillText(heading, w / 2, 108);
    ctx.font = 'bold 40px Arial, Helvetica, sans-serif';
    lines.forEach((l, i) => ctx.fillText(l, w / 2, 176 + i * 52));
    // Weathering and a bullet hole or two.
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(80,60,30,${0.05 + Math.random() * 0.12})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 3 + Math.random() * 30, 3 + Math.random() * 6);
    }
  });
}

/** Collects boxes, tubes and the like per material and builds one merged mesh each, so a whole machine is a few draw calls. */
class Parts {
  constructor() {
    this.byMaterial = new Map();
  }

  /** Adds `geo` (a fresh geometry) in `material`, placed by position and the Euler rotation (x, y, z) in radians. */
  add(material, geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
    if (!this.byMaterial.has(material)) this.byMaterial.set(material, []);
    this.byMaterial.get(material).push(geo);
    return this;
  }

  box(material, w, h, d, x, y, z, ry = 0, tile = 2) {
    return this.add(material, worldBox(w, h, d, tile), x, y, z, 0, ry, 0);
  }

  /** A beam from a to b (in the x-y plane, at depth z), `h` thick, `d` wide. */
  beam(material, ax, ay, bx, by, h, d, z = 0, tile = 2) {
    const len = Math.hypot(bx - ax, by - ay);
    return this.add(material, worldBox(len, h, d, tile), (ax + bx) / 2, (ay + by) / 2, z, 0, 0, Math.atan2(by - ay, bx - ax));
  }

  /** A cylinder with its axis along z (a wheel, a roller, a pin). */
  wheel(material, r, width, x, y, z, segments = 14) {
    return this.add(material, new THREE.CylinderGeometry(r, r, width, segments), x, y, z, Math.PI / 2, 0, 0);
  }

  /** The parts as a group of meshes, one per material. */
  build({ castShadow = true } = {}) {
    const group = new THREE.Group();
    for (const [material, geos] of this.byMaterial) {
      const mesh = new THREE.Mesh(mergeGeometries(geos, false), material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    return group;
  }
}

/** The pit's own deal of a random stream: a spot on the floor or the rim, found by trying. */
function findSpot(tries, ok, pick) {
  for (let i = 0; i < tries; i++) {
    const p = pick();
    if (ok(p)) return p;
  }
  return null;
}

/** Hawthorn and gorse along the lip and over the field, and a few oaks standing in the rough. */
function buildScrub(c, quarry, plants) {
  const { scene, models, heights, physics, RAPIER, random, anchors } = c;
  const bushSize = modelBounds(models.bush.scene).getSize(new THREE.Vector3());
  const hawthorn = [];
  const gorse = [];
  for (const [x, z, s] of plants.bushes) {
    if (random() < 0.5) hawthorn.push(matrixAt(x, heights.heightAt(x, z) - 0.2, z, random() * TAU, (1.5 + s * 1.2) / bushSize.y));
    else gorse.push(matrixAt(x, heights.heightAt(x, z) - 0.1, z, random() * TAU, s * (1 + random() * 0.5), s, s * (1 + random() * 0.5)));
  }
  scene.add(instanceModel(models.bush.scene, hawthorn, { castShadow: false }));
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  scene.add(tiledInstances(gorseGeometry(random), material, gorse, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryGorse' }));
  const mats = [[], []];
  for (const [x, z, s] of plants.trees) {
    const y = heights.heightAt(x, z);
    mats[random() < 0.5 ? 0 : 1].push(matrixAt(x, y - 0.15, z, random() * TAU, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, y + 2.5 * s, z));
    anchors.push({ x, y, z, r: 0.32 * s });
  }
  scene.add(instanceModel(models.treeA.scene, mats[0]));
  scene.add(instanceModel(models.treeB.scene, mats[1]));
}

/** A rock: a rough, flat-shaded lump with a flat-ish base, its faces tinted buff, grey or orange-brown. */
function rockGeometry(random) {
  const geo = new THREE.IcosahedronGeometry(0.5, 2);
  const p = geo.attributes.position;
  const colors = new Float32Array(p.count * 3);
  const tint = [[0.42, 0.39, 0.34], [0.34, 0.33, 0.32], [0.5, 0.38, 0.26], [0.5, 0.47, 0.4]][Math.floor(random() * 4)];
  for (let i = 0; i < p.count; i += 3) {
    const j = 0.8 + random() * 0.4;
    const v = 0.9 + random() * 0.2;
    for (let k = i; k < i + 3; k++) {
      const jitter = 0.84 + ((((Math.sin(p.getX(k) * 12.9 + p.getY(k) * 78.2 + p.getZ(k) * 37.7) * 43758.5453) % 1) + 1) % 1) * 0.3;
      p.setXYZ(k, p.getX(k) * jitter * j, Math.max(p.getY(k) * jitter, -0.18), p.getZ(k) * jitter * j);
      colors.set([tint[0] * v, tint[1] * v, tint[2] * v], k * 3);
    }
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

/** Boulders and flints fallen to the foot of the walls and strewn down the chutes, and a few big ones on the floor you ride round. */
function buildBoulders(c, quarry, plants) {
  const { scene, heights, random, fixedBox, drawDistance } = c;
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const stones = [];
  for (const [x, z, size] of plants.boulders) {
    stones.push(matrixAt(x, heights.heightAt(x, z) + size * 0.1, z, random() * TAU, size * (1.1 + random() * 0.5), size * (0.6 + random() * 0.5), size * (1 + random() * 0.4)));
  }
  for (let i = 0; i < 3; i++) {
    const geo = rockGeometry(random);
    const mine = stones.filter((_, k) => k % 3 === i);
    scene.add(drawDistance.add(tiledInstances(geo, material, mine, { castShadow: true, name: 'quarryStones' }), 'roughDistance'));
  }
  const bigGeo = rockGeometry(random);
  const bigs = plants.big.map(([x, z, size]) => {
    const s = size * 1.7;
    const y = heights.heightAt(x, z);
    const yaw = random() * TAU;
    fixedBox(x, y + s * 0.2, z, s * 0.4, s * 0.25, s * 0.4, yaw);
    return matrixAt(x, y + s * 0.05, z, yaw, s * 1.15, s * 0.8, s);
  });
  scene.add(tiledInstances(bigGeo, material, bigs, { tileSize: MODEL_TILE, castShadow: true, name: 'quarryBoulders' }));
}

/** Everything standing in and round the pit that isn't a plant or a stone, as one set piece (`quarrySite`, far-detail trimmed by distance). */
function buildSite(c, quarry) {
  const { scene, heights, random, fixedBox } = c;
  const site = new THREE.Group();
  site.name = 'quarrySite';
  const lit = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, ...o });
  const wood = new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 74]), roughness: 0.95 });
  const wire = lit({ color: 0x7d8286, metalness: 0.5, roughness: 0.5 });
  const rust = lit({ map: rustTexture(random), roughness: 0.9 });
  const rustDark = lit({ map: rustTexture(random, '#5b3a2a'), roughness: 0.9 });
  const tyreMat = lit({ color: 0x1c1c1b, roughness: 0.95 });
  const dark = lit({ color: 0x252422, roughness: 0.9 });
  const glass = lit({ color: 0x1f2a2c, roughness: 0.2, metalness: 0.2 });
  const yellow = lit({ map: diggerTexture(random, '#b69a34'), roughness: 0.8 });
  const orange = lit({ map: diggerTexture(random, '#a85a28'), roughness: 0.8 });
  const green = lit({ map: corrugatedTexture(random, '#58695c', 0.85), roughness: 0.75 });
  const groundY = (x, z) => heights.heightAt(x, z);
  const floorAt = (a, back) => quarry.frameAt(a, quarry.floorEdge(a) - back);

  buildFence(site, quarry, { wood, wire, groundY, random });

  // The steel container: the site's store, in the field a little off the gate, doors at one end, a padlock bar, a dent or two.
  const gate = quarry.gate;
  const hut = findSpot(400, (p) => quarry.plantOk(p.x, p.z, 8) && Math.hypot(p.x - gate.x, p.z - quarry.rect.maxZ) > 14, () => ({ x: gate.x - 10 - random() * 24, z: quarry.rect.maxZ - 12 - random() * 14 })) ?? { x: gate.x - 18, z: quarry.rect.maxZ - 18 };
  const hutYaw = (random() - 0.5) * 0.7;
  {
    const parts = new Parts();
    const L = 6.06;
    const W = 2.44;
    const H = 2.59;
    const y0 = Math.max(groundY(hut.x - 3, hut.z), groundY(hut.x + 3, hut.z)) + 0.02;
    parts.box(green, L, H - 0.18, W, 0, 0.18 + (H - 0.18) / 2, 0, 0, 1.2);
    parts.box(dark, L + 0.1, 0.18, W + 0.1, 0, 0.09, 0); // the base rails
    parts.box(rust, L + 0.06, 0.07, W + 0.06, 0, H + 0.02, 0, 0, 1.6); // the rusty roof lip
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.box(dark, 0.16, 0.16, 0.16, sx * (L / 2 - 0.05), 0.1, sz * (W / 2 - 0.05)); // corner posts
    // Doors on the +x end: two leaves, four locking bars, the padlock.
    for (const sz of [-1, 1]) parts.box(rust, 0.05, H - 0.4, W / 2 - 0.08, L / 2 + 0.01, 0.2 + (H - 0.4) / 2, sz * (W / 4), 0, 1.5);
    for (const sz of [-0.62, -0.2, 0.2, 0.62]) parts.box(dark, 0.07, H - 0.5, 0.05, L / 2 + 0.06, 0.2 + (H - 0.5) / 2, sz * (W / 2 - 0.1));
    parts.box(dark, 0.08, 0.1, 0.18, L / 2 + 0.1, 1.15, 0.08);
    const g = parts.build();
    g.position.set(hut.x, y0, hut.z);
    g.rotation.y = hutYaw;
    site.add(g);
    fixedBox(hut.x, y0 + H / 2, hut.z, L / 2, H / 2, W / 2, hutYaw);
  }

  // The excavator on the floor, where the road comes down, nose to the wall: tracks, house, counterweight, cab, boom, stick and bucket.
  const road = quarry.pit.road;
  const endA = road.from + road.dir * road.sweep;
  const dig = findSpot(300, (p) => !quarry.pit.heaps.some((m) => Math.hypot(m.x - p.x, m.z - p.z) < m.r + 4) && quarry.waterAt(p.x, p.z) === 0 && quarry.roadNear(p.x, p.z).d > 7, () => floorAt(endA + road.dir * (0.3 + random() * 0.4), 10 + random() * 6)) ?? floorAt(endA + road.dir * 0.5, 12);
  {
    const yaw = Math.atan2(quarry.pit.x - dig.x, quarry.pit.z - dig.z) + Math.PI + (random() - 0.5) * 0.6; // looks out at the wall it has been digging
    const parts = new Parts();
    for (const sz of [-1, 1]) {
      parts.box(dark, 3.9, 0.74, 0.8, 0, 0.45, sz * 1.0);
      for (let i = 0; i < 5; i++) {
        parts.wheel(dark, 0.28, 0.82, -1.4 + i * 0.7, 0.33, sz * 1.0);
        parts.wheel(rustDark, 0.12, 0.9, -1.4 + i * 0.7, 0.33, sz * 1.0, 8);
      }
      for (const sx of [-1.7, 1.7]) {
        parts.wheel(dark, 0.45, 0.82, sx, 0.55, sz * 1.0);
        parts.wheel(rustDark, 0.18, 0.9, sx, 0.55, sz * 1.0, 8);
      }
      for (let i = 0; i < 15; i++) parts.box(rustDark, 0.14, 0.05, 0.86, -1.8 + i * 0.26, 0.84, sz * 1.0);
    }
    parts.box(rustDark, 2.4, 0.4, 2.0, 0, 0.8, 0); // the undercarriage
    parts.box(yellow, 3.0, 0.9, 2.5, -0.3, 1.45, 0, 0, 1.5); // the house
    parts.box(orange, 1.0, 1.0, 2.5, -1.9, 1.5, 0, 0, 1.5); // the counterweight, rusty
    parts.box(yellow, 1.6, 0.5, 1.2, -0.2, 2.15, -0.6, 0, 1.5); // the engine hood
    parts.box(yellow, 1.35, 1.65, 1.15, 0.5, 2.25, 0.62, 0, 1.5); // the cab
    parts.box(glass, 0.05, 1.15, 0.95, 1.2, 2.45, 0.62); // its front glass
    parts.box(glass, 1.0, 1.0, 0.04, 0.5, 2.4, 1.21); // the side window
    parts.box(dark, 0.1, 0.9, 0.1, -0.1, 2.9, -0.9); // the exhaust
    // The boom, stick and bucket, from a pin on the front of the house, the bucket hanging down against the wall.
    const px = 1.35;
    const py = 1.45;
    const zz = -0.3;
    const kx = px + 3.7 * Math.cos(0.62);
    const ky = py + 3.7 * Math.sin(0.62);
    parts.beam(yellow, px, py, kx, ky, 0.55, 0.5, zz, 1.5);
    const sx = kx + 2.7 * Math.cos(-0.95);
    const sy = ky + 2.7 * Math.sin(-0.95);
    parts.beam(orange, kx, ky, sx, sy, 0.4, 0.36, zz, 1.5);
    parts.beam(dark, px + 1.0, py - 0.15, kx - 1.2, ky - 0.35, 0.16, 0.16, zz + 0.4); // the boom ram
    parts.beam(dark, kx - 0.2, ky - 0.05, sx - 0.5, sy + 0.6, 0.13, 0.13, zz + 0.4); // the stick ram
    parts.wheel(dark, 0.14, 0.7, kx, ky, zz);
    parts.wheel(dark, 0.14, 0.7, sx, sy, zz);
    parts.box(rustDark, 0.85, 0.12, 1.1, sx + 0.25, sy - 0.55, zz, 0, 1.5);
    parts.box(rustDark, 0.12, 0.7, 1.1, sx + 0.05, sy - 0.25, zz, 0, 1.5);
    parts.box(rustDark, 0.7, 0.55, 0.1, sx + 0.35, sy - 0.3, zz - 0.5, 0, 1.5);
    parts.box(rustDark, 0.7, 0.55, 0.1, sx + 0.35, sy - 0.3, zz + 0.5, 0, 1.5);
    for (let i = 0; i < 4; i++) parts.box(dark, 0.18, 0.1, 0.09, sx + 0.72, sy - 0.62, zz - 0.44 + i * 0.3);
    const g = parts.build();
    const y0 = Math.max(groundY(dig.x - 2, dig.z), groundY(dig.x + 2, dig.z)) - 0.02;
    g.position.set(dig.x, y0, dig.z);
    g.rotation.y = yaw - Math.PI / 2; // the machine looks along its +x
    site.add(g);
    // Colliders: the tracks and house as one box, the bucket hanging against the wall as another.
    const turn = yaw - Math.PI / 2;
    const at = (lx, lz) => ({ x: dig.x + Math.cos(turn) * lx + Math.sin(turn) * lz, z: dig.z - Math.sin(turn) * lx + Math.cos(turn) * lz });
    const body = at(0, 0);
    fixedBox(body.x, y0 + 1.5, body.z, 2.0, 1.5, 1.5, turn);
    const bucket = at(sx + 0.3, zz);
    fixedBox(bucket.x, y0 + 1.1, bucket.z, 0.7, 1.1, 0.6, turn);
  }

  // The screening plant by the biggest heap: a hopper on legs over a conveyor that climbs to drop onto the heap.
  const heap = [...quarry.pit.heaps].sort((a, b) => b.h - a.h)[0];
  if (heap) {
    const toward = Math.atan2(quarry.pit.x - heap.x, quarry.pit.z - heap.z);
    const yaw = toward + (random() < 0.5 ? 1 : -1) * (0.8 + random() * 0.6); // along the heap's flank, not at the middle of the floor
    const dx = Math.sin(yaw);
    const dz = Math.cos(yaw);
    const base = { x: heap.x + dx * (heap.r + 14), z: heap.z + dz * (heap.r + 14) };
    const ok = quarry.inPit(base.x, base.z) && quarry.waterAt(base.x, base.z) === 0;
    if (ok) buildPlant(site, c, { x: base.x, z: base.z, yaw: Math.atan2(-dx, -dz), length: heap.r + 11, groundY, rust, rustDark, dark, green, fixedBox, height: heap.h * 0.9 });
  }

  // Drums and tyres by the pond, a pallet and a broken trough.
  {
    const pond = quarry.pond;
    const barrelMat = lit({ map: barrelTexture(), roughness: 0.6, metalness: 0.2 });
    const rim = (r) => ({ x: pond.x + Math.cos(r) * pond.rx * 1.25, z: pond.z + Math.sin(r) * pond.rz * 1.25 });
    const dirToCentre = Math.atan2(quarry.pit.z - pond.z, quarry.pit.x - pond.x);
    const group = new THREE.Group();
    const placeAt = (p, fn) => {
      const y = groundY(p.x, p.z);
      const g = fn();
      g.position.set(p.x, y, p.z);
      return g;
    };
    for (let i = 0; i < 5; i++) {
      const p = rim(dirToCentre + (random() - 0.5) * 1.8);
      if (quarry.waterAt(p.x, p.z) > 0 || !quarry.inPit(p.x, p.z)) continue;
      const lying = random() < 0.4;
      const geo = new THREE.CylinderGeometry(0.29, 0.29, 0.88, 14);
      const g = new THREE.Mesh(geo, barrelMat);
      g.position.set(p.x, groundY(p.x, p.z) + (lying ? 0.3 : 0.44), p.z);
      if (lying) {
        g.rotation.z = Math.PI / 2;
        g.rotation.y = random() * TAU;
      }
      g.castShadow = true;
      group.add(g);
    }
    // A stack of tyres at the shore and a couple lying about.
    const stack = rim(dirToCentre + 0.5 + random() * 0.4);
    if (quarry.waterAt(stack.x, stack.z) === 0 && quarry.inPit(stack.x, stack.z)) {
      for (let i = 0; i < 4; i++) {
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.16, 8, 16), tyreMat);
        t.rotation.x = Math.PI / 2;
        t.position.set(stack.x + (random() - 0.5) * 0.12, groundY(stack.x, stack.z) + 0.16 + i * 0.3, stack.z + (random() - 0.5) * 0.12);
        t.castShadow = true;
        group.add(t);
      }
      fixedBox(stack.x, groundY(stack.x, stack.z) + 0.6, stack.z, 0.5, 0.6, 0.5);
    }
    for (let i = 0; i < 3; i++) {
      const p = rim(dirToCentre - 0.6 + random() * 1.4);
      if (quarry.waterAt(p.x, p.z) > 0 || !quarry.inPit(p.x, p.z)) continue;
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.17, 8, 16), tyreMat);
      t.rotation.x = Math.PI / 2 + (random() - 0.5) * 0.2;
      t.position.set(p.x, groundY(p.x, p.z) + 0.15, p.z);
      group.add(t);
    }
    // A pallet and an old cattle trough tipped on its side.
    const pal = rim(dirToCentre + 1.2);
    if (quarry.waterAt(pal.x, pal.z) === 0 && quarry.inPit(pal.x, pal.z)) {
      const g = placeAt(pal, () => {
        const pp = new Parts();
        for (let i = 0; i < 5; i++) pp.box(wood, 1.2, 0.025, 0.14, 0, 0.14, -0.4 + i * 0.2, 0, 1);
        for (const z of [-0.42, 0, 0.42]) pp.box(wood, 1.2, 0.09, 0.1, 0, 0.06, z, 0, 1);
        return pp.build();
      });
      g.rotation.y = random() * TAU;
      group.add(g);
    }
    group.traverse((o) => {
      if (o.isMesh) o.receiveShadow = true;
    });
    site.add(group);
  }

  // Dead trees leaning at the rim: a bare grey trunk with a couple of broken limbs.
  {
    const bark = lit({ color: 0x5d544a, roughness: 1 });
    const spots = [];
    for (let tries = 0; spots.length < 3 && tries < 200; tries++) {
      const a = random() * TAU;
      const p = quarry.frameAt(a, quarry.rimAt(a) + 4 + random() * 8);
      if (quarry.plantOk(p.x, p.z, 3) && !spots.some((s) => Math.hypot(s.x - p.x, s.z - p.z) < 14)) spots.push(p);
    }
    for (const p of spots) {
      const lean = (random() - 0.5) * 0.35;
      const h = 4 + random() * 2.5;
      const y = groundY(p.x, p.z);
      const local = new Parts();
      local.add(bark, new THREE.CylinderGeometry(0.1, 0.26, h, 7), 0, h / 2, 0, lean, 0, lean * 0.5);
      local.add(bark, new THREE.CylinderGeometry(0.04, 0.1, 1.8, 5), 0.5, h * 0.72, 0, 0, 0, -1.0);
      local.add(bark, new THREE.CylinderGeometry(0.03, 0.08, 1.4, 5), -0.4, h * 0.55, 0.2, 0.3, 0, 0.9);
      const g = local.build();
      g.position.set(p.x, y - 0.1, p.z);
      g.rotation.y = random() * TAU;
      site.add(g);
      fixedBox(p.x, y + 1.5, p.z, 0.25, 1.5, 0.25);
    }
  }

  enableShadows(site);
  site.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  scene.add(site);
  return site;
}

/** Posts every few metres round the lip, leaning, some gone, with two strands of wire between those that are left (some sagging to the ground), and the signs. */
function buildFence(site, quarry, { wood, wire, groundY, random }) {
  const parts = new Parts();
  const wires = new Parts();
  const posts = [];
  const N = 64;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + (random() - 0.5) * 0.04;
    const p = quarry.frameAt(a, quarry.rimAt(a) + 2.4);
    if (quarry.roadNear(p.x, p.z).d < quarry.roadHalf + 6) continue; // open where the road comes in
    posts.push({ ...p, a, gone: random() < 0.16, lean: (random() - 0.5) * 0.45, lean2: (random() - 0.5) * 0.3, h: 1.15 + random() * 0.3 });
  }
  for (const po of posts) {
    if (po.gone) continue;
    const y = groundY(po.x, po.z);
    parts.add(wood, new THREE.BoxGeometry(0.11, po.h, 0.11), po.x, y + po.h / 2 - 0.05, po.z, po.lean2, po.a, po.lean);
  }
  for (let i = 0; i < posts.length; i++) {
    const a = posts[i];
    const b = posts[(i + 1) % posts.length];
    if (a.gone || b.gone) continue;
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d > 9) continue;
    for (const k of [0.45, 0.85]) {
      const sag = random() < 0.12 ? 0.5 : 0.05;
      const ya = groundY(a.x, a.z) + a.h * k;
      const yb = groundY(b.x, b.z) + b.h * k;
      const heading = Math.atan2(b.x - a.x, b.z - a.z);
      wires.add(wire, new THREE.CylinderGeometry(0.008, 0.008, d, 4), (a.x + b.x) / 2, (ya + yb) / 2 - sag, (a.z + b.z) / 2, 0, heading - Math.PI / 2, Math.PI / 2);
    }
  }
  const fence = parts.build({ castShadow: false });
  const wireGroup = wires.build({ castShadow: false });
  fence.name = 'quarryFence';
  site.add(fence, wireGroup);

  // The signs: where the road comes in, over the pond, and one on the far side, each on a post of its own, leaning a little.
  const road = quarry.pit.road;
  const signs = [
    { a: road.from + road.dir * 0.35, back: 3.4, tex: signTexture('DANGER', ['UNSTABLE FACES', 'KEEP OUT']) },
    { a: Math.atan2(quarry.pond.z - quarry.pit.z, quarry.pond.x - quarry.pit.x) - quarry.pit.yaw, back: 3.4, tex: signTexture('DANGER', ['DEEP WATER', 'NO SWIMMING']) },
    { a: quarry.pit.steepAt + 1.25, back: 3.4, tex: signTexture('PRIVATE', ['GRAVEL PIT', 'NO TRESPASSING'], { bg: '#e9e5d6' }) },
  ];
  for (const sg of signs) {
    const p = quarry.frameAt(sg.a, quarry.rimAt(sg.a) + sg.back);
    const y = groundY(p.x, p.z);
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.9, 0.1), wood);
    pole.position.y = 0.9;
    g.add(pole);
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.63, 0.03), new THREE.MeshStandardMaterial({ map: sg.tex, roughness: 0.55 }));
    face.position.set(0, 1.55, 0.065);
    g.add(face);
    g.position.set(p.x, y - 0.1, p.z);
    g.rotation.set(0, Math.atan2(quarry.pit.x - p.x, quarry.pit.z - p.z) + Math.PI + (random() - 0.5) * 0.4, (random() - 0.5) * 0.12); // facing out from the pit
    site.add(g);
  }
}

/** A hopper on four legs over a conveyor that climbs 20 degrees to drop onto a heap: rusted steel, abandoned. `yaw` is the way the conveyor climbs. */
function buildPlant(site, c, { x, z, yaw, length, groundY, rust, rustDark, dark, green, fixedBox, height }) {
  const parts = new Parts();
  const y0 = groundY(x, z);
  const climb = Math.atan2(height + 1.6, length);
  const reach = Math.hypot(length, height + 1.6);
  // Local frame: the conveyor runs along +x from its tail under the hopper, rising by `climb`.
  const tail = { x: 0.4, y: 1.1 };
  const head = { x: tail.x + Math.cos(climb) * reach, y: tail.y + Math.sin(climb) * reach };
  parts.beam(rustDark, tail.x, tail.y, head.x, head.y, 0.14, 1.0, 0.5, 2); // the belt's frame, both sides
  parts.beam(rustDark, tail.x, tail.y, head.x, head.y, 0.14, 0.1, -0.5 + 0.5, 2);
  for (const sz of [-1, 1]) parts.beam(rust, tail.x, tail.y + 0.12, head.x, head.y + 0.12, 0.28, 0.07, sz * 0.5, 2); // the side plates
  parts.beam(dark, tail.x, tail.y + 0.05, head.x, head.y + 0.05, 0.05, 0.86, 0, 2); // the belt itself, black and cracked
  parts.wheel(rustDark, 0.2, 1.0, tail.x, tail.y, 0);
  parts.wheel(rustDark, 0.24, 1.0, head.x, head.y, 0);
  // Idlers every couple of metres.
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    parts.wheel(dark, 0.07, 0.9, tail.x + (head.x - tail.x) * t, tail.y + (head.y - tail.y) * t + 0.12, 0, 8);
  }
  // A-frame legs under it.
  for (const t of [0.34, 0.68, 0.98]) {
    const lx = tail.x + (head.x - tail.x) * t;
    const ly = tail.y + (head.y - tail.y) * t;
    for (const sz of [-0.6, 0.6]) {
      parts.box(rustDark, 0.12, ly - 0.05, 0.12, lx, (ly - 0.05) / 2, sz);
    }
    parts.box(rustDark, 0.1, 0.1, 1.3, lx, ly - 0.4, 0);
    parts.beam(rustDark, lx - 0.5, 0.05, lx, ly - 0.4, 0.08, 0.08, 0.6);
    parts.beam(rustDark, lx + 0.5, 0.05, lx, ly - 0.4, 0.08, 0.08, -0.6);
  }
  // The hopper: a box on top of a funnel, on four tall legs, a grating across the top and a chute into the belt's tail.
  const hx = tail.x;
  const hy = 2.7;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.box(rustDark, 0.16, hy - 0.2, 0.16, hx + sx * 1.2, (hy - 0.2) / 2, sz * 1.2);
  parts.box(rustDark, 2.6, 0.12, 0.12, hx, 1.9, 1.2);
  parts.box(rustDark, 2.6, 0.12, 0.12, hx, 1.9, -1.2);
  parts.box(rustDark, 0.12, 0.12, 2.6, hx - 1.2, 1.9, 0);
  parts.box(rustDark, 0.12, 0.12, 2.6, hx + 1.2, 1.9, 0);
  parts.add(rust, new THREE.CylinderGeometry(2.0, 0.5, 1.5, 4, 1, true), hx, hy + 0.3, 0, 0, Math.PI / 4, 0); // the funnel, open
  parts.add(rust, new THREE.CylinderGeometry(0.5, 0.5, 0.9, 4, 1, true), hx, hy - 0.8, 0, 0, Math.PI / 4, 0); // the throat
  parts.box(rust, 2.9, 0.55, 2.9, hx, hy + 1.3, 0, 0, 2); // the rim of the hopper
  for (let i = -3; i <= 3; i++) parts.box(rustDark, 0.05, 0.05, 2.8, hx + i * 0.38, hy + 1.6, 0); // the grating
  // A little control cabin on stilts at the side, with its door hanging open.
  parts.box(green, 1.5, 1.5, 1.6, hx + 0.3, 2.55, 3.4, 0, 1.2);
  parts.box(dark, 0.06, 1.1, 0.7, hx + 1.06, 2.45, 3.0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) parts.box(rustDark, 0.1, 1.8, 0.1, hx + 0.3 + sx * 0.6, 0.9, 3.4 + sz * 0.65);
  const g = parts.build();
  g.position.set(x, y0 - 0.02, z);
  g.rotation.y = yaw - Math.PI / 2; // the belt looks along its +x, which the yaw points
  site.add(g);
  // Colliders: the hopper's legs as one box, the belt's feet and its head.
  const local = (lx, lz) => {
    const a = g.rotation.y;
    return { x: x + Math.cos(a) * lx + Math.sin(a) * lz, z: z - Math.sin(a) * lx + Math.cos(a) * lz };
  };
  const hp = local(hx, 0);
  fixedBox(hp.x, y0 + 1.6, hp.z, 1.45, 1.6, 1.45, g.rotation.y);
  const head2 = local(head.x, 0);
  fixedBox(head2.x, y0 + head.y / 2, head2.z, 0.7, head.y / 2, 0.7, g.rotation.y);
  const mid = local((tail.x + head.x) / 2, 0);
  fixedBox(mid.x, y0 + 0.9, mid.z, 0.4, 0.9, 0.8, g.rotation.y);
}
