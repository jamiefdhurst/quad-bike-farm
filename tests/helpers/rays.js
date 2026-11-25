// Quicker rays for the tests that fire thousands at a model (#1183).
//
// Three tests a ray against a mesh's bounding sphere and then, if the geometry has a bounding box, against that box, before it tries every
// triangle. It only makes the sphere for itself, and a sphere round a long thin part (a sill, a rail, a pillar) is mostly empty, so most of
// the time in these tests went on the triangles of parts the ray passed nowhere near. A box can only rule out a mesh the ray cannot hit, so
// the hits are the same; and should a box ever be stale, a ray would miss and the test would fail rather than pass.

/** Gives every mesh's geometry under `root` its bounding box, so three can pass over the meshes a ray misses. Returns `root`. */
export function boxEveryMesh(root) {
  root.traverse((o) => {
    if (o.isMesh && o.geometry && !o.geometry.boundingBox) o.geometry.computeBoundingBox();
  });
  return root;
}
