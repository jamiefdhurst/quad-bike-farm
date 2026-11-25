import * as THREE from 'three';

// Quicker rays for the tests that fire thousands at a model (#1183).
//
// Three tests a ray against a mesh's bounding sphere, then its bounding box if the geometry has one, and then against every triangle in
// it. A vehicle's merged parts are a few meshes of thousands of triangles that reach from end to end, so a ray anywhere near the vehicle
// tried every one of them: most of the time in the damage and hole tests went there. `quickRays` cuts each large mesh's triangles into runs
// of CHUNK in their own order, each with its own box, and has the mesh's raycast try only the runs whose box the ray passes through, by
// three's own raycast over that run (the geometry's draw range). A triangle in a run the ray misses cannot be hit, and the runs are tried in
// order, so the hits are the same ones in the same order as three's own (#1183 compared the rusty donors' damage to six places).

const CHUNK = 32 * 3; // indices in a run: 32 triangles
const _inverse = new THREE.Matrix4();
const _ray = new THREE.Ray();
const _v = new THREE.Vector3();

/** Gives every mesh under `root` a bounding box and every large one runs of triangles to raycast by. Call once the model is built. Returns `root`. */
export function quickRays(root) {
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    // Only a plain mesh of one material: a skinned or morphed mesh moves its vertices when drawn, an instanced one has its own raycast, and
    // one with several materials tries its triangles a group at a time.
    if (o.raycast !== THREE.Mesh.prototype.raycast || o.isSkinnedMesh || Array.isArray(o.material) || g.morphAttributes.position) return;
    const pos = g.attributes.position;
    const index = g.index;
    const n = index ? index.count : pos.count;
    if (n <= CHUNK * 2) return;
    const runs = [];
    for (let s = 0; s < n; s += CHUNK) {
      const e = Math.min(n, s + CHUNK);
      const box = new THREE.Box3();
      for (let j = s; j < e; j++) box.expandByPoint(_v.fromBufferAttribute(pos, index ? index.getX(j) : j));
      runs.push({ s, e, box });
    }
    const versions = [pos.version, index?.version];
    const whole = g.drawRange;
    const range = { start: 0, count: 0 };
    o.raycast = function (raycaster, intersects) {
      // Should the geometry change after this, the runs' boxes are out of date: three's own raycast, then.
      if (pos.version !== versions[0] || index?.version !== versions[1] || g.drawRange !== whole || whole.start % 3) return THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
      _inverse.copy(this.matrixWorld).invert();
      _ray.copy(raycaster.ray).applyMatrix4(_inverse);
      const from = whole.start;
      const to = Math.min(n, whole.start + whole.count);
      g.drawRange = range;
      try {
        for (const run of runs) {
          if (run.e <= from || run.s >= to || !_ray.intersectsBox(run.box)) continue;
          range.start = Math.max(run.s, from);
          range.count = Math.min(run.e, to) - range.start;
          THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
        }
      } finally {
        g.drawRange = whole;
      }
    };
  });
  return root;
}
