import * as THREE from 'three';

// A handful of straw tipped on your head from the hayloft: a few dozen short stalks that drift down over a second or two
// and stay on the floor. Cosmetic only.

const COUNT = 36;
const FALL_TIME = 1.6;

export class StrawFall {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.visible = false;
    const geo = new THREE.BoxGeometry(0.35, 0.012, 0.03);
    const mats = [0xc9a54a, 0xb08d3a].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    this.bits = [];
    for (let i = 0; i < COUNT; i++) {
      const mesh = new THREE.Mesh(geo, mats[i % 2]);
      this.group.add(mesh);
      this.bits.push({ mesh, v: new THREE.Vector3(), spin: 0 });
    }
    this.time = 0;
    this.floorY = 0;
    scene.add(this.group);
  }

  /** Tips it from `from` (the edge it's tipped from) over `at` (where you stand); `floorY` is where it lands. */
  drop(from, at, floorY) {
    this.time = 0;
    this.floorY = floorY;
    this.group.visible = true;
    for (const b of this.bits) {
      b.mesh.position.set(from.x + (Math.random() - 0.5) * 0.6, from.y + Math.random() * 0.3, from.z + (Math.random() - 0.5) * 0.6);
      b.mesh.rotation.set(Math.random() * 3, Math.random() * 6, Math.random() * 3);
      b.v.set((at.x - from.x) * 0.5 + (Math.random() - 0.5) * 0.8, -0.2 - Math.random() * 0.4, (at.z - from.z) * 0.5 + (Math.random() - 0.5) * 0.8);
      b.spin = (Math.random() - 0.5) * 6;
    }
  }

  update(dt) {
    if (!this.group.visible) return;
    this.time += dt;
    for (const b of this.bits) {
      const m = b.mesh;
      if (m.position.y <= this.floorY + 0.01) continue;
      // Light things: they drift down at a fall speed of about 1.5 m/s rather than accelerating.
      b.v.y = Math.max(b.v.y - 3 * dt, -1.5);
      b.v.x *= 1 - Math.min(1, dt * 1.5);
      b.v.z *= 1 - Math.min(1, dt * 1.5);
      m.position.addScaledVector(b.v, dt);
      m.rotation.y += b.spin * dt;
      if (m.position.y < this.floorY + 0.01) m.position.y = this.floorY + 0.01;
    }
    if (this.time > FALL_TIME + 60) this.group.visible = false; // the scatter is swept away a minute later
  }
}
