// The far hedge strips, far oaks and far bushes drawn in big tiles (#1076). Each builder's far strips (hedgeFar.js) and the scattered far oaks and
// bushes (scatter.js) are one mesh a 60 m tile, so that `HedgeSwap` can swap a tile for its near version on its own; on the new map that was up to
// 174 calls a view for the strips alone. Here every far 60 m mesh is taken out of the drawing and gathered by its parent, its look (material,
// geometry and shadow settings) and the 240 m tile it is in: one mesh a big tile draws the 60 m tiles of it that the swaps have made far. The
// swaps still decide each 60 m tile by writing `visible` on its far mesh; `sync` reads those flags and rebuilds only a big tile where one changed.
// The strips' big mesh holds every member's triangles and an index of the far ones; the trees' is an InstancedMesh refilled with the far ones'
// instances. Its bounds are the whole big tile's, so it is culled less finely than the 60 m meshes were: a few more triangles for far fewer calls.
// docs/decisions/performance.md, "The far hedges, oaks and bushes in big tiles (#1076)".

import * as THREE from 'three';
import { tileKey } from './tiles.js';

export const BATCH_TILE = 240; // m a side of a big tile: four 60 m tiles (MODEL_TILE) across

const tileOf = (mesh, size) => {
  const t = mesh.userData.tile;
  return tileKey((t.minX + t.maxX) / 2, (t.minZ + t.maxZ) / 2, size);
};

/** A key for what a material looks like, so the strips of two builders (each makes its own, alike) share a batch. */
function materialKey(m) {
  return [m.type, m.color?.getHex(), m.roughness, m.metalness, m.vertexColors, m.flatShading, m.side, m.transparent, m.map?.uuid ?? ''].join('|');
}

/** The far meshes of every swap (`HedgeSwap`), with each one's parent, in the swaps' order. */
function farMembers(swaps) {
  const out = [];
  for (const swap of swaps) for (const t of swap.tiles.values()) for (const mesh of t.far) if (mesh.parent) out.push(mesh);
  return out;
}

/**
 * Takes the far meshes of `swaps` (`HedgeSwap`s whose far side is plain meshes: the strips) out of their groups and draws them a big tile and a
 * material at a time. The batches go in a group `name` beside the first far group of each parent, so the strips stay where they were in the scene.
 */
export class FarStrips {
  constructor(swaps, { tileSize = BATCH_TILE, name = 'hedgesFarBatched' } = {}) {
    this.batches = [];
    const byKey = new Map();
    for (const mesh of farMembers(swaps)) {
      if (mesh.isInstancedMesh || !mesh.geometry.attributes.position) continue;
      const root = mesh.parent.parent ?? mesh.parent; // the strips' groups sit in the scene: their batches go there too
      const key = [root.uuid, materialKey(mesh.material), mesh.castShadow, mesh.receiveShadow, tileOf(mesh, tileSize)].join('/');
      let b = byKey.get(key);
      if (!b) byKey.set(key, (b = { root, material: mesh.material, castShadow: mesh.castShadow, receiveShadow: mesh.receiveShadow, members: [] }));
      b.members.push(mesh);
    }
    const groups = new Map();
    for (const b of byKey.values()) {
      this.build(b);
      let g = groups.get(b.root);
      if (!g) {
        groups.set(b.root, (g = new THREE.Group()));
        g.name = name;
        b.root.add(g);
      }
      g.add(b.mesh);
      this.batches.push(b);
    }
    this.groups = [...groups.values()];
    this.sync(true);
  }

  /** One geometry holding every member's triangles (in the root's space), its index left to `sync`. */
  build(b) {
    b.root.updateMatrixWorld(true);
    const toRoot = new THREE.Matrix4().copy(b.root.matrixWorld).invert();
    let vertices = 0;
    for (const m of b.members) vertices += m.geometry.attributes.position.count;
    const names = Object.keys(b.members[0].geometry.attributes);
    const arrays = Object.fromEntries(names.map((n) => [n, new Float32Array(vertices * b.members[0].geometry.attributes[n].itemSize)]));
    b.ranges = [];
    let at = 0;
    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (const m of b.members) {
      m.updateMatrixWorld(true);
      const into = new THREE.Matrix4().multiplyMatrices(toRoot, m.matrixWorld);
      const still = isIdentity(into);
      const normalMatrix = new THREE.Matrix3().getNormalMatrix(into);
      const count = m.geometry.attributes.position.count;
      for (const name of names) {
        const src = m.geometry.attributes[name];
        const dst = arrays[name];
        const size = src.itemSize;
        if (src.array.length !== count * size) throw new Error(`farBatch: ${name} is not a plain attribute`);
        if (still || (name !== 'position' && name !== 'normal')) dst.set(src.array, at * size);
        else {
          for (let i = 0; i < count; i++) {
            const v = name === 'position' ? p.fromBufferAttribute(src, i).applyMatrix4(into) : n.fromBufferAttribute(src, i).applyMatrix3(normalMatrix).normalize();
            dst.set([v.x, v.y, v.z], (at + i) * 3);
          }
        }
      }
      b.ranges.push({ mesh: m, start: at, count, shown: null });
      at += count;
      m.parent.remove(m); // drawn by the batch from now on; the swap still writes its `visible`, which says whether its tile is far
    }
    const geometry = new THREE.BufferGeometry();
    for (const name of names) geometry.setAttribute(name, new THREE.BufferAttribute(arrays[name], b.members[0].geometry.attributes[name].itemSize));
    const index = new THREE.BufferAttribute(vertices > 65535 ? new Uint32Array(vertices) : new Uint16Array(vertices), 1);
    index.setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(index);
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    b.mesh = new THREE.Mesh(geometry, b.material);
    b.mesh.castShadow = b.castShadow;
    b.mesh.receiveShadow = b.receiveShadow;
    b.mesh.visible = false;
  }

