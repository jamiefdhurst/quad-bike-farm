// A still thing drawn as a few meshes instead of hundreds (#816). A parked quad is 80 to 270 small meshes and the barn about 200, each one a draw call, but most
// of them never move against the thing they belong to. `StaticMerge` watches a root (a vehicle, the barn, the farm animals' pens), and the meshes that have
// held their place, material and shadow for a couple of seconds are merged by material into one mesh each, a child of the root. The originals stay where they
// are, unchanged and still found by name, but on `MERGED_LAYER`, which the camera and the sun's shadow pass do not draw. A mesh that moves, is hidden, changes
// its geometry or material or turns its shadow on or off drops out of the merge, and the merge is made again without it: the wheels of a vehicle that is
// driven, a door that swings. What is drawn is the same triangles with the same materials, so nothing looks different, only the calls are fewer.
// docs/decisions/performance.md, "Merging what stands still (#816)".

import * as THREE from 'three';

/** The layer a merged-away original is on. Layer 1 is the specks' (`farDetail.js`); neither is drawn. */
export const MERGED_LAYER = 2;
const DRAWN = 1; // the layer mask of a mesh that is drawn
const EPS = 4e-3; // how far a mesh may drift from where it was merged before it is taken out: a parked vehicle's body jitters by up to 3 parts in 1000 (the suspension at rest), which is a few millimetres at the far end of it and not seen
const MESH_BEFORE_RENDER = THREE.Object3D.prototype.onBeforeRender;
const MATERIAL_BEFORE_RENDER = THREE.Material.prototype.onBeforeRender;

/** Whether a mesh could be merged with others: a plain mesh with one material, which is not a lamp's lens or glow, a skin, an instanced batch or morphed. */
export function mergeCandidate(m) {
  if (!m.isMesh || m.isSkinnedMesh || m.isInstancedMesh || m.userData.mergedProxy || m.userData.keepFar || m.name === 'lens') return false;
  const geo = m.geometry;
  const mat = m.material;
  if (!geo || !mat || Array.isArray(mat) || !geo.attributes.position || geo.morphAttributes?.position) return false;
  for (const k in geo.attributes) if (geo.attributes[k].isInterleavedBufferAttribute) return false;
  if (m.onBeforeRender !== MESH_BEFORE_RENDER || mat.onBeforeRender !== MATERIAL_BEFORE_RENDER) return false;
  if (mat.emissive && mat.emissive.getHex() !== 0 && mat.emissiveIntensity > 0) return false;
  return true;
}

const attributeKey = (geo) => `${geo.index ? 'i' : 'n'}${Object.keys(geo.attributes).sort().map((k) => `${k}${geo.attributes[k].itemSize}${geo.attributes[k].array.constructor.name}${geo.attributes[k].normalized ? 'n' : ''}`).join(',')}`;

const _normal = new THREE.Matrix3();
const _v = new THREE.Vector3();

/** One geometry made of the geometries of `items` ({ mesh, matrix }) moved by their matrices, written straight into new arrays (all of one kind: `attributeKey`). */
function mergedGeometry(items) {
  const first = items[0].mesh.geometry;
  const names = Object.keys(first.attributes);
  let vertices = 0;
  let indices = 0;
  for (const { mesh } of items) {
    vertices += mesh.geometry.attributes.position.count;
    indices += mesh.geometry.index?.count ?? 0;
  }
  const out = new THREE.BufferGeometry();
  for (const name of names) {
    const a = first.attributes[name];
    out.setAttribute(name, new THREE.BufferAttribute(new a.array.constructor(vertices * a.itemSize), a.itemSize, a.normalized));
  }
  const index = first.index ? (vertices > 65535 ? new Uint32Array(indices) : new Uint16Array(indices)) : null;
  let at = 0;
  let ix = 0;
  for (const { mesh, matrix } of items) {
    const g = mesh.geometry;
    const count = g.attributes.position.count;
    _normal.getNormalMatrix(matrix);
    for (const name of names) {
      const from = g.attributes[name];
      const to = out.attributes[name];
      if (name === 'position' || name === 'normal') {
        for (let i = 0; i < count; i++) {
          _v.fromBufferAttribute(from, i);
          if (name === 'position') _v.applyMatrix4(matrix);
          else _v.applyMatrix3(_normal).normalize();
          to.setXYZ(at + i, _v.x, _v.y, _v.z);
        }
      } else to.array.set(from.array, at * from.itemSize);
    }
    if (index) {
      const src = g.index.array;
      for (let i = 0; i < src.length; i++) index[ix + i] = src[i] + at;
      ix += src.length;
    }
    at += count;
  }
  if (index) out.setIndex(new THREE.BufferAttribute(index, 1));
  return out;
}

/**
 * The meshes of `list` ({ mesh, matrix }: the matrix is the mesh's in the root's space) merged by material, shadow and attributes into one mesh each, in the
 * root's space. Returns { proxies, merged }: the new meshes and the sources that went into them. A group of one is left as it is, and so is a mesh turned
 * inside out by a negative scale (merging would not flip its faces).
 */
