import { describe, it, expect, beforeAll, vi } from 'vitest';
import fs from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Scatter } from '../src/world/scatter.js';
import { FarInstances } from '../src/world/farBatch.js';
import { farBush, thinClumps, FAR_CLUMP_KEEP } from '../src/world/treeFar.js';

// Every builder's oaks and bushes scattered once, with their far versions beyond treeFullDistance (#837), on the farm's real models.
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
  for (const [key, file] of [['treeA', 'tree-oak-a'], ['treeB', 'tree-oak-b'], ['bush', 'bush']]) models[key] = { scene: (await loadGlb(file)).scene };
}, 60000);

const at = (x, z) => new THREE.Matrix4().makeTranslation(x, 0, z);
const meshesOf = (root) => {
  const out = [];
  root.traverse((o) => o.isMesh && out.push(o));
  return out;
};

describe('the far bush', () => {
  it('keeps one leaf clump in two whole, with the texture coordinates and normals as they were, about the same size, with its material', () => {
    const near = models.bush.scene;
    const far = farBush(near);
    const count = (root) => meshesOf(root).reduce((s, m) => s + tris(m.geometry), 0);
    expect(count(near)).toBe(360);
    expect(count(far)).toBeLessThanOrEqual(Math.ceil(360 / FAR_CLUMP_KEEP) + 30);
    expect(count(far)).toBeGreaterThan(120);
    const geo = meshesOf(near)[0].geometry;
    const thin = thinClumps(geo);
    expect(Object.keys(thin.attributes).sort()).toEqual(Object.keys(geo.attributes).sort());
    // every normal and texture coordinate of the far bush is one the near bush has: nothing averaged
    const has = (attr) => new Set(Array.from({ length: attr.count }, (_, i) => Array.from({ length: attr.itemSize }, (_, c) => attr.array[i * attr.itemSize + c].toFixed(5)).join()));
    for (const n of ['normal', 'uv']) {
      const known = has(geo.attributes[n]);
      for (const v of has(thin.attributes[n])) expect(known.has(v)).toBe(true);
    }
    const a = new THREE.Box3().setFromObject(near).getSize(new THREE.Vector3());
    const b = new THREE.Box3().setFromObject(far).getSize(new THREE.Vector3());
    for (const k of ['x', 'y', 'z']) {
      expect(b[k]).toBeGreaterThan(a[k] * 0.95);
      expect(b[k]).toBeLessThan(a[k] * 1.15);
    }
    meshesOf(far).forEach((m, i) => expect(m.material).toBe(meshesOf(near)[i].material));
  });
});

