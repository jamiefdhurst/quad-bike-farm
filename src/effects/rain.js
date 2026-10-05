import * as THREE from 'three';

// Rain falling around the camera: short streaks in a cylinder that moves with
// you, slanted by the wind. How many show is how hard it's raining.

const DROPS = 2400;
const RADIUS = 22; // metres around the camera
const HEIGHT = 16;
const FALL = 9.5; // m/s
const STREAK = 0.45; // metres long

export class Rain {
  constructor(scene) {
    this.pos = new Float32Array(DROPS * 6);
    this.drops = new Float32Array(DROPS * 3); // each drop's x, y, z relative to the camera
    for (let i = 0; i < DROPS; i++) this.respawn(i, Math.random() * HEIGHT);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xc4ccd2, transparent: true, opacity: 0.5, depthWrite: false }));
    this.lines.frustumCulled = false;
    this.lines.visible = false;
    scene.add(this.lines);
    this.wind = { x: 0.7, z: 0.3 };
  }

  respawn(i, y = HEIGHT) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    this.drops[i * 3] = Math.cos(a) * r;
    this.drops[i * 3 + 1] = y - HEIGHT * 0.35;
    this.drops[i * 3 + 2] = Math.sin(a) * r;
  }

  /** @param {number} level 0..1 how hard it's raining. @param {number} wind how windy (1 normal). @param {(x, z) => boolean} [covered] true under a roof: no rain falls there. */
  update(dt, camera, level, wind = 1, covered = null) {
    const count = Math.round(DROPS * Math.min(1, level));
    this.lines.visible = count > 0;
    if (!count) return;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;
    const wx = this.wind.x * wind * 2.2;
    const wz = this.wind.z * wind * 2.2;
    const sx = (wx / FALL) * STREAK;
    const sz = (wz / FALL) * STREAK;
    for (let i = 0; i < count; i++) {
      const k = i * 3;
      this.drops[k] += wx * dt;
      this.drops[k + 1] -= FALL * dt;
      this.drops[k + 2] += wz * dt;
      if (this.drops[k + 1] < -HEIGHT * 0.35 || Math.hypot(this.drops[k], this.drops[k + 2]) > RADIUS) this.respawn(i);
      const x = cx + this.drops[k];
      const y = cy + this.drops[k + 1];
      const z = cz + this.drops[k + 2];
      if (covered && covered(x, z)) this.pos.set([x, y, z, x, y, z], i * 6); // under a roof: no streak
      else this.pos.set([x, y, z, x - sx, y + STREAK, z - sz], i * 6);
    }
    this.lines.geometry.setDrawRange(0, count * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
  }
}