export function mergeByMaterial(list) {
  const groups = new Map();
  for (const item of list) {
    if (item.matrix.determinant() <= 0) continue;
    const m = item.mesh;
    const key = `${m.material.uuid}|${m.castShadow ? 1 : 0}${m.receiveShadow ? 1 : 0}|${m.renderOrder}|${attributeKey(m.geometry)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const proxies = [];
  const merged = [];
  for (const items of groups.values()) {
    if (items.length < 2) continue;
    const geometry = mergedGeometry(items);
    const first = items[0].mesh;
    const proxy = new THREE.Mesh(geometry, first.material);
    proxy.castShadow = first.castShadow;
    proxy.receiveShadow = first.receiveShadow;
    proxy.renderOrder = first.renderOrder;
    proxy.name = 'merged';
    proxy.userData.mergedProxy = true;
    proxies.push(proxy);
    for (const { mesh } of items) merged.push(mesh);
  }
  return { proxies, merged };
}

/** Whether the 16 numbers of `m` are within `EPS` of those in `kept`; when they are not, `kept` takes them (and says so). */
function drifted(kept, m) {
  for (let i = 0; i < 16; i++) {
    if (Math.abs(kept[i] - m[i]) > EPS) {
      kept.set(m);
      return true;
    }
  }
  return false;
}

export class StaticMerge {
  /** `hold`: how many seconds a mesh has to hold still for before it is merged, so a vehicle that stops at a gate is not merged and taken apart each time. */
  constructor({ hold = 2 } = {}) {
    this.hold = hold;
    this.roots = new WeakMap(); // root -> { objects: WeakMap(object -> Float64Array of its local matrix), seen: Map(mesh -> state), merged: Set, left: Set, proxies, gen, mergedAt, hold }
  }

  /**
   * One look at `root` at time `now` (seconds). It walks the root once comparing each object's own matrix with the one it last saw (so a mesh under a group
   * that moves counts as moved, and the root's own movement does not count), and each mesh's visibility, layer, shadow, geometry and material. A mesh that has
   * not changed for `hold` seconds is to be merged. When the set that should be merged is not the set that is, it is merged again. With `fresh` every mesh counts
   * as having held still (the frame budget's count, which is judged from scratch). Returns whether it merged again.
   */
  update(root, now, fresh = false) {
    let e = this.roots.get(root);
    if (!e) this.roots.set(root, (e = { objects: new WeakMap(), seen: new Map(), merged: new Set(), left: new Set(), proxies: [], gen: 0, mergedAt: -Infinity, hold: this.hold }));
    const gen = ++e.gen;
    const want = [];
    const walk = (o, moved, hidden) => {
      let kept = e.objects.get(o);
      if (!kept) e.objects.set(o, (kept = new Float64Array(o.matrix.elements)));
      else if (drifted(kept, o.matrix.elements)) moved = true;
      hidden = hidden || !o.visible;
      if (o.isMesh && mergeCandidate(o)) {
        let s = e.seen.get(o);
        const layers = o.userData.mergedAway ? DRAWN : o.layers.mask; // a mesh we have put on the merged layer reads as drawn
        let versions = 0;
        for (const k in o.geometry.attributes) versions += o.geometry.attributes[k].version;
        if (!s) e.seen.set(o, (s = { since: now, gen }));
        else if (!moved && s.shown === !hidden && s.layers === layers && s.cast === o.castShadow && s.receive === o.receiveShadow && s.geometry === o.geometry
          && s.material === o.material && s.versions === versions && s.order === o.renderOrder) {
          // as it was
        } else s.since = now;
        s.shown = !hidden;
        s.layers = layers;
        s.cast = o.castShadow;
        s.receive = o.receiveShadow;
        s.geometry = o.geometry;
        s.material = o.material;
        s.versions = versions;
        s.order = o.renderOrder;
        s.gen = gen;
        if (fresh) s.since = Math.min(s.since, now - e.hold); // judged from scratch: as if it had held still all along, so the look after this one does not take it apart
        if (s.shown && s.layers === DRAWN && now - s.since >= e.hold) want.push(o);
      }
      for (const c of o.children) if (!c.userData.mergedProxy) walk(c, moved, hidden);
    };
    for (const c of root.children) if (!c.userData.mergedProxy) walk(c, false, !root.visible);
    for (const [m, s] of e.seen) if (s.gen !== gen) e.seen.delete(m);
    let same = true;
    for (const m of e.merged) {
      const s = e.seen.get(m);
      if (!s || s.since > e.mergedAt) same = false;
    }
    if (!same) e.hold = Math.min(e.hold * 2, 30); // a root that keeps changing is left alone for longer each time
    for (const m of want) if (!e.merged.has(m) && !e.left.has(m)) same = false;
    for (const m of e.left) if (!want.includes(m)) same = false;
    if (same) return false;
    this.unmerge(e);
    if (want.length < 2) return true;
    root.updateWorldMatrix(true, true);
    const inverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
    const list = want.map((mesh) => ({ mesh, matrix: new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld) }));
    const { proxies, merged } = mergeByMaterial(list);
    for (const p of proxies) root.add(p);
    for (const m of merged) {
      e.merged.add(m);
      m.userData.mergedAway = true;
      m.layers.set(MERGED_LAYER);
    }
    for (const m of want) if (!e.merged.has(m)) e.left.add(m);
    e.proxies = proxies;
    e.mergedAt = now;
    return true;
  }

  /** Puts everything back as it was. */
  unmerge(e) {
    for (const m of e.merged) {
      delete m.userData.mergedAway;
      m.layers.set(0);
    }
    e.merged.clear();
    e.left.clear();
    for (const p of e.proxies) {
      p.parent?.remove(p);
      p.geometry.dispose();
    }
    e.proxies = [];
  }

  /** `root` as it was before any merge (the switch in the Tune tab, or a root taken out of the scene). */
  release(root) {
    const e = this.roots.get(root);
    if (e) this.unmerge(e);
    this.roots.delete(root);
  }

  /** How many meshes of `root` are merged away, and how many meshes stand in for them. */
  counts(root) {
    const e = this.roots.get(root);
    return { merged: e?.merged.size ?? 0, proxies: e?.proxies.length ?? 0 };
  }
}
