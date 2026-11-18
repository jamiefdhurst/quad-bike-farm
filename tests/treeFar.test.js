import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { simplifyGeometry, thinCards, farTree, FAR_BARK_TRIANGLES, FAR_LEAF_KEEP } from '../src/world/treeFar.js';
import { instanceModel } from '../src/world/assets.js';
import { HedgeSwap } from '../src/world/hedgeFar.js';

// The wood's oaks far away (#683): the farm's real oak models, simplified.
const tris = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
const models = {};

function loadGlb(name) {
  const buf = fs.readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  const data = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return new Promise((resolve, reject) => new GLTFLoader().parse(data, '', resolve, reject));
}

beforeAll(async () => {
  vi.stubGlobal('self', globalThis);
  vi.stubGlobal('document', {
    createElement: () => ({ getContext: () => ({}), style: {}, width: 4, height: 4 }),
    createElementNS: () => ({ style: {}, width: 4, height: 4, addEventListener(type, fn) { this['_' + type] = fn; }, removeEventListener() {}, set src(_) { setTimeout(() => this._load?.({}), 0); } }),
  });
  URL.createObjectURL = () => 'blob:stand-in';
  URL.revokeObjectURL = () => {};
  for (const n of ['tree-oak-a', 'tree-oak-b']) models[n] = (await loadGlb(n)).scene;
}, 60000);

const meshesOf = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};
const bounds = (root) => new THREE.Box3().setFromObject(root);

describe('the far oak', () => {
  it.each(['tree-oak-a', 'tree-oak-b'])('%s keeps its size and has about a tenth of the triangles (500 to 750 of 6,300)', (name) => {
    const near = models[name];
    const far = farTree(near);
    const count = (root) => meshesOf(root).reduce((s, m) => s + tris(m.geometry), 0);
    expect(count(near)).toBeGreaterThan(5000);
    expect(count(far)).toBeLessThan(800);
    expect(count(far)).toBeGreaterThan(200);
    const a = bounds(near).getSize(new THREE.Vector3());
    const b = bounds(far).getSize(new THREE.Vector3());
    expect(b.y).toBeGreaterThan(a.y * 0.9);
    expect(b.y).toBeLessThan(a.y * 1.1);
    expect(b.x).toBeGreaterThan(a.x * 0.8);
    expect(b.x).toBeLessThan(a.x * 1.25);
    expect(meshesOf(far).length).toBe(meshesOf(near).length);
    meshesOf(far).forEach((m, i) => expect(m.material).toBe(meshesOf(near)[i].material));
  });

  it('simplifies the trunk to the target and keeps it standing and round', () => {
    const bark = meshesOf(models['tree-oak-a']).find((m) => !m.material.transparent);
    const out = simplifyGeometry(bark.geometry);
    expect(tris(out)).toBeLessThanOrEqual(FAR_BARK_TRIANGLES);
    expect(tris(out)).toBeGreaterThan(60);
    for (const n of ['position', 'normal', 'uv']) expect(out.attributes[n].count).toBe(out.attributes.position.count);
    for (let i = 0; i < out.attributes.normal.count; i++) expect(Math.hypot(out.attributes.normal.getX(i), out.attributes.normal.getY(i), out.attributes.normal.getZ(i))).toBeCloseTo(1, 3);
    for (const v of out.index.array) expect(v).toBeLessThan(out.attributes.position.count);
    out.computeBoundingBox();
    bark.geometry.computeBoundingBox();
    expect(out.boundingBox.max.y).toBeGreaterThan(bark.geometry.boundingBox.max.y * 0.7);
  });

  it('thins the leaf cards to one in four, each grown to fill the gap, with the same texture coordinates', () => {
    const leaves = meshesOf(models['tree-oak-b']).find((m) => m.material.transparent);
    // The model's cards are pairs of triangles that share an edge, in order: the thinning relies on it.
    const idx = leaves.geometry.index.array;
    let pairs = 0;
    for (let c = 0; c + 1 < idx.length / 6 * 2; c += 2) {
      const a = new Set([idx[c * 3], idx[c * 3 + 1], idx[c * 3 + 2]]);
      if ([idx[c * 3 + 3], idx[c * 3 + 4], idx[c * 3 + 5]].filter((v) => a.has(v)).length >= 2) pairs++;
    }
    expect(pairs / (idx.length / 6)).toBeGreaterThan(0.9);
    const out = thinCards(leaves.geometry);
    expect(tris(out)).toBeLessThanOrEqual(Math.ceil(tris(leaves.geometry) / FAR_LEAF_KEEP) + 2);
    expect(out.attributes.uv.count).toBe(out.attributes.position.count);
    expect(Object.keys(out.attributes).sort()).toEqual(Object.keys(leaves.geometry.attributes).sort());
  });

  it('is scattered into the same tiles as the near oak, so the swap by distance changes whole tiles', () => {
    const near = models['tree-oak-a'];
    const matrices = [[0, 0], [10, 3], [140, 20], [141, -30], [-90, 200]].map(([x, z]) => new THREE.Matrix4().makeTranslation(x, 0, z));
    const nearTiles = instanceModel(near, matrices);
    const farTiles = instanceModel(farTree(near), matrices);
    const keys = (g) => [...new Set(g.children.map((m) => m.userData.tile.key))].sort();
    expect(keys(farTiles)).toEqual(keys(nearTiles));
    const swap = new HedgeSwap(nearTiles, farTiles);
    swap.update({ x: 0, z: 0 }, 70, true);
    const visible = (g, key) => g.children.filter((m) => m.userData.tile.key === key).every((m) => m.visible);
    for (const key of keys(nearTiles)) {
      const tile = nearTiles.children.find((m) => m.userData.tile.key === key).userData.tile;
      const d = Math.hypot(Math.max(tile.minX, 0, -tile.maxX), Math.max(tile.minZ, 0, -tile.maxZ));
      expect(visible(nearTiles, key), `near ${key}`).toBe(d <= 70);
      expect(visible(farTiles, key), `far ${key}`).toBe(d > 70);
    }
  });
});