  /** Rebuilds each big tile one of whose 60 m tiles the swaps changed (all with `all`). Returns how many were rebuilt. */
  sync(all = false) {
    let rebuilt = 0;
    for (const b of this.batches) {
      if (!all && b.ranges.every((r) => r.shown === r.mesh.visible)) continue;
      const index = b.mesh.geometry.index;
      const a = index.array;
      let k = 0;
      for (const r of b.ranges) {
        r.shown = r.mesh.visible;
        if (!r.shown) continue;
        for (let i = 0; i < r.count; i++) a[k++] = r.start + i;
      }
      index.clearUpdateRanges();
      index.addUpdateRange(0, k);
      index.needsUpdate = true;
      b.mesh.geometry.setDrawRange(0, k);
      b.mesh.visible = k > 0;
      rebuilt++;
    }
    return rebuilt;
  }

  /** The 60 m meshes a big tile draws now (for the tests). */
  drawn(b) {
    return b.ranges.filter((r) => r.shown).map((r) => r.mesh);
  }
}

/**
 * The same for far trees (`HedgeSwap`s whose far side is InstancedMeshes: scatter.js and the quarry's scrub): one InstancedMesh a parent, big tile,
 * geometry, material and shadow setting, holding the instances of its far 60 m tiles. The batches go in the far group's own parent, so the quarry's
 * stay inside its set piece and are hidden with it.
 */
export class FarInstances {
  constructor(swaps, { tileSize = BATCH_TILE } = {}) {
    this.batches = [];
    const byKey = new Map();
    for (const mesh of farMembers(swaps)) {
      if (!mesh.isInstancedMesh) continue;
      const root = mesh.parent;
      const key = [root.uuid, mesh.geometry.uuid, mesh.material.uuid, mesh.castShadow, mesh.receiveShadow, !!mesh.instanceColor, tileOf(mesh, tileSize)].join('/');
      let b = byKey.get(key);
      if (!b) byKey.set(key, (b = { root, members: [] }));
      b.members.push(mesh);
    }
    for (const b of byKey.values()) {
      this.build(b);
      this.batches.push(b);
    }
    this.sync(true);
  }

  build(b) {
    const first = b.members[0];
    let capacity = 0;
    for (const m of b.members) capacity += m.count;
    const mesh = new THREE.InstancedMesh(first.geometry, first.material, capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = first.castShadow;
    mesh.receiveShadow = first.receiveShadow;
    mesh.name = `${b.root.name || 'trees'}Batched`;
    b.ranges = [];
    let at = 0;
    const local = new THREE.Matrix4();
    const placed = new THREE.Matrix4();
    for (const m of b.members) {
      m.updateMatrix();
      const still = isIdentity(m.matrix);
      // Every member's instances in the root's space, kept so a rebuild only copies them.
      const matrices = new Float32Array(m.count * 16);
      for (let i = 0; i < m.count; i++) {
        m.getMatrixAt(i, local);
        (still ? local : placed.multiplyMatrices(m.matrix, local)).toArray(matrices, i * 16);
        mesh.instanceMatrix.array.set(matrices.subarray(i * 16, i * 16 + 16), (at + i) * 16);
      }
      const colors = m.instanceColor ? m.instanceColor.array.slice(0, m.count * 3) : null;
      if (colors) mesh.instanceColor ??= new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3);
      b.ranges.push({ mesh: m, count: m.count, matrices, colors, shown: null });
      at += m.count;
      m.parent.remove(m);
    }
    mesh.computeBoundingSphere(); // over every member's instances, so it holds whichever are drawn
    mesh.computeBoundingBox();
    mesh.visible = false;
    b.root.add(mesh);
    b.mesh = mesh;
  }

  /** Refills each big tile one of whose 60 m tiles the swaps changed (all with `all`). Returns how many were refilled. */
  sync(all = false) {
    let rebuilt = 0;
    for (const b of this.batches) {
      if (!all && b.ranges.every((r) => r.shown === r.mesh.visible)) continue;
      const { mesh } = b;
      let k = 0;
      for (const r of b.ranges) {
        r.shown = r.mesh.visible;
        if (!r.shown) continue;
        mesh.instanceMatrix.array.set(r.matrices, k * 16);
        if (r.colors) mesh.instanceColor.array.set(r.colors, k * 3);
        k += r.count;
      }
      mesh.count = k;
      mesh.instanceMatrix.clearUpdateRanges();
      mesh.instanceMatrix.addUpdateRange(0, k * 16);
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) {
        mesh.instanceColor.clearUpdateRanges();
        mesh.instanceColor.addUpdateRange(0, k * 3);
        mesh.instanceColor.needsUpdate = true;
      }
      mesh.visible = k > 0;
      rebuilt++;
    }
    return rebuilt;
  }

  drawn(b) {
    return b.ranges.filter((r) => r.shown).map((r) => r.mesh);
  }
}

function isIdentity(m) {
  const e = m.elements;
  for (let i = 0; i < 16; i++) if (Math.abs(e[i] - (i % 5 === 0 ? 1 : 0)) > 1e-9) return false;
  return true;
}
