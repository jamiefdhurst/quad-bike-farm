import * as THREE from 'three';

// Bits both trailers share, so the big and the small one are dressed alike: a wheel with a treaded tyre and nuts, a curved mudguard
// with a flap, a coupling for the drawbar, a jockey wheel, and lamps. Everything is procedural and built from the trailer's own
// measurements, so changing a model's look never moves a seat, a collider or a cargo spot.

export const PART_MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  paint: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.6, metalness: 0.3 }), // chassis green, a bit chipped looking
  galv: new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.45, metalness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  tread: new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 1 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.6 }),
  nut: new THREE.MeshStandardMaterial({ color: 0x777b7d, roughness: 0.4, metalness: 0.7 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6e4a33, roughness: 0.9, metalness: 0.2 }),
  flap: new THREE.MeshStandardMaterial({ color: 0x232221, roughness: 0.95 }),
  red: new THREE.MeshStandardMaterial({ color: 0xaa1111, roughness: 0.4, emissive: 0x330000 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xcc7a10, roughness: 0.4, emissive: 0x2a1500 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xe8d34a, roughness: 0.5 }),
};

export function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * A wheel group named `name` at (x, radius, 0) with a child group `spin` that the game turns. The tyre has rounded shoulders and a ring
 * of tread blocks, the rim a dish, a hub cap and five nuts, and one block is bigger so the turn shows. `width` is the tyre's.
 */
export function buildWheel(name, x, radius, width) {
  const w = new THREE.Group();
  w.name = name;
  w.position.set(x, radius, 0);
  const spin = new THREE.Group();
  spin.name = 'spin';
  w.add(spin);

  const tyre = new THREE.Mesh(new THREE.CylinderGeometry(radius - 0.02, radius - 0.02, width, 20), PART_MAT.rubber);
  tyre.rotation.z = Math.PI / 2;
  spin.add(tyre);
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.TorusGeometry(radius - 0.04, width * 0.14, 6, 20), PART_MAT.rubber);
    shoulder.rotation.y = Math.PI / 2;
    shoulder.position.x = (s * (width - width * 0.28)) / 2;
    spin.add(shoulder);
  }
  const blocks = 14;
  for (let i = 0; i < blocks; i++) {
    const a = (i / blocks) * Math.PI * 2;
    const b = box(width * 0.9, 0.035, radius * 0.2, PART_MAT.tread, 0, Math.cos(a) * (radius + 0.005), Math.sin(a) * (radius + 0.005), spin);
    b.rotation.x = -a + Math.PI / 2 + (i % 2 ? 0.0 : 0);
    b.castShadow = false;
    b.receiveShadow = false;
  }

  const rimR = radius * 0.62;
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 1.02, 14), PART_MAT.rim);
  dish.rotation.z = Math.PI / 2;
  spin.add(dish);
  const side = Math.sign(x) || 1;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.3, radius * 0.34, 0.05, 12), PART_MAT.nut);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = side * (width / 2 + 0.01);
  spin.add(cap);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.03, 6), PART_MAT.nut);
    nut.rotation.z = Math.PI / 2;
    nut.position.set(side * (width / 2 + 0.03), Math.cos(a) * radius * 0.45, Math.sin(a) * radius * 0.45);
    spin.add(nut);
  }
  const lug = box(width * 0.95, 0.05, radius * 0.3, PART_MAT.steel, 0, radius - 0.01, 0, spin); // so the spin shows
  lug.castShadow = false;
  spin.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return w;
}

/** A curved mudguard over a wheel at `x`, `radius` high, with a flap hanging off the back (+Z is towards the puller, so the back is -Z). */
export function addMudguard(parent, x, radius, width, mat) {
  const r = radius + 0.07;
  const geo = new THREE.CylinderGeometry(r, r, width, 20, 1, true, Math.PI / 2 - 1.15, 2.3);
  geo.rotateZ(Math.PI / 2); // axis along X; height is r sin(theta), forward is r cos(theta)
  const guard = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, metalness: mat.metalness, side: THREE.DoubleSide }));
  guard.position.set(x, radius, 0);
  guard.castShadow = true;
  guard.receiveShadow = true;
  parent.add(guard);
  // Rolled lip on the outside edge, and the flap.
  const lipSide = Math.sign(x) || 1;
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.025, 20, 1, true, Math.PI / 2 - 1.15, 2.3), guard.material);
  lip.geometry.rotateZ(Math.PI / 2);
  lip.position.set(x + (lipSide * width) / 2, radius, 0);
  parent.add(lip);
  const flap = box(width * 0.9, radius * 0.7, 0.02, PART_MAT.flap, x, radius * 0.75, -Math.cos(Math.PI / 2 - 1.15) * r - 0.04, parent);
  flap.rotation.x = 0.08;
}

/** A pair of rear lamps (red), amber reflectors and a plate-shaped board, on a group at the back. `halfWidth` is where the lamps sit. */
export function addRearLights(parent, halfWidth, y, z, withPlate = true) {
  for (const s of [-1, 1]) {
    box(0.1, 0.06, 0.04, PART_MAT.red, s * halfWidth, y, z, parent);
    box(0.05, 0.04, 0.03, PART_MAT.amber, s * halfWidth, y + 0.07, z, parent);
  }
  if (withPlate) box(0.3, 0.1, 0.015, PART_MAT.plate, 0, y - 0.02, z - 0.01, parent);
}

/** A jockey wheel on a post under the drawbar at `z`, wound up clear of the ground, with its crank handle. `y` is where the post meets the drawbar. */
export function addJockeyWheel(parent, x, y, z) {
  // Wound up off the ground while it is hitched: the wheel hangs 0.18 m clear.
  const lift = 0.25;
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, y - lift, 8), PART_MAT.steel);
  post.position.set(x, lift + (y - lift) / 2, z);
  post.castShadow = true;
  parent.add(post);
  const crank = box(0.14, 0.02, 0.02, PART_MAT.steel, x + 0.06, y * 0.85, z, parent);
  crank.castShadow = false;
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12), PART_MAT.rubber);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(x, lift - 0.04, z);
  wheel.castShadow = true;
  parent.add(wheel);
}
