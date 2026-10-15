import * as THREE from 'three';

// Where a vehicle wears (TODO 87): the edges where paint scuffs off and the nooks where rust starts and dried mud stays, worked out
// from the geometry once, so a shader (effects/wearLayer.js) can draw them without textures or UVs.
//
// Edges are per triangle: each of its three sides is marked convex (+, a corner that sticks out), concave (-, a fold in) or not a
// crease at all (a smooth surface, or a flat one), and each vertex carries its distance to the opposite side, which the GPU
// interpolates into the exact distance from any point to each side. So a thin band along a box's edge can be drawn however few
// triangles the box has. That needs every triangle's own vertices, so a geometry with creases comes back un-indexed; one without
// keeps its index and gets zeros. Nooks between separate parts (a bracket on a panel) are per vertex: how many points of another
// part are close in front of it (`bakeNooks`).

export const DEFAULT_WEAR_BAKE = {
  minAngle: 0.35, // radians between two faces before their shared side counts as a crease at all (about 20 degrees)
  fullAngle: 1.0, // radians at which it counts fully (about 57 degrees)
  openEdge: 0.5, // how much the free edge of a sheet (a side with one triangle) counts, as a convex edge
  nookReach: 0.03, // metres: another part's surface this close in front of a point makes it a nook
  nookCount: 4, // how many of the other part's points in reach make it a full nook
};

/** wearDist is packed as 16-bit fractions of this many metres (a side further than that from a vertex is clamped). */
export const WEAR_DIST_RANGE = 4;

