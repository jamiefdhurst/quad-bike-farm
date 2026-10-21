// The drawing of autumn (autumn.js): the trees' leaves turned, conkers under the oaks, and leaves coming down round the camera.

import * as THREE from 'three';
import { tiledInstances } from './tiledInstances.js';
import { AUTUMN_TINTS, LEAF_COLOURS, conkerSpots } from './autumn.js';
import { matrixAt } from './hillProps.js';

/** Turns the leaves of the oaks, bushes and hedges: the cut-out leaf materials (assets.js) get an orange or gold tint, each model its own. */
export function applyAutumnTint(models, tints = AUTUMN_TINTS) {
  const done = new Set();
  for (const [name, [r, g, b]] of Object.entries(tints)) {
    models[name]?.scene.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
        if (!m || done.has(m) || !m.map || m.alphaTest !== 0.5) continue; // the leaves, not the bark
        m.color.setRGB(r, g, b);
        done.add(m);
      }
    });
  }
}

/** Conkers lying round the foot of each oak in the wood: tiny shiny brown spheres, one tiled mesh set (so they cull and hide with distance). */
export function buildConkers({ scene, heights, drawDistance }, woods, trees, perTree, random) {
  const spots = conkerSpots(trees, woods, perTree, random);
  if (!spots.length) return null;
  const geo = new THREE.SphereGeometry(0.032, 6, 4);
  geo.scale(1, 0.85, 1);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const matrices = spots.map(([x, z]) => matrixAt(x, heights.heightAt(x, z) + 0.01, z, random() * Math.PI * 2, 0.8 + random() * 0.5));
  const colors = spots.map(() => new THREE.Color().setHSL(0.05 + random() * 0.03, 0.65, 0.12 + random() * 0.1));
  const group = tiledInstances(geo, material, matrices, { colors, name: 'conkers' });
  scene.add(drawDistance ? drawDistance.add(group, 'coverDistance') : group);
  return group;
}

const LEAVES = 300;
const RADIUS = 14; // metres round the camera
const HEIGHT = 9;
const FALL = 0.9; // m/s: leaves come down slower than snow, tumbling

/** Leaves drifting down round the camera, in a cylinder that moves with you. How many show is how many are in the air here (autumn.js). Snow's cousin (effects/snow.js). */
export class LeafFall {
  constructor(scene) {
    this.pos = new Float32Array(LEAVES * 3);
    this.leaves = new Float32Array(LEAVES * 4); // each leaf's x, y, z relative to the camera, and its own sway phase
    const colours = new Float32Array(LEAVES * 3);
    for (let i = 0; i < LEAVES; i++) {
      this.respawn(i, Math.random() * HEIGHT);
      colours.set(LEAF_COLOURS[i % LEAF_COLOURS.length], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    this.material = new THREE.PointsMaterial({ size: 0.16, sizeAttenuation: true, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.time = 0;
  }

  respawn(i, y = HEIGHT) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    this.leaves[i * 4] = Math.cos(a) * r;
    this.leaves[i * 4 + 1] = y - HEIGHT * 0.4;
    this.leaves[i * 4 + 2] = Math.sin(a) * r;
    this.leaves[i * 4 + 3] = Math.random() * Math.PI * 2;
  }

  /** `count` how many leaves are in the air, `wind` how windy (1 normal), `light` 0..1 how bright it is (the leaves darken at night). */
  update(dt, camera, count, wind = 1, light = 1) {
    const n = Math.min(LEAVES, count);
    this.points.visible = n > 0;
    this.material.color.setScalar(0.25 + 0.75 * light);
    if (!n) return;
    this.time += dt;
    const { x: cx, y: cy, z: cz } = camera.position;
    for (let i = 0; i < n; i++) {
      const k = i * 4;
      const phase = this.leaves[k + 3];
      this.leaves[k] += (0.5 * wind + Math.cos(this.time * 1.7 + phase) * 0.9) * dt;
      this.leaves[k + 1] -= FALL * (0.6 + 0.8 * ((phase * 7) % 1)) * dt;
      this.leaves[k + 2] += (0.2 * wind + Math.sin(this.time * 1.3 + phase) * 0.9) * dt;
      if (this.leaves[k + 1] < -HEIGHT * 0.4 || Math.hypot(this.leaves[k], this.leaves[k + 2]) > RADIUS) this.respawn(i);
      this.pos.set([cx + this.leaves[k], cy + this.leaves[k + 1], cz + this.leaves[k + 2]], i * 3);
    }
    this.points.geometry.setDrawRange(0, n);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
