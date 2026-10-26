// What stands in the riverside meadow (world/river.js): the white posts that mark the crossing, the sheep hurdle that shuts the river in at the
// meadow's east end, reeds along both banks, willows leaning over the water and the farm's oaks in the corners. All procedural but the oaks.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { instanceModel } from './assets.js';
import { tiledInstances, MODEL_TILE } from './tiledInstances.js';
import { frondGeometry, matrixAt } from './hillProps.js';
import { createRiver } from './river.js';

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
    part(new THREE.BoxGeometry(0.17, 0.04, 0.17), 0, h + 0.02, 0, '#cfc9b8'),
  ].map((g) => g.toNonIndexed()));
}

/** A weeping willow: a leaning trunk, a ragged pale crown and a skirt of long thin curtains hanging from it almost to the ground. */
function willowGeometry(random) {
  const parts = [];
  parts.push(part(new THREE.CylinderGeometry(0.16, 0.36, 3, 7).rotateZ(0.08), 0, 1.5, 0, '#5b4b3a'));
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

/** Pebbles and sand speckled over transparent: the pale gravel the shallows are laid with, showing through the water. */
function gravelTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const g = canvas.getContext('2d');
  for (let i = 0; i < 700; i++) {
    const l = 150 + Math.floor(random() * 50);
    g.fillStyle = `rgba(${l + 14},${l + 8},${l - 6},${0.55 + random() * 0.4})`;
    g.beginPath();
    g.ellipse(random() * 128, random() * 128, 1 + random() * 2.4, 0.8 + random() * 1.6, random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds the riverside meadow's props and their colliders. `c` is the props context (props.js). */
export function buildRiverside(c) {
  const { scene, models, layout, heights, physics, RAPIER, random, anchors, fixedBox, drawDistance } = c;
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

  // The hurdle: posts every few metres across the gap and three rails, so the water runs through and nothing rides out.
  const h = river.hurdle();
  const rails = [];
  const hz0 = h.z - h.half;
  const span = h.half * 2;
  const n = Math.ceil(span / 2.6);
  const base = surface(h.x, h.z);
  for (let i = 0; i <= n; i++) {
    const z = hz0 + (span * i) / n;
    const foot = Math.min(heights.heightAt(h.x, z), base) - 0.3;
    rails.push(part(new THREE.BoxGeometry(0.16, base + 1.35 - foot, 0.16), h.x, foot + (base + 1.35 - foot) / 2, z, '#7a6347'));
  }
  for (const dy of [0.35, 0.75, 1.15]) rails.push(part(new THREE.BoxGeometry(0.07, 0.11, span), h.x + 0.1, base + dy, h.z, '#8a7455'));
  const hurdle = new THREE.Mesh(mergeGeometries(rails.map((g) => g.toNonIndexed())), solid);
  hurdle.castShadow = true;
  group.add(hurdle);
  fixedBox(h.x, base + 0.3, h.z, 0.2, 1.8, h.half);

  // The gravel laid over the crossing, a hand's breadth under the surface: a strip across the river between the posts, its pebbles breaking it.
  const cx = river.cross;
  const gx0 = cx.x - cx.half + 0.3;
  const gx1 = cx.x + cx.half - 0.3;
  const gpos = [];
  const guv = [];
  const gidx = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const x = gx0 + ((gx1 - gx0) * i) / steps;
    const zc = heights.brook.zAt(x);
    const reach = heights.brook.halfAt(x) + 0.5;
    const y = surface(x, zc) - 0.03;
    for (const dz of [-reach, reach]) {
      gpos.push(x, Math.max(y, heights.heightAt(x, zc + dz) + 0.02), zc + dz);
      guv.push(x / 3, (zc + dz) / 3);
    }
    if (i < steps) gidx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
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
  scene.add(group);

  // Reeds on both banks.
  const reeds = frondGeometry(random, 8, 1.6, 0.04, 0.1);
  const matrices = [];
  const colors = [];
  for (const r of river.reeds(random)) {
    const s = 0.8 + random() * 0.7;
    matrices.push(matrixAt(r.x, heights.heightAt(r.x, r.z) - 0.05, r.z, random() * 6.28, s, s * (0.8 + random() * 0.7), s));
    colors.push(new THREE.Color().setHSL(0.17 + random() * 0.05, 0.3 + random() * 0.15, 0.3 + random() * 0.15));
  }
  const reedMaterial = new THREE.MeshLambertMaterial({ vertexColors: true });
  scene.add(drawDistance.add(tiledInstances(reeds, reedMaterial, matrices, { colors, name: 'reeds' }), 'roughDistance'));

  // Willows, and oaks in the corners of the meadow.
  const willow = willowGeometry(random);
  const willows = river.willows().map((w) => {
    const s = 1.1 + random() * 0.5;
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2 * s, 0.3 * s).setTranslation(w.x, heights.heightAt(w.x, w.z) + 2 * s, w.z));
    anchors.push({ x: w.x, y: heights.heightAt(w.x, w.z), z: w.z, r: 0.3 * s });
    return matrixAt(w.x, heights.heightAt(w.x, w.z) - 0.2, w.z, random() * 6.28, s);
  });
  scene.add(tiledInstances(willow, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), willows, { tileSize: MODEL_TILE, name: 'willows' }));
  const oaks = [[], []];
  for (const [x, z] of layout.hill.riverside.trees ?? []) {
    const s = 1.2 + random() * 0.6;
    oaks[random() < 0.5 ? 0 : 1].push(matrixAt(x, heights.heightAt(x, z) - 0.15, z, random() * Math.PI * 2, s));
    physics.createCollider(RAPIER.ColliderDesc.cylinder(2.5 * s, 0.32 * s).setTranslation(x, heights.heightAt(x, z) + 2.5 * s, z));
    anchors.push({ x, y: heights.heightAt(x, z), z, r: 0.32 * s });
  }
  scene.add(instanceModel(models.treeA.scene, oaks[0]));
  scene.add(instanceModel(models.treeB.scene, oaks[1]));
  return { river };
}