describe('Scatter', () => {
  it('draws the oaks two builders put in one tile as one batch a material, not one for each builder', () => {
    const scatter = new Scatter();
    scatter.oaks(models, [[at(5, 5), at(20, 10)], []]); // the boundary tree line, say
    scatter.oaks(models, [[at(30, 40)], [at(12, 50)]]); // and a lane's hedgerow oaks in the same 60 m tile
    const scene = new THREE.Scene();
    scatter.build(scene);
    const near = scene.getObjectByName('trees');
    const far = scene.getObjectByName('treesFar');
    const bark = near.children.filter((m) => m.material.name === 'Bark_NormalTree');
    expect(bark.length).toBe(2); // one tile: oak A's bark and oak B's
    expect(bark.map((m) => m.count).sort()).toEqual([1, 3]);
    expect(far.children.length).toBe(near.children.length);
  });

  it('keeps a bush that casts a shadow apart from the hedges\' bushes, which do not', () => {
    const scatter = new Scatter();
    scatter.bushes(models, [at(1, 1), at(2, 2)]);
    scatter.bushes(models, [at(3, 3)], { castShadow: true });
    scatter.bushes(models, [at(4, 4)]);
    const scene = new THREE.Scene();
    scatter.build(scene);
    const near = scene.getObjectByName('trees').children;
    expect(near.map((m) => [m.castShadow, m.count]).sort()).toEqual([[false, 3], [true, 1]]);
  });

  it('swaps a whole tile for its far oaks and bushes beyond the distance, and back as you come near', () => {
    const scatter = new Scatter();
    scatter.oaks(models, [[at(10, 10), at(200, 10)], [at(205, 30)]]);
    scatter.bushes(models, [at(15, 12), at(210, 12)]);
    const scene = new THREE.Scene();
    const swap = scatter.build(scene);
    const near = scene.getObjectByName('trees').children;
    const far = scene.getObjectByName('treesFar').children;
    const inTile = (list, x) => list.filter((m) => m.userData.tile.key === `${Math.floor(x / 60)},0`);
    swap.update({ x: 0, z: 0 }, 70, true);
    expect(inTile(near, 10).every((m) => m.visible) && inTile(far, 10).every((m) => !m.visible)).toBe(true);
    expect(inTile(near, 200).every((m) => !m.visible) && inTile(far, 200).every((m) => m.visible)).toBe(true);
    expect(inTile(far, 200).length).toBe(5); // oak A's bark and leaves, oak B's, and the bush
    swap.update({ x: 190, z: 0 }, 70, true);
    expect(inTile(near, 200).every((m) => m.visible) && inTile(far, 200).every((m) => !m.visible)).toBe(true);
  });

  it('draws the far oaks and bushes as one InstancedMesh a big tile a material, holding exactly the instances of its far 60 m tiles (#1076)', () => {
    const scatter = new Scatter();
    scatter.oaks(models, [[at(10, 10), at(70, 10), at(130, 10), at(340, 10)], [at(75, 30)]]);
    scatter.bushes(models, [at(15, 12), at(135, 12)]);
    const scene = new THREE.Scene();
    const swap = scatter.build(scene);
    const far = [...scene.getObjectByName('treesFar').children];
    const before = new Map(far.map((m) => [m, Array.from({ length: m.count }, (_, i) => { const x = new THREE.Matrix4(); m.getMatrixAt(i, x); return x.elements.map((v) => v.toFixed(4)).join(' '); })]));
    const batched = new FarInstances([swap]);
    expect(scene.getObjectByName('treesFar').children.filter((m) => far.includes(m))).toEqual([]); // the 60 m meshes are no longer drawn
    const big = (x) => batched.batches.filter((b) => b.ranges.some((r) => r.mesh.userData.tile.minX >= x && r.mesh.userData.tile.minX < x + 240));
    expect(new Set(big(0).map((b) => b.mesh.material)).size).toBe(big(0).length); // one batch a material in the first big tile (oak A's, oak B's and the bush's)
    const drawn = (b) => Array.from({ length: b.mesh.count }, (_, i) => { const x = new THREE.Matrix4(); b.mesh.getMatrixAt(i, x); return x.elements.map((v) => v.toFixed(4)).join(' '); }).sort();
    const expected = (b, keys) => b.ranges.filter((r) => keys.includes(r.mesh.userData.tile.key)).flatMap((r) => before.get(r.mesh)).sort();
    for (const [x, keys] of [[-20, ['2,0', '5,0']], [200, ['0,0', '1,0', '5,0']]]) { // from x -20 the tile at 60 to 75 is under 100 m, 130 is past it
      swap.update({ x, z: 0 }, 100, true);
      batched.sync();
      for (const b of batched.batches) {
        expect(drawn(b)).toEqual(expected(b, keys));
        expect(b.mesh.visible).toBe(b.mesh.count > 0);
      }
    }
    expect(batched.sync()).toBe(0);
  });

  it('builds nothing and gives no swap when no builder placed anything', () => {
    const scatter = new Scatter();
    scatter.oaks(models, [[], []]);
    const scene = new THREE.Scene();
    expect(scatter.build(scene)).toBe(null);
    expect(scene.children.length).toBe(0);
  });
});
