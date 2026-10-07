import * as THREE from 'three';

// The look of the yard's haze (world/haze.js decides how thick): a dozen big soft blobs hung low over the yard, drifting slowly
// with the wind. Sprites rather than points, since point sprites are capped in size and these are metres across.

const COUNT = 14;

function blobTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export class HazeLayer {
  // `look` reshapes it: blob size [min, spread], height above the ground [min, spread] and how far each wanders (the barn's is small and low-roofed).
  constructor(scene, yard, radius, random = Math.random, look = {}) {
    const { size = [9, 8], height = [1, 2.2], wander = 5 } = look;
    this.wander = wander;
    this.yard = yard;
    this.radius = radius;
    this.time = 0;
    const map = blobTexture();
    this.blobs = [];
    for (let i = 0; i < COUNT; i++) {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, color: 0xaeb9c8, transparent: true, opacity: 0, depthWrite: false }));
      const a = random() * Math.PI * 2;
      const r = Math.sqrt(random()) * radius;
      sprite.scale.setScalar(size[0] + random() * size[1]);
      sprite.renderOrder = 1;
      sprite.visible = false;
      scene.add(sprite);
      this.blobs.push({ sprite, a, r, y: height[0] + random() * height[1], phase: random() * 6.28, speed: 0.6 + random() * 0.8 });
    }
  }

  /** `level` 0..1 and the smoke's drift in m/s; `ground(x, z)` is the terrain height. */
  update(dt, level, windX, windZ, ground, maxOpacity = 0.24) {
    this.time += dt;
    const on = level > 0.02;
    for (const b of this.blobs) {
      b.sprite.visible = on;
      if (!on) continue;
      // Each blob wanders slowly round its place, and the whole lot creeps downwind and back.
      const t = this.time * 0.05 * b.speed + b.phase;
      const x = this.yard.x + Math.cos(b.a) * b.r + Math.sin(t) * this.wander + windX * 6 * Math.sin(this.time * 0.02 + b.phase);
      const z = this.yard.z + Math.sin(b.a) * b.r + Math.cos(t * 0.8) * this.wander + windZ * 6 * Math.sin(this.time * 0.02 + b.phase);
      b.sprite.position.set(x, ground(x, z) + b.y, z);
      b.sprite.material.opacity = Math.min(1, level) * maxOpacity * (0.75 + 0.25 * Math.sin(t * 2));
    }
  }
}
