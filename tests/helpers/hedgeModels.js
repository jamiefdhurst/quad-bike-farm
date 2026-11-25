import fs from 'node:fs';
import { leafReach } from '../../src/world/hedgeSolid.js';

// The hedge and bush models read straight from their .glb files, for the tests that lay hedges as the game does without Three.js's loader
// (hedgeColliders.test.js, farmPlacement.test.js).

/** The model's vertices as a stand-in the code reads (traverse, matrixWorld and a position attribute), straight from the .glb. */
export function glbModel(name) {
  const b = fs.readFileSync(new URL(`../../public/models/${name}.glb`, import.meta.url));
  const n = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + n).toString());
  const acc = j.accessors[j.meshes[0].primitives[0].attributes.POSITION];
  const view = j.bufferViews[acc.bufferView];
  const off = 20 + n + 8 + (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || 12;
  const sc = j.nodes.find((x) => x.mesh !== undefined).scale[0];
  const xyz = (i, k) => b.readFloatLE(off + i * stride + 4 * k) * sc;
  const verts = Array.from({ length: acc.count }, (_, i) => [xyz(i, 0), xyz(i, 1), xyz(i, 2)]);
  const position = { count: verts.length, getX: (i) => verts[i][0], getY: (i) => verts[i][1], getZ: (i) => verts[i][2] };
  const mesh = { isMesh: true, geometry: { attributes: { position } }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
  const lo = [0, 1, 2].map((k) => Math.min(...verts.map((v) => v[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...verts.map((v) => v[k])));
  return { root: { traverse: (f) => f(mesh) }, verts, size: { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] } };
}

/** The corners of the points' outline in plan (x, z): every limit checked here is a distance in a direction, so a corner is the farthest. */
export function outline(verts) {
  const pts = [...new Map(verts.map((v) => [`${v[0].toFixed(4)},${v[2].toFixed(4)}`, v])).values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
}

/** How far the hedge block's and the bush's leaves reach (hedgeSolid.js `leafReach`), as props.js works them out from the models: `{ block, bush }`. */
export function hedgeReach() {
  const hedge = glbModel('hedge');
  const bush = glbModel('bush');
  return { block: leafReach(hedge.root, hedge.size), bush: leafReach(bush.root, { x: bush.size.y, z: bush.size.y }) };
}
