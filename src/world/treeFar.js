// The wood's oaks from far away (#683): the farm's oak model is 4,300 triangles of bark and 1,300 to 1,900 of leaf cards, and at the wood's density (about
// 250 oaks) they were most of what the wood gate spot drew (1.0M to 1.5M of its 3.1M triangles). Beyond `treeFullDistance` each tile of oaks is swapped for
// the same oaks with a lighter trunk (the bark's vertices clustered on a grid, keeping its outline) and a quarter of the leaf cards grown to cover the
// gaps, 500 to 750 triangles in all, by the same tile swap the hedges use (hedgeFar.js `HedgeSwap`). See docs/decisions/performance.md, "Oaks far away (#683)".

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Triangles a far oak's trunk is simplified to at most. */
export const FAR_BARK_TRIANGLES = 260;
/** One leaf card in this many is kept, each grown by `FAR_LEAF_GROW` about its middle, so the crown keeps its mass. */
export const FAR_LEAF_KEEP = 4;
export const FAR_LEAF_GROW = 1.75;

/** One leaf clump in this many is kept in a far bush (the bush is 15 clumps, 360 triangles), each grown by `FAR_CLUMP_GROW` about its middle. */
export const FAR_CLUMP_KEEP = 2;
export const FAR_CLUMP_GROW = 1.2;

const trianglesOf = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;

