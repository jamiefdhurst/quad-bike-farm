import * as THREE from 'three';

// A hosepipe on a reel by the petrol tank, for washing the mud off the quads.
// Pick up the spray gun and the hose trails back to the reel; it only reaches
// so far. Holding E at a quad sprays it (the game does the washing).

export const DEFAULT_HOSE_PARAMS = {
  reach: 25, // metres of hose from the reel: enough to reach the yard
  washRange: 3.5, // metres; closer than this to a quad, the spray reaches it
  jetSpeed: 9, // m/s out of the nozzle
  jetRate: 260, // drops per second
};

export const HOSE_PARAM_RANGES = {
  reach: [3, 60, 0.5],
  washRange: [1, 10, 0.1],
  jetSpeed: [1, 25, 0.5],
  jetRate: [10, 800, 10],
};

const DROPS = 500;
const GRAVITY = 9.81;
const SAG_POINTS = 14;

function buildReel() {
  const g = new THREE.Group();
  g.name = 'hoseReel';
  const green = new THREE.MeshStandardMaterial({ color: 0x2f7a3a, roughness: 0.55 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.4, metalness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb08a3c, roughness: 0.35, metalness: 0.8 });
  // A post with a tap, and a wall-style reel on a frame.
  const post = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.1), new THREE.MeshStandardMaterial({ color: 0x6b5236, roughness: 0.9 }));
  post.position.y = 0.55;
  g.add(post);
  const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 10), brass);
  tap.rotation.x = Math.PI / 2;
  tap.position.set(0, 0.95, 0.1);
  g.add(tap);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), brass);
  handle.position.set(0, 1.0, 0.12);
  g.add(handle);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.6, 0.04), steel);
    leg.position.set(side * 0.16, 0.3, 0.25);
    g.add(leg);
  }
  const drum = new THREE.Group();
  drum.position.set(0, 0.55, 0.25);
  drum.rotation.z = Math.PI / 2;
  g.add(drum);
  drum.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.3, 16), steel));
  // Coils of hose on the drum.
  for (let i = 0; i < 5; i++) {
    const coil = new THREE.Mesh(new THREE.TorusGeometry(0.16 + (i % 2) * 0.025, 0.022, 8, 24), green);
    coil.rotation.x = Math.PI / 2;
    coil.position.y = -0.11 + i * 0.055;
    drum.add(coil);
  }
  for (const side of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.015, 20), green);
    rim.position.y = side * 0.16;
    drum.add(rim);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

function buildGun() {
  const g = new THREE.Group();
  g.name = 'hoseGun';
  const body = new THREE.MeshStandardMaterial({ color: 0xe0a020, roughness: 0.45 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.7 });
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.2, 10), body);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.1;
  g.add(barrel);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.12, 0.04), black);
  grip.position.set(0, -0.06, 0.0);
  grip.rotation.x = -0.25;
  g.add(grip);
  const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, 0.012), black);
  trigger.position.set(0, -0.04, -0.035);
  g.add(trigger);
  const tip = new THREE.Object3D();
  tip.name = 'nozzle';
  tip.position.z = -0.21;
  g.add(tip);
  return g;
}

/** A soft round drop. */
function dropTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 15);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(16, 16, 15, 0, Math.PI * 2);
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