const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Welds vertices at the same place (to 0.01 mm), so the sides of separately-normalled faces are found as shared. */
function weld(pos) {
  const ids = new Int32Array(pos.count);
  const map = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${Math.round(pos.getX(i) * 1e5)},${Math.round(pos.getY(i) * 1e5)},${Math.round(pos.getZ(i) * 1e5)}`;
    let id = map.get(key);
    if (id === undefined) map.set(key, (id = map.size));
    ids[i] = id;
  }
  return { ids, count: map.size };
}

/**
 * Marks each side of each triangle convex, concave or neither, as `creases` (Float32Array, three per triangle, -1..1) and returns
 * them with the triangle count. Pure apart from reading the geometry; exported for its test.
 */
export function findCreases(geometry, params = DEFAULT_WEAR_BAKE) {
  const pos = geometry.attributes.position;
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  const nrm = geometry.attributes.normal;
  const index = geometry.index;
  const triCount = index ? index.count / 3 : pos.count / 3;
  const vert = (t, k) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const { ids, count: welds } = weld(pos);
  const faceN = new Float32Array(triCount * 3);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edges = new Map();
  for (let t = 0; t < triCount; t++) {
    a.fromBufferAttribute(pos, vert(t, 0));
    b.fromBufferAttribute(pos, vert(t, 1));
    c.fromBufferAttribute(pos, vert(t, 2));
    b.sub(a);
    c.sub(a);
    a.crossVectors(b, c);
    const len = a.length();
    if (len > 1e-14) a.divideScalar(len);
    faceN.set([a.x, a.y, a.z], t * 3);
    for (let i = 0; i < 3; i++) {
      const w1 = ids[vert(t, (i + 1) % 3)];
      const w2 = ids[vert(t, (i + 2) % 3)];
      if (w1 === w2) continue;
      const key = Math.min(w1, w2) * welds + Math.max(w1, w2);
      const list = edges.get(key);
      if (list) list.push(t * 3 + i);
      else edges.set(key, [t * 3 + i]);
    }
  }
  const creases = new Float32Array(triCount * 3);
  const n1 = new THREE.Vector3();
  const n2 = new THREE.Vector3();
  const opp = new THREE.Vector3();
  const on = new THREE.Vector3();
  let any = false;
  for (const list of edges.values()) {
    if (list.length === 1) {
      creases[list[0]] = params.openEdge;
      any = any || params.openEdge > 0;
      continue;
    }
    for (const se of list) {
      const t = Math.floor(se / 3);
      const i = se % 3;
      // The other triangle on this side (a seam with more than two takes the first other).
      const ue = list.find((x) => Math.floor(x / 3) !== t);
      if (ue === undefined) continue;
      const u = Math.floor(ue / 3);
      const j = ue % 3;
      // The same normals either side at both ends: one smooth surface, however sharply its faces turn.
      const tv1 = vert(t, (i + 1) % 3);
      const tv2 = vert(t, (i + 2) % 3);
      const pick = (w) => (ids[vert(u, (j + 1) % 3)] === w ? vert(u, (j + 1) % 3) : vert(u, (j + 2) % 3));
      const uv1 = pick(ids[tv1]);
      const uv2 = pick(ids[tv2]);
      if (n1.fromBufferAttribute(nrm, tv1).dot(n2.fromBufferAttribute(nrm, uv1)) > 0.999 && n1.fromBufferAttribute(nrm, tv2).dot(n2.fromBufferAttribute(nrm, uv2)) > 0.999) continue;
      n1.fromArray(faceN, t * 3);
      n2.fromArray(faceN, u * 3);
      const angle = Math.acos(Math.min(1, Math.max(-1, n1.dot(n2))));
      const strength = smooth(params.minAngle, params.fullAngle, angle);
      if (strength <= 0) continue;
      // Convex if the other face falls away behind this one's plane.
      opp.fromBufferAttribute(pos, vert(u, j));
      on.fromBufferAttribute(pos, tv1);
      creases[se] = n1.dot(opp.sub(on)) < 0 ? strength : -strength;
      any = true;
    }
  }
  return { creases, triCount, any };
}

/**
 * The wear attributes for one geometry: `wearCrease` (each triangle's three sides, -1 concave .. 1 convex, the same at its three
 * vertices) and `wearDist` (each vertex's distance to the side opposite it, in that component; 0 in the others), plus a zeroed
 * `wearNook` for `bakeNooks`. Returns a new un-indexed geometry if anything is a crease, else the same one with zeroed attributes.
 */
export function bakeWear(geometry, params = DEFAULT_WEAR_BAKE) {
  const { creases, triCount, any } = findCreases(geometry, params);
  if (!any) {
    const n = geometry.attributes.position.count;
    geometry.setAttribute('wearCrease', new THREE.BufferAttribute(new Int8Array(n * 3), 3, true));
    geometry.setAttribute('wearDist', new THREE.BufferAttribute(new Uint16Array(n * 3), 3, true));
    geometry.setAttribute('wearNook', new THREE.BufferAttribute(new Uint8Array(n), 1, true));
    return geometry;
  }
  const g = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const pos = g.attributes.position;
  // Packed small: the creases as signed bytes, the distances as 16-bit fractions of WEAR_DIST_RANGE (both normalised, so the
  // shader reads -1..1 and 0..1).
  const crease = new Int8Array(triCount * 9);
  const dist = new Uint16Array(triCount * 9);
  const p = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const e = new THREE.Vector3();
  const f = new THREE.Vector3();
  for (let t = 0; t < triCount; t++) {
    for (let k = 0; k < 3; k++) p[k].fromBufferAttribute(pos, t * 3 + k);
    const area2 = e.subVectors(p[1], p[0]).cross(f.subVectors(p[2], p[0])).length();
    for (let k = 0; k < 3; k++) {
      const side = p[(k + 1) % 3].distanceTo(p[(k + 2) % 3]);
      const alt = side > 1e-9 ? area2 / side : 0;
      for (let v = 0; v < 3; v++) crease[(t * 3 + v) * 3 + k] = Math.round(creases[t * 3 + k] * 127);
      dist[(t * 3 + k) * 3 + k] = Math.round(Math.min(1, alt / WEAR_DIST_RANGE) * 65535);
    }
  }
  g.setAttribute('wearCrease', new THREE.BufferAttribute(crease, 3, true));
  g.setAttribute('wearDist', new THREE.BufferAttribute(dist, 3, true));
  g.setAttribute('wearNook', new THREE.BufferAttribute(new Uint8Array(pos.count), 1, true));
  return g;
}

/**
 * Nooks between parts: for each vertex of each mesh, how many points of other parts lie within `nookReach` in front of it, as
 * 0..1 in its `wearNook`. `meshes` are { geometry, matrix, nookMin? } (`nookMin`: a floor of patchy grime for a part marked up without a neighbour) with the matrix into one shared frame (the vehicle's), and every
 * geometry already through `bakeWear`. Two meshes are different parts; so are two pieces of one merged mesh that share no vertex.
 */
export function bakeNooks(meshes, params = DEFAULT_WEAR_BAKE) {
  for (const _ of bakeNooksSteps(meshes, params));
}

/** A steady 0..1 from a point's place (to a centimetre), the same every time. */
export function hash01(x, y, z) {
  let h = (Math.round(x * 100) * 73856093) ^ (Math.round(y * 100) * 19349663) ^ (Math.round(z * 100) * 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** `bakeNooks` a mesh at a time: yields after each, so it can be spread over frames. */
export function* bakeNooksSteps(meshes, params = DEFAULT_WEAR_BAKE) {
  const r = params.nookReach;
  const cell = (x) => Math.floor(x / r);
  const hash = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0; // cells that collide only cost a few distance checks
  const grid = new Map();
  const world = [];
  const v = new THREE.Vector3();
  meshes.forEach(({ geometry, matrix }, m) => {
    const pos = geometry.attributes.position;
    const part = pieces(geometry);
    const pts = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(matrix);
      pts.set([v.x, v.y, v.z], i * 3);
      const key = hash(cell(v.x), cell(v.y), cell(v.z));
      const owner = m * 1e6 + part[i];
      const list = grid.get(key);
      if (list) list.push(v.x, v.y, v.z, owner);
      else grid.set(key, [v.x, v.y, v.z, owner]);
    }
    world.push({ pts, part, m });
  });
  yield;
  const nrm = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();
  for (let m = 0; m < meshes.length; m++) {
    const { geometry, matrix } = meshes[m];
    const { pts, part } = world[m];
    const nook = geometry.attributes.wearNook.array;
    const nAttr = geometry.attributes.normal;
    normalMatrix.getNormalMatrix(matrix);
    for (let i = 0; i < pts.length / 3; i++) {
      const x = pts[i * 3];
      const y = pts[i * 3 + 1];
      const z = pts[i * 3 + 2];
      nrm.fromBufferAttribute(nAttr, i).applyMatrix3(normalMatrix).normalize();
      const own = m * 1e6 + part[i];
      let hits = 0;
      const cx = cell(x);
      const cy = cell(y);
      const cz = cell(z);
      for (let dx = -1; dx <= 1 && hits < params.nookCount; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const list = grid.get(hash(cx + dx, cy + dy, cz + dz));
        if (!list) continue;
        for (let q = 0; q < list.length && hits < params.nookCount; q += 4) {
          if (list[q + 3] === own) continue;
          const ox = list[q] - x;
          const oy = list[q + 1] - y;
          const oz = list[q + 2] - z;
          const d2 = ox * ox + oy * oy + oz * oz;
          // In front of the surface (a part sitting on it), not behind it (the part it is fixed through).
          if (d2 < r * r && ox * nrm.x + oy * nrm.y + oz * nrm.z > -0.002) hits++;
        }
      }
      let n = Math.min(1, hits / params.nookCount);
      // A part that is marked up without anything crowding it (a seat that is sat on, not squeezed): patchy grime from a hash of the vertex.
      if (meshes[m].nookMin) n = Math.max(n, meshes[m].nookMin * hash01(x, y, z));
      nook[i] = Math.round(n * 255);
    }
    geometry.attributes.wearNook.needsUpdate = true;
    yield;
  }
}

/**
 * Bakes a whole vehicle a piece at a time (a generator: each `next()` is one mesh's creases, or one mesh's nooks), swapping each
 * mesh's geometry for its baked one. `frame` is the object whose space the nooks are found in (the vehicle's root); meshes for
 * which `skip(mesh)` is true are left alone. A geometry used twice in one vehicle gets its own nooks for each use.
 */
export function* bakeModelSteps(frame, skip = () => false, params = DEFAULT_WEAR_BAKE) {
  frame.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(frame.matrixWorld).invert();
  const meshes = [];
  frame.traverse((o) => {
    if (o.isMesh && !o.isInstancedMesh && !skip(o) && o.geometry.attributes.position && !o.geometry.attributes.wearCrease) meshes.push(o);
  });
  const done = new Map();
  const list = [];
  for (const mesh of meshes) {
    let g = done.get(mesh.geometry);
    if (!g) {
      g = bakeWear(mesh.geometry, params);
      done.set(mesh.geometry, g);
    } else {
      // Shared: the same buffers, its own nooks.
      const own = new THREE.BufferGeometry();
      for (const [k, a] of Object.entries(g.attributes)) own.setAttribute(k, a);
      own.setAttribute('wearNook', new THREE.BufferAttribute(new Uint8Array(g.attributes.position.count), 1, true));
      if (g.index) own.setIndex(g.index);
      g = own;
    }
    mesh.geometry = g;
    list.push({ geometry: g, matrix: new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld), nookMin: mesh.userData.wearNookMin ?? 0 });
    yield;
  }
  yield* bakeNooksSteps(list, params);
}

/** Which connected piece each vertex of a (possibly merged) geometry belongs to, joining vertices at the same place. */
export function pieces(geometry) {
  const pos = geometry.attributes.position;
  const { ids, count } = weld(pos);
  const parent = new Int32Array(count).map((_, i) => i);
  const find = (x) => {
    while (parent[x] !== x) x = parent[x] = parent[parent[x]];
    return x;
  };
  const index = geometry.index;
  const n = index ? index.count : pos.count;
  for (let t = 0; t < n; t += 3) {
    const a = find(ids[index ? index.getX(t) : t]);
    for (let k = 1; k < 3; k++) {
      const b = find(ids[index ? index.getX(t + k) : t + k]);
      if (a !== b) parent[b] = a;
    }
  }
  const out = new Int32Array(pos.count);
  for (let i = 0; i < pos.count; i++) out[i] = find(ids[i]);
  return out;
}