/** Averages every attribute of `geo` within each cell of a grid `cell` m across (vertex clustering), and drops the triangles that fall into one point or one line. */
function cluster(geo, cell) {
  const names = Object.keys(geo.attributes);
  const pos = geo.attributes.position;
  const ids = new Int32Array(pos.count);
  const keys = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) / cell)},${Math.round(pos.getY(i) / cell)},${Math.round(pos.getZ(i) / cell)}`;
    let id = keys.get(key);
    if (id === undefined) keys.set(key, (id = keys.size));
    ids[i] = id;
  }
  const count = keys.size;
  const sums = names.map((n) => new Float32Array(count * geo.attributes[n].itemSize));
  const weight = new Float32Array(count);
  for (let i = 0; i < pos.count; i++) {
    weight[ids[i]]++;
    names.forEach((n, k) => {
      const a = geo.attributes[n];
      for (let c = 0; c < a.itemSize; c++) sums[k][ids[i] * a.itemSize + c] += a.array[i * a.itemSize + c];
    });
  }
  const out = new THREE.BufferGeometry();
  names.forEach((n, k) => {
    const a = geo.attributes[n];
    const arr = new Float32Array(count * a.itemSize);
    for (let v = 0; v < count; v++) for (let c = 0; c < a.itemSize; c++) arr[v * a.itemSize + c] = sums[k][v * a.itemSize + c] / weight[v];
    out.setAttribute(n, new THREE.BufferAttribute(arr, a.itemSize));
  });
  const normal = out.attributes.normal;
  if (normal) {
    for (let v = 0; v < count; v++) {
      const l = Math.hypot(normal.getX(v), normal.getY(v), normal.getZ(v)) || 1;
      normal.setXYZ(v, normal.getX(v) / l, normal.getY(v) / l, normal.getZ(v) / l);
    }
  }
  const indexed = geo.index ? geo.index.array : null;
  const seen = new Set();
  const index = [];
  for (let t = 0; t < trianglesOf(geo); t++) {
    const a = ids[indexed ? indexed[t * 3] : t * 3];
    const b = ids[indexed ? indexed[t * 3 + 1] : t * 3 + 1];
    const c = ids[indexed ? indexed[t * 3 + 2] : t * 3 + 2];
    if (a === b || b === c || a === c) continue;
    const key = [a, b, c].sort((x, y) => x - y).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    index.push(a, b, c);
  }
  out.setIndex(index);
  return out;
}

/** `geo` with its vertices clustered on a grid, coarser until it has `target` triangles or fewer (and at least 12: a trunk of a few planks). */
export function simplifyGeometry(geo, target = FAR_BARK_TRIANGLES) {
  geo.computeBoundingBox();
  const size = geo.boundingBox.getSize(new THREE.Vector3());
  let cell = Math.max(size.x, size.y, size.z) / 80;
  let out = cluster(geo, cell);
  for (let tries = 0; trianglesOf(out) > target && tries < 40; tries++) {
    cell *= 1.18;
    out = cluster(geo, cell);
  }
  return out;
}

/**
 * A leaf mesh of cards (two triangles each, in order) with one card in `keep` left, each grown by `grow` about its middle, as a plain list of triangles.
 * The cards are blended, so a missing one is a gap and a bigger one fills it: the crown keeps its mass with a quarter of the triangles.
 */
export function thinCards(geo, keep = FAR_LEAF_KEEP, grow = FAR_LEAF_GROW) {
  const names = Object.keys(geo.attributes);
  const index = geo.index ? geo.index.array : null;
  const vertex = (t, k) => (index ? index[t * 3 + k] : t * 3 + k);
  const cards = Math.floor(trianglesOf(geo) / 2);
  const kept = [];
  for (let card = 0; card < cards; card += keep) kept.push(card);
  const arrays = names.map((n) => new Float32Array(kept.length * 6 * geo.attributes[n].itemSize));
  const pos = geo.attributes.position;
  kept.forEach((card, i) => {
    const verts = [0, 1, 2, 3, 4, 5].map((k) => vertex(card * 2 + (k < 3 ? 0 : 1), k % 3));
    const mid = [0, 1, 2].map((c) => verts.reduce((s, v) => s + pos.array[v * 3 + c], 0) / 6);
    verts.forEach((v, k) => {
      names.forEach((n, j) => {
        const a = geo.attributes[n];
        for (let c = 0; c < a.itemSize; c++) {
          let value = a.array[v * a.itemSize + c];
          if (n === 'position') value = mid[c] + (value - mid[c]) * grow;
          arrays[j][(i * 6 + k) * a.itemSize + c] = value;
        }
      });
    });
  });
  const out = new THREE.BufferGeometry();
  names.forEach((n, j) => out.setAttribute(n, new THREE.BufferAttribute(arrays[j], geo.attributes[n].itemSize)));
  return out;
}

/**
 * The far version of a tree model: the same meshes and materials with each opaque mesh's triangles simplified (`FAR_BARK_TRIANGLES`) and each blended
 * one thinned to cards (`thinCards`). A group, placed where `root` is, for `instanceModel` to scatter like the near one so their tiles match.
 */
export function farTree(root) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const leaves = !!o.material?.transparent || o.material?.alphaTest > 0;
    const far = new THREE.Mesh(leaves ? thinCards(o.geometry) : simplifyGeometry(o.geometry), o.material);
    far.applyMatrix4(o.matrixWorld);
    group.add(far);
  });
  return group;
}

/**
 * The leaf clumps of `geo` (the parts of it that share no vertex), as lists of triangle numbers, in the order they first appear.
 */
function clumps(geo) {
  const index = geo.index ? geo.index.array : null;
  const vertex = (t, k) => (index ? index[t * 3 + k] : t * 3 + k);
  const parent = new Int32Array(geo.attributes.position.count).map((_, i) => i);
  const root = (v) => {
    while (parent[v] !== v) v = parent[v] = parent[parent[v]];
    return v;
  };
  for (let t = 0; t < trianglesOf(geo); t++) {
    parent[root(vertex(t, 1))] = root(vertex(t, 0));
    parent[root(vertex(t, 2))] = root(vertex(t, 0));
  }
  const out = new Map();
  for (let t = 0; t < trianglesOf(geo); t++) {
    const r = root(vertex(t, 0));
    if (!out.has(r)) out.set(r, []);
    out.get(r).push(t);
  }
  return [...out.values()];
}

/**
 * A mesh of separate leaf clumps with one clump in `keep` left, each grown by `grow` about its middle, as a plain list of triangles with every
 * attribute as it was: the leaf texture and the shading stay the bush's own, and the bigger clumps fill the gaps (as `thinCards` does for the oak).
 */
export function thinClumps(geo, keep = FAR_CLUMP_KEEP, grow = FAR_CLUMP_GROW) {
  const names = Object.keys(geo.attributes);
  const index = geo.index ? geo.index.array : null;
  const vertex = (t, k) => (index ? index[t * 3 + k] : t * 3 + k);
  const pos = geo.attributes.position;
  const kept = clumps(geo).filter((_, i) => i % keep === 0);
  const count = kept.reduce((n, c) => n + c.length, 0) * 3;
  const arrays = names.map((n) => new Float32Array(count * geo.attributes[n].itemSize));
  let at = 0;
  for (const clump of kept) {
    const verts = clump.flatMap((t) => [vertex(t, 0), vertex(t, 1), vertex(t, 2)]);
    const mid = [0, 1, 2].map((c) => verts.reduce((s, v) => s + pos.array[v * 3 + c], 0) / verts.length);
    for (const v of verts) {
      names.forEach((n, j) => {
        const a = geo.attributes[n];
        for (let c = 0; c < a.itemSize; c++) {
          let value = a.array[v * a.itemSize + c];
          if (n === 'position') value = mid[c] + (value - mid[c]) * grow;
          arrays[j][at * a.itemSize + c] = value;
        }
      });
      at++;
    }
  }
  const out = new THREE.BufferGeometry();
  names.forEach((n, j) => out.setAttribute(n, new THREE.BufferAttribute(arrays[j], geo.attributes[n].itemSize)));
  return out;
}

/**
 * The far version of the farm's bush (#837): its leaves are 15 clumps, not cards, so every other clump is kept, grown to fill the gap (`thinClumps`),
 * with the same material. (Clustering it as the oak's trunk is smeared the leaf texture into smooth pale lumps that stood out of the hedge.)
 */
export function farBush(root) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const far = new THREE.Mesh(thinClumps(o.geometry), o.material);
    far.applyMatrix4(o.matrixWorld);
    group.add(far);
  });
  return group;
}

/** Triangles each mesh of a tree from the tree kit (landmarkProps.js: the pit's birch scrub, #1004) is simplified to far away. */
export const FAR_KIT_TRIANGLES = 140;

/**
 * The far version of a tree whose stems and leaf cards are one mesh (#1004: the tree kit's hawthorn, landmarkProps.js `hawthornModel`): the first
 * `geometry.userData.solid` triangles, the stems, simplified, and the cards after them thinned as the oak's are (`thinCards`), back in one mesh with the
 * same material, so a far tile is one draw as the near one is. A mesh without `solid` is done as `farTree` does it.
 */
export function farSprayTree(root) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const solid = o.geometry.userData.solid;
    let geo;
    if (solid === undefined) geo = o.material?.alphaTest > 0 ? thinCards(o.geometry) : simplifyGeometry(o.geometry);
    else {
      const part = (from, to) => {
        const g = new THREE.BufferGeometry();
        for (const [n, a] of Object.entries(o.geometry.attributes)) g.setAttribute(n, new THREE.BufferAttribute(a.array.slice(from * 3 * a.itemSize, to * 3 * a.itemSize), a.itemSize));
        return g;
      };
      const all = trianglesOf(o.geometry);
      const stems = simplifyGeometry(part(0, solid), 40).toNonIndexed();
      geo = mergeGeometries([stems, thinCards(part(solid, all))]);
    }
    const far = new THREE.Mesh(geo, o.material);
    far.applyMatrix4(o.matrixWorld);
    group.add(far);
  });
  return group;
}

/**
 * The far version of a tree from the tree kit (#1004): its bark and its leaf clumps, both opaque, each simplified by clustering (`simplifyGeometry`),
 * which keeps the crown's outline and its vertex colours: at 70 m a clump is a few pixels and a smoothed lump reads as one.
 */
export function farKitTree(root) {
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const far = new THREE.Mesh(simplifyGeometry(o.geometry, FAR_KIT_TRIANGLES), o.material);
    far.applyMatrix4(o.matrixWorld);
    group.add(far);
  });
  return group;
}
