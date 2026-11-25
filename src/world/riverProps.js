// What stands in the riverside meadow (world/river.js): the white posts that mark the crossing, the sheep hurdle that shuts the river in at the
// meadow's east end, reeds along both banks, willows leaning over the water and the farm's oaks in the corners. All procedural but the oaks.
// On the new farm (#999) also the crossing's gravel up its landings, its ruts and loose stones, rushes and sedge at the wet edges, the meadow's tussocks,
// thistles, docks and cowpats, and the brook's reeds and stock fence to the lane's verge, placed by riverPlaces.js and drawn from riverPlants.js.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { worldBox, canvasTexture } from './outbuildingProps.js';
import { matrixAt } from './hillProps.js';
import { createRiver } from './river.js';
import { gateLeaf } from './neighbourFarmProps.js';
import { swayMaterials } from '../effects/windSway.js';
import { riversidePlaces } from './riverPlaces.js';
import { plantMaterial, reedModel, rushModel, sedgeModel, tussockModel, thistleModel, dockModel, cowpatModel, stoneModel } from './riverPlants.js';
import { wireFenceMaterials, wireFenceRun } from './wireFence.js';
import { Parts } from './parts.js';
import { streamFor } from './propStreams.js';

const paint = (geo, hex) => {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(a, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
};
const part = (geo, x, y, z, hex) => paint(geo.translate(x, y, z), hex);

/** One marker post `h` m tall from its foot: white-painted timber, a red band near the top and a small cap. */
function postGeometry(h) {
  return mergeGeometries([
    part(new THREE.BoxGeometry(0.13, h, 0.13), 0, h / 2, 0, '#e8e5da'),
    part(new THREE.BoxGeometry(0.145, 0.2, 0.145), 0, h - 0.3, 0, '#a8321f'),
    part(new THREE.BoxGeometry(0.138, 0.1, 0.138), 0, h - 0.52, 0, '#f2f0e0'), // the reflective band, so the posts show in the headlamps
    part(new THREE.BoxGeometry(0.17, 0.04, 0.17), 0, h + 0.02, 0, '#cfc9b8'),
  ].map((g) => g.toNonIndexed()));
}

/** A weeping willow: a leaning trunk, a ragged pale crown and a skirt of long thin curtains hanging from it almost to the ground. */
export function willowGeometry(random, { trunk = true } = {}) {
  const parts = [];
  if (trunk) parts.push(part(new THREE.CylinderGeometry(0.16, 0.36, 3, 7).rotateZ(0.08), 0, 1.5, 0, '#5b4b3a'));
  for (const [x, y, z, r] of [[0, 3.6, 0, 1.2], [0.9, 3.3, 0.3, 0.9], [-0.8, 3.2, -0.4, 1], [0.1, 3.4, -1, 0.8]]) {
    const lump = new THREE.IcosahedronGeometry(r, 1);
    lump.scale(1.2, 0.65, 1.2);
    parts.push(part(lump, x, y, z, '#86a14e'));
  }
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2 + random() * 0.1;
    const r = 1.1 + random() * 1.1;
    const len = 2 + random() * 1.4;
    const g = new THREE.BoxGeometry(0.14, len, 0.03);
    g.rotateX(0.08 + random() * 0.12);
    g.rotateY(-a);
    g.translate(Math.cos(a) * r, 3.35 - len / 2, Math.sin(a) * r);
    parts.push(paint(g, ['#9db65c', '#8aa84d', '#a9bf66'][Math.floor(random() * 3)]));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/** A pollarded willow: a short thick trunk with a knobbled head and a brush of straight shoots, the way the banks' willows are cut every few years. */
export function pollardGeometry(random) {
  const parts = [part(new THREE.CylinderGeometry(0.3, 0.42, 1.9, 8).rotateZ(0.05), 0, 0.95, 0, '#5b4b3a'), part(new THREE.IcosahedronGeometry(0.5, 1).scale(1.1, 0.8, 1.1), 0, 1.95, 0, '#4b3f31')];
  for (let i = 0; i < 26; i++) {
    const a = random() * Math.PI * 2;
    const len = 1.1 + random() * 0.9;
    const g = new THREE.CylinderGeometry(0.015, 0.04, len, 4);
    g.rotateZ(0.15 + random() * 0.5);
    g.rotateY(-a);
    g.translate(Math.cos(a) * 0.3, 2 + len / 2 * 0.9, Math.sin(a) * 0.3);
    parts.push(paint(g, ['#8f9a52', '#7a8a45', '#a08a4a'][Math.floor(random() * 3)]));
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/**
 * A reed or rush clump: a fan of thin blades `height` m tall that bow over, some with a brown seed head, a few dead bent stalks in straw colour
 * (`seeds`, 0..1, how many blades carry a head; `dead`, how many stalks are dead). Three heights are made, so a drift is not one clump over and over.
 */
export function reedGeometry(random, { height = 1.6, blades = 14, seeds = 0.5, dead = 2 } = {}) {
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const isDead = i < dead;
    const h = height * (isDead ? 0.6 + random() * 0.25 : 0.7 + random() * 0.4);
    const bow = (isDead ? 0.5 : 0.1) + random() * 0.25;
    const a = random() * Math.PI * 2;
    const r = random() * 0.18;
    const colour = isDead ? '#b5a06a' : ['#6f8a3c', '#5f7d34', '#7e9446', '#8c9a4e'][Math.floor(random() * 4)];
    const g = new THREE.BoxGeometry(0.035, h, 0.008);
    g.translate(0, h / 2, 0);
    g.rotateZ(bow);
    g.rotateY(-a);
    g.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
    parts.push(paint(g, colour));
    if (!isDead && random() < seeds) {
      const head = new THREE.BoxGeometry(0.045, 0.2, 0.045);
      head.translate(0, h + 0.08, 0);
      head.rotateZ(bow * 1.1);
      head.rotateY(-a);
      head.translate(Math.cos(a) * r, 0, Math.sin(a) * r);
      parts.push(paint(head, '#5a3f26'));
    }
  }
  return mergeGeometries(parts.map((g) => g.toNonIndexed()));
}

/** Pebbles and sand speckled over transparent: the pale gravel the shallows are laid with, showing through the water. */
function gravelTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  // Grey-brown and buff, smaller and closer than they were (#999: up the landings in the sun the old ones read as white blotches).
  for (let i = 0; i < 1300; i++) {
    const l = 105 + Math.floor(random() * 60);
    g.fillStyle = `rgba(${l + 16},${l + 8},${l - 8},${0.55 + random() * 0.4})`;
    g.beginPath();
    g.ellipse(random() * 128, random() * 128, 0.7 + random() * 1.7, 0.6 + random() * 1.2, random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** A tyre rut's texture: dark wet mud with soft edges, the tread's chevrons pressed into it and a little water standing in the bottom. */
function rutTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(48,36,24,0)');
    grad.addColorStop(0.22, 'rgba(48,36,24,0.85)');
    grad.addColorStop(0.5, 'rgba(34,26,18,0.95)');
    grad.addColorStop(0.78, 'rgba(48,36,24,0.85)');
    grad.addColorStop(1, 'rgba(48,36,24,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(20,15,10,0.55)';
    g.lineWidth = 3;
    for (let y = 0; y < h; y += 16) {
      g.beginPath();
      g.moveTo(w * 0.24, y);
      g.lineTo(w * 0.5, y + 7);
      g.lineTo(w * 0.76, y);
      g.stroke();
    }
    g.fillStyle = 'rgba(120,130,135,0.25)'; // the sheen of water lying in the bottom
    g.fillRect(w * 0.44, 0, w * 0.12, h);
  });
}

/** The crossing's two ruts (riverPlaces.js `ruts`): strips laid on the ground and the bed from the top of the north landing to the top of the south one. */
function rutMesh(ruts, heights) {
  const pos = [];
  const uv = [];
  const index = [];
  for (const r of ruts) {
    const base = pos.length / 3;
    const n = Math.ceil((r.to - r.from) / 0.4);
    for (let i = 0; i <= n; i++) {
      const z = r.from + ((r.to - r.from) * i) / n;
      const wobble = Math.sin(z * 0.7) * 0.06; // a wheel's track is never quite straight
      for (const side of [-1, 1]) {
        const x = r.x + wobble + (side * r.width) / 2;
        pos.push(x, heights.heightAt(x, z) + 0.015, z);
        uv.push(side < 0 ? 0 : 1, z / 1.6);
      }
      if (i < n) {
        const a = base + i * 2;
        index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: rutTexture(), roughness: 0.95, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, side: THREE.DoubleSide }));
  mesh.name = 'ruts';
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * The new farm's wet edges, meadow and brook (#999), from `riverPlaces.js`: rushes and sedge, loose stones at the crossing, the meadow's tussocks,
 * thistles, docks and cowpats through `tiledInstances` with the draw distance, and the stock fence along the brook (wireFence.js), a set piece of its own.
 */
function buildRiversideCover({ scene, heights, drawDistance, fixedBox }, places, material) {
  const random = streamFor('riversideModels');
  const tint = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  const kinds = [
    ['rushes', rushModel(random), places.rushes, () => tint(0.22, 0.1 + random() * 0.15, 0.75 + random() * 0.2), 0.02],
    ['sedge', sedgeModel(random), places.sedge, () => tint(0.17 + random() * 0.04, 0.15 + random() * 0.2, 0.78 + random() * 0.17), 0.02],
    ['meadowTussocks', tussockModel(random), places.tussocks, () => tint(0.18 + random() * 0.05, 0.1 + random() * 0.2, 0.72 + random() * 0.2), 0.02],
    ['thistles', thistleModel(random), places.thistles, () => tint(0.25, 0.05 + random() * 0.1, 0.8 + random() * 0.15), 0.01],
    ['docks', dockModel(random), places.docks, () => tint(0.22, 0.05 + random() * 0.1, 0.75 + random() * 0.2), 0.01],
    ['cowpats', cowpatModel(random), places.dung, () => tint(0.08, 0.1, 0.75 + random() * 0.25), 0.005],
  ];
  for (const [name, geo, spots, colour, sink] of kinds) {
    if (!spots.length) continue;
    const matrices = spots.map((p) => matrixAt(p.x, heights.heightAt(p.x, p.z) - sink, p.z, p.yaw, p.s, p.s * (0.85 + ((p.x * 7.3) % 0.3)), p.s));
    scene.add(drawDistance.add(tiledInstances(geo, material, matrices, { colors: spots.map(colour), name, tileSize: MODEL_TILE }), 'roughDistance'));
  }
  // The crossing's loose stones: grey-brown cobbles half sunk in the bed and the landings.
  const stones = places.stones.map((p) => matrixAt(p.x, heights.heightAt(p.x, p.z) - p.s * 0.25, p.z, p.yaw, p.s, p.s, p.s));
  const stoneColours = places.stones.map(() => tint(0.08 + random() * 0.04, 0.08 + random() * 0.1, 0.16 + random() * 0.14)); // lit by the sun these read a good deal paler
  scene.add(drawDistance.add(tiledInstances(stoneModel(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }), stones, { colors: stoneColours, name: 'crossingStones' }), 'roughDistance'));
  // The brook's stock fence, post and wire to the lane's verge.
  if (places.fence) {
    const parts = new Parts();
    const count = wireFenceRun({ parts, mats: wireFenceMaterials(random), points: places.fence.points, gaps: places.fence.gaps, groundY: (x, z) => heights.heightAt(x, z), fixedBox, random });
    const fence = parts.build({ castShadow: false });
    fence.name = 'brookFence';
    fence.userData.count = count;
    scene.add(fence);
  }
}

/** Builds the riverside meadow's props and their colliders. `c` is the props context (props.js). */
export function buildRiverside(c) {
  const { scene, models, layout, heights, physics, RAPIER, random, anchors, fixedBox, drawDistance, fields } = c;
  const river = createRiver(layout, heights.brook);
  if (!river) return null;
  const group = new THREE.Group();
  group.name = 'riverside';
  const solid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const surface = (x, z) => heights.heightAt(x, z) + heights.brook.waterDepthAt(x);

  // The crossing's posts: tops a metre or so above the water (or the bank), feet in the bed.
  const posts = [];
  for (const p of river.posts()) {
    const foot = heights.heightAt(p.x, p.z) - 0.25;
    const top = Math.max(surface(p.x, p.z), heights.heightAt(p.x, p.z)) + 1.2;
    const m = new THREE.Mesh(postGeometry(top - foot), solid);
    m.position.set(p.x, foot, p.z);
    m.rotation.y = random() * 0.4;
    m.castShadow = true;
    posts.push(m);
    group.add(m);
    physics.createCollider(RAPIER.ColliderDesc.cuboid(0.08, (top - foot) / 2, 0.08).setTranslation(p.x, foot + (top - foot) / 2, p.z));
  }

  // The river gates, wherever the river crosses a boundary: two stout posts, a rail across and boards hung from it by a chain's length that swing out
  // downstream in the current, so the water runs through and nothing rides out. Their fence either side is #696's.
  for (const h of river.hurdles(fields.gateways)) {
    const base = surface(h.x, h.z);
    const top = base + 1.25;
    const span = h.half * 2;
    const g = [];
    for (const sgn of [-1, 1]) {
      const z = h.z + sgn * h.half;
      const foot = Math.min(heights.heightAt(h.x, z), base) - 0.4;
      g.push(part(new THREE.BoxGeometry(0.26, top + 0.1 - foot, 0.26), h.x, foot + (top + 0.1 - foot) / 2, z, '#6e5a40'));
      g.push(part(new THREE.BoxGeometry(0.33, 0.06, 0.33), h.x, top + 0.13, z, '#4f4332'));
      g.push(part(new THREE.BoxGeometry(0.05, 0.22, 0.28), h.x - 0.15, top - 0.2, z, '#3b3d3f')); // the strap the rail bolts to
    }
    g.push(part(new THREE.BoxGeometry(0.12, 0.14, span), h.x, top, h.z, '#7d6849'));
    const n = Math.max(2, Math.round(span / 0.42));
    for (let i = 0; i < n; i++) {
      const z = h.z - h.half + 0.3 + (i * (span - 0.6)) / (n - 1);
      const len = 0.8 + random() * 0.3;
      const board = new THREE.BoxGeometry(0.03, len, 0.14);
      board.translate(0, -len / 2, 0);
      board.rotateZ(-(0.1 + random() * 0.15)); // swung out downstream, east
      g.push(paint(board.translate(h.x + 0.1, top - 0.08, z), ['#8a7455', '#7a6347', '#95805f'][Math.floor(random() * 3)]));
      g.push(part(new THREE.BoxGeometry(0.012, 0.1, 0.012), h.x + 0.1, top - 0.06, z, '#2f3133')); // the chain's last link
    }
    const gate = new THREE.Mesh(mergeGeometries(g.map((x) => x.toNonIndexed())), solid);
    gate.name = 'riverGate';
    gate.castShadow = true;
    group.add(gate);
    fixedBox(h.x, base + 0.3, h.z, 0.2, 1.8, h.half);
  }

  // The gateway from Hay Meadow (the plan's (420, 545)): two stout posts and a five-bar leaf hung open, standing clear of the way through.
  const gateway = (fields.gateways ?? []).find((w) => w.a === 'hay' && w.b === 'brook');
  if (gateway && layout.hill.riverside.gates) {
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a6a52, roughness: 0.95 });
    const iron = new THREE.MeshStandardMaterial({ color: 0x3b3d3f, roughness: 0.6, metalness: 0.5 });
    const cx0 = (gateway.pa.x + gateway.pb.x) / 2;
    const cz0 = (gateway.pa.z + gateway.pb.z) / 2;
    const nx = gateway.pb.x - gateway.pa.x;
    const nz = gateway.pb.z - gateway.pa.z;
    const nl = Math.hypot(nx, nz) || 1;
    const tx = -nz / nl;
    const tz = nx / nl;
    const half = (gateway.gap?.half ?? 2.5) + 0.25;
    for (const sgn of [-1, 1]) {
      const px = cx0 + tx * half * sgn;
      const pz = cz0 + tz * half * sgn;
      const foot = heights.heightAt(px, pz) - 0.4;
      const post = new THREE.Mesh(worldBox(0.28, 2.1, 0.28, 1), wood);
      post.position.set(px, foot + 1.05, pz);
      const cap = new THREE.Mesh(worldBox(0.34, 0.06, 0.34, 1), wood);
      cap.position.set(px, foot + 2.13, pz);
      group.add(post, cap);
      fixedBox(px, foot + 1.05, pz, 0.14, 1.05, 0.14);
    }
    const pivot = new THREE.Group();
    pivot.position.set(cx0 + tx * (half - 0.14), heights.heightAt(cx0 + tx * half, cz0 + tz * half) + 0.02, cz0 + tz * (half - 0.14));
    const leaf = gateLeaf(wood, iron, half * 1.8);
    pivot.rotation.y = Math.atan2(nx, nz) - 0.12; // hung open, lying along the way through's line, on the side of the post
    pivot.add(leaf);
    group.add(pivot);
  }

  // The gravel laid over the crossing, a hand's breadth under the surface: a strip across the river between the posts, its pebbles breaking it. With
  // shaped banks (#999) it runs on up both landings to the field, narrowing as it climbs, so it tapers into the banks rather than stopping on the grass.
  const cx = river.cross;
  const shaped = !!heights.brook.banks;
  const landing = shaped ? heights.brook.banks.landing : 0;
  const gx0 = cx.x - cx.half + 0.3;
  const gx1 = cx.x + cx.half - 0.3;
  const gpos = [];
  const guv = [];
  const gidx = [];
  const cols = 8;
  const half0 = heights.brook.halfAt(cx.x);
  const rowsAt = shaped ? Array.from({ length: Math.ceil((half0 * 2 + landing * 1.7) / 0.5) + 1 }, (_, i) => -(half0 + landing * 0.85) + i * 0.5) : [-(half0 + 0.5), half0 + 0.5];
  for (const dz of rowsAt) {
    // Up the landing the strip narrows to 3 m wide by the top, where the field takes over.
    const up = Math.max(0, Math.abs(dz) - half0) / Math.max(1, landing * 0.85);
    const w = (gx1 - gx0) / 2 * (1 - up * 0.62);
    for (let i = 0; i <= cols; i++) {
      const x = cx.x + (i / cols - 0.5) * 2 * w;
      const zc = heights.brook.zAt(x);
      const z = zc + dz;
      const y = surface(x, zc) - 0.03;
      gpos.push(x, Math.max(y, heights.heightAt(x, z) + 0.02), z);
      guv.push(x / 3, z / 3);
    }
  }
  for (let r = 0; r + 1 < rowsAt.length; r++) {
    for (let i = 0; i < cols; i++) {
      const a = r * (cols + 1) + i;
      const b = a + cols + 1;
      gidx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const ggeo = new THREE.BufferGeometry();
  ggeo.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
  ggeo.setAttribute('uv', new THREE.Float32BufferAttribute(guv, 2));
  ggeo.setIndex(gidx);
  ggeo.computeVertexNormals();
  const gravel = new THREE.Mesh(ggeo, new THREE.MeshStandardMaterial({ map: gravelTexture(random), roughness: 0.8, transparent: true, alphaTest: 0.2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  gravel.name = 'gravel';
  gravel.receiveShadow = true;
  group.add(gravel);
  const places = shaped ? riversidePlaces(layout, heights.brook, { roads: c.roads }) : null;
  if (places) group.add(rutMesh(places.ruts, heights));
  scene.add(group);

  // Reeds and rushes, built once for every wet edge: three heights of clump, tall in the shallows and shorter up the bank. The new farm's (#999) are
  // the textured reed (riverPlants.js), placed from their own stream so the farm's list of placed things has the same ones.
  const plants = places ? plantMaterial() : null;
  const kinds = layout.hill.riverside.gates
    ? { tall: { height: 1.9, blades: 16, seeds: 0.6, dead: 3 }, mid: { height: 1.45, blades: 14, seeds: 0.45, dead: 2 }, rush: { height: 0.95, blades: 12, seeds: 0.25, dead: 1 } }
    : { mid: { height: 1.6, blades: 8, seeds: 0, dead: 0 } };
  const reedSets = Object.fromEntries(Object.keys(kinds).map((k) => [k, { matrices: [], colors: [] }]));
  const reedRandom = places ? streamFor('riverReeds') : random;
  const tint = (h, s, l) => new THREE.Color().setHSL(h, s, l);
  const reedTint = () => (places ? tint(0.2 + reedRandom() * 0.05, 0.1 + reedRandom() * 0.15, 0.78 + reedRandom() * 0.17) : tint(0.2 + reedRandom() * 0.04, 0.2 + reedRandom() * 0.15, 0.5 + reedRandom() * 0.2));
  for (const r of [...river.reeds(reedRandom), ...(places?.brookReeds ?? [])]) {
    const set = reedSets[r.kind === 'bank' ? 'rush' : r.kind === 'shallow' ? (reedRandom() < 0.5 ? 'tall' : 'mid') : r.kind === 'tall' ? 'tall' : 'mid'] ?? reedSets.mid;
    const s = r.s ?? 0.8 + reedRandom() * 0.7;
    set.matrices.push(matrixAt(r.x, heights.heightAt(r.x, r.z) - 0.05, r.z, r.yaw ?? reedRandom() * 6.28, s, s * (0.8 + reedRandom() * 0.5), s));
    set.colors.push(reedTint());
  }
  const reedMaterial = plants ?? new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const [k, set] of Object.entries(reedSets)) {
    if (!set.matrices.length) continue;
    const geo = places ? reedModel(reedRandom, kinds[k]) : reedGeometry(random, kinds[k]);
    scene.add(drawDistance.add(tiledInstances(geo, reedMaterial, set.matrices, { colors: set.colors, name: `reeds-${k}`, tileSize: places ? MODEL_TILE : undefined }), 'roughDistance'));
  }
  if (places) buildRiversideCover(c, places, plants);

  // Willows in groups along both banks, a pollard among every few, and a big old crack willow beside the farm bridge's place; they lean in the wind.
  const willow = willowGeometry(random);
  const pollard = pollardGeometry(random);
  const trees = river.willows().map((w, i) => ({ ...w, pollard: i % 5 === 4, s: 1.1 + random() * 0.5 }));
  const crack = layout.hill.riverside.crackWillow;
  if (crack) trees.push({ x: crack[0], z: crack[1], pollard: false, s: 1.9 });
  const sets = { willow: [], pollard: [] };
  for (const w of trees) {
    const y = heights.heightAt(w.x, w.z);
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2 * w.s, 0.3 * w.s).setTranslation(w.x, y + 2 * w.s, w.z));
    anchors.push({ x: w.x, y, z: w.z, r: 0.3 * w.s });
    sets[w.pollard ? 'pollard' : 'willow'].push(matrixAt(w.x, y - 0.2, w.z, random() * 6.28, w.pollard ? 1 : w.s));
  }
  const crown = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  for (const [name, geo] of [['willows', willow], ['pollards', pollard]]) {
    const matrices = sets[name === 'willows' ? 'willow' : 'pollard'];
    if (!matrices.length) continue;
    scene.add(tiledInstances(geo, crown, matrices, { tileSize: MODEL_TILE, name }));
  }
  swayMaterials(new THREE.Mesh(new THREE.BufferGeometry(), crown), 'tree', 6); // the willows and pollards share one material, patched once
  const oaks = [[], []];
  for (const [x, z] of layout.hill.riverside.trees ?? []) {
    const s = 1.2 + random() * 0.6;
    oaks[random() < 0.5 ? 0 : 1].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z));
    anchors.push({ x, y: heights.heightAt(x, z), z, r: 0.32 * s });
  }
  c.scatter.oaks(models, oaks);
  return { river };
}
