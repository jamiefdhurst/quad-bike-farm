import * as THREE from 'three';

// Snow falling around the camera: soft flakes in a cylinder that moves with you, drifting down slowly and swaying, slanted by the
// wind. How many show is how hard it's snowing. Rain's cousin (rain.js).

const FLAKES = 1800;
const RADIUS = 20; // metres around the camera
const HEIGHT = 14;
const FALL = 1.4; // m/s
const SWAY = 0.6; // metres of side-to-side drift

export class Snow {
  constructor(scene) {
    this.pos = new Float32Array(FLAKES * 3);
    this.flakes = new Float32Array(FLAKES * 4); // each flake's x, y, z relative to the camera, and its own sway phase
    for (let i = 0; i < FLAKES; i++) this.respawn(i, Math.random() * HEIGHT);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xf2f5f8, size: 0.09, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.wind = { x: 0.7, z: 0.3 };
    this.time = 0;
  }

  respawn(i, y = HEIGHT) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * RADIUS;
    this.flakes[i * 4] = Math.cos(a) * r;
    this.flakes[i * 4 + 1] = y - HEIGHT * 0.35;
    this.flakes[i * 4 + 2] = Math.sin(a) * r;
    this.flakes[i * 4 + 3] = Math.random() * Math.PI * 2;
  }

  /** @param {number} level 0..1 how hard it's snowing. @param {number} wind how windy (1 normal). @param {(x, z) => boolean} [covered] true under a roof: no snow falls there. */
  update(dt, camera, level, wind = 1, covered = null) {
    const count = Math.round(FLAKES * Math.min(1, level));
    this.points.visible = count > 0;
    if (!count) return;
    this.time += dt;
    const { x: cx, y: cy, z: cz } = camera.position;
    const wx = this.wind.x * wind * 1.2;
    const wz = this.wind.z * wind * 1.2;
    for (let i = 0; i < count; i++) {
      const k = i * 4;
      const phase = this.flakes[k + 3];
      this.flakes[k] += (wx + Math.cos(this.time * 0.9 + phase) * SWAY) * dt;
      this.flakes[k + 1] -= FALL * (0.7 + 0.6 * ((phase * 7) % 1)) * dt;
      this.flakes[k + 2] += (wz + Math.sin(this.time * 0.7 + phase) * SWAY) * dt;
      if (this.flakes[k + 1] < -HEIGHT * 0.35 || Math.hypot(this.flakes[k], this.flakes[k + 2]) > RADIUS) this.respawn(i);
      const x = cx + this.flakes[k];
      const z = cz + this.flakes[k + 2];
      // Under a roof the flake is parked on the camera, where it is too close to draw as anything.
      if (covered && covered(x, z)) this.pos.set([cx, cy - 50, cz], i * 3);
      else this.pos.set([x, cy + this.flakes[k + 1], z], i * 3);
    }
    this.points.geometry.setDrawRange(0, count);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