export class Hose {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_HOSE_PARAMS } }) {
    this.scene = scene;
    this.world = world;
    this.params = params;
    this.reel = buildReel();
    this.reel.position.set(position.x, world.heightAt(position.x, position.z), position.z);
    this.reel.rotation.y = yaw;
    scene.add(this.reel);
    this.outlet = new THREE.Vector3(0, 0.55, 0.42).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw).add(this.reel.position);

    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, 0.7), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.set(0, 0.6, 0.15);
    this.reel.add(this.proxy);

    this.gun = buildGun();
    this.nozzle = this.gun.getObjectByName('nozzle');
    this.held = false;
    this.spraying = false;

    // The hose itself, sagging from the reel to your hand.
    this.linePoints = new Float32Array(SAG_POINTS * 3);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute('position', new THREE.BufferAttribute(this.linePoints, 3).setUsage(THREE.DynamicDrawUsage));
    this.line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x2f7a3a }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    // The jet: drops flying out of the nozzle under gravity.
    this.pos = new Float32Array(DROPS * 3);
    this.vel = new Float32Array(DROPS * 3);
    this.life = new Float32Array(DROPS);
    this.next = 0;
    this.toSpawn = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.drops = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xd8ecff, size: 0.028, map: dropTexture(), alphaTest: 0.3, transparent: true, opacity: 0.8, depthWrite: false }),
    );
    this.drops.frustumCulled = false;
    scene.add(this.drops);

    this.tmp = new THREE.Vector3();
    this.dir = new THREE.Vector3();
    this.hand = new THREE.Vector3();
  }

  /** In your right hand, in front of the camera. */
  pickUp(camera) {
    this.held = true;
    camera.add(this.gun);
    this.gun.position.set(0.17, -0.19, -0.34);
    this.gun.rotation.set(0.12, -0.18, 0);
    this.line.visible = true;
  }

  /** Back on the reel. */
  putBack() {
    this.held = false;
    this.spraying = false;
    this.gun.removeFromParent();
    this.line.visible = false;
  }

  /** How far your hand is from the reel. */
  distanceFrom(position) {
    return Math.hypot(position.x - this.outlet.x, position.z - this.outlet.z);
  }

  update(dt) {
    if (this.held) {
      this.nozzle.getWorldPosition(this.hand);
      // A sagging curve from the reel to your hand, lying on the ground in the middle.
      const a = this.outlet;
      const b = this.hand;
      for (let i = 0; i < SAG_POINTS; i++) {
        const t = i / (SAG_POINTS - 1);
        const x = a.x + (b.x - a.x) * t;
        const z = a.z + (b.z - a.z) * t;
        const ground = this.world.heightAt(x, z) + 0.03;
        const straight = a.y + (b.y - a.y) * t;
        const sag = Math.sin(Math.PI * t) * Math.max(0.3, Math.hypot(b.x - a.x, b.z - a.z) * 0.4);
        this.linePoints.set([x, Math.max(ground, straight - sag), z], i * 3);
      }
      this.line.geometry.attributes.position.needsUpdate = true;
    }

    // Spray: drops out of the nozzle, a little spread, falling.
    if (this.held && this.spraying) {
      this.nozzle.getWorldPosition(this.hand);
      this.nozzle.getWorldDirection(this.dir).negate();
      this.toSpawn += this.params.jetRate * dt;
      while (this.toSpawn >= 1) {
        this.toSpawn--;
        const i = this.next;
        this.next = (this.next + 1) % DROPS;
        const s = this.params.jetSpeed * (0.85 + Math.random() * 0.3);
        this.pos.set([this.hand.x, this.hand.y, this.hand.z], i * 3);
        this.vel.set(
          [
            this.dir.x * s + (Math.random() - 0.5) * 0.8,
            this.dir.y * s + (Math.random() - 0.5) * 0.8,
            this.dir.z * s + (Math.random() - 0.5) * 0.8,
          ],
          i * 3,
        );
        this.life[i] = 0.5 + Math.random() * 0.3;
      }
    }
    for (let i = 0; i < DROPS; i++) {
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = -1000;
        continue;
      }
      this.life[i] -= dt;
      this.vel[i * 3 + 1] -= GRAVITY * dt;
      for (let k = 0; k < 3; k++) this.pos[i * 3 + k] += this.vel[i * 3 + k] * dt;
      if (this.pos[i * 3 + 1] < this.world.heightAt(this.pos[i * 3], this.pos[i * 3 + 2])) this.life[i] = 0;
    }
    this.drops.geometry.attributes.position.needsUpdate = true;
  }
}
