// Draws the electric fence (the line and the numbers are in electricFence.js): plastic posts every few metres, two strands of yellow and
// white tape sagging between them, a stout post either side of the gap with a warning sign, and the energiser on the east hedge with a
// red light that blinks with each tick. All procedural.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createElectricFence } from './electricFence.js';

const SPACING = 4; // m between posts
const SAG = 0.05; // m a strand drops between posts

function signTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f2c500';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 5;
  ctx.strokeRect(4, 4, 120, 88);
  ctx.fillStyle = '#111';
  ctx.beginPath(); // a lightning bolt
  ctx.moveTo(70, 10);
  ctx.lineTo(42, 52);
  ctx.lineTo(60, 52);
  ctx.lineTo(50, 86);
  ctx.lineTo(88, 40);
  ctx.lineTo(68, 40);
  ctx.lineTo(80, 10);
  ctx.closePath();
  ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Builds the fence on the pasture, if the layout has one. `c` is the props context (props.js). */
export function buildElectricFence({ scene, layout, heights }) {
  const fence = createElectricFence(layout);
  if (!fence) return;
  const ground = (x) => heights.heightAt(x, fence.z);
  const group = new THREE.Group();
  group.name = 'electric fence';

  // Posts: thin white plastic stakes, and stouter timber ones either side of the gap.
  const posts = [];
  const post = (x, h, w) => {
    const g = new THREE.BoxGeometry(w, h, w);
    g.translate(x, ground(x) + h / 2 - 0.1, fence.z);
    posts.push(g);
  };
  for (const [a, b] of fence.spans()) {
    const n = Math.max(1, Math.round((b - a) / SPACING));
    for (let i = 0; i <= n; i++) post(a + ((b - a) * i) / n, 1.15, 0.05);
  }
  const stout = [fence.gap.at - fence.gap.half, fence.gap.at + fence.gap.half];
  for (const x of stout) post(x, 1.35, 0.13);
  const stakes = new THREE.Mesh(mergeGeometries(posts), new THREE.MeshStandardMaterial({ color: 0xcfcdc2, roughness: 0.8 }));
  stakes.castShadow = true;
  group.add(stakes);

  // The tape: a narrow ribbon per strand along each run, following the ground with a little sag between posts.
  const pos = [];
  const index = [];
  for (const [a, b] of fence.spans()) {
    const n = Math.max(1, Math.round((b - a) / SPACING));
    for (const h of fence.heights) {
      const base = pos.length / 3;
      const steps = n * 4;
      for (let i = 0; i <= steps; i++) {
        const x = a + ((b - a) * i) / steps;
        const phase = (i % 4) / 4;
        const y = ground(x) + h - SAG * 4 * phase * (1 - phase);
        pos.push(x, y - 0.012, fence.z, x, y + 0.012, fence.z);
      }
      for (let i = 0; i < steps; i++) index.push(base + i * 2, base + i * 2 + 1, base + i * 2 + 2, base + i * 2 + 2, base + i * 2 + 1, base + i * 2 + 3);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  const tape = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xe9d24a, roughness: 0.6, side: THREE.DoubleSide }));
  group.add(tape);

  // The warning sign on the west stout post, facing both ways.
  const sx = stout[0];
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.3), new THREE.MeshStandardMaterial({ map: signTexture(), roughness: 0.7, side: THREE.DoubleSide }));
  sign.position.set(sx, ground(sx) + 1.15, fence.z);
  group.add(sign);

  // The energiser: a grey box on a post at the east end, a red light on it.
  const ex = fence.toX;
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, 0.16), new THREE.MeshStandardMaterial({ color: 0x3d4a3a, roughness: 0.6 }));
  box.position.set(ex, ground(ex) + 1.05, fence.z - 0.1);
  group.add(box);
  post(ex, 1.25, 0.1);
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), new THREE.MeshBasicMaterial({ color: 0x400000 }));
  led.position.set(ex + 0.1, ground(ex) + 1.1, fence.z - 0.19);
  led.name = 'fence led';
  group.add(led);
  const stake = new THREE.Mesh(mergeGeometries([posts[posts.length - 1]]), stakes.material);
  group.add(stake);

  scene.add(group);
}
