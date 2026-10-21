import * as THREE from 'three';

// The feed bucket and the bin it is filled from (the feeding job, world/farmAnimals.js). The bucket starts empty beside the bin against the
// barn's north wall; hold E at the bin with it in your hands to fill it, carry it to the hens' run or the pig's sty and hold E there to
// feed them over the fence. One full bucket does both. G puts it down.

export const DEFAULT_FEED_BUCKET_PARAMS = {
  fillSeconds: 3, // holding E at the bin fills an empty bucket in this long
};

export const FEED_BUCKET_PARAM_RANGES = {
  fillSeconds: [0.5, 20, 0.5],
};

const BUCKET_H = 0.26;
const GRAIN_TOP = 0.2; // how high the feed lies in a full bucket

function buildBucket() {
  const g = new THREE.Group();
  g.name = 'feedBucket';
  const tin = new THREE.MeshStandardMaterial({ color: 0x8c9096, roughness: 0.45, metalness: 0.5 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x6f7378, roughness: 0.5, metalness: 0.5 });
  const grain = new THREE.MeshStandardMaterial({ color: 0xc9a553, roughness: 0.95 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.12, BUCKET_H, 18, 1, true), tin);
  body.position.y = BUCKET_H / 2;
  g.add(body);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.01, 18), tin);
  base.position.y = 0.005;
  g.add(base);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.008, 6, 20), rim);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = BUCKET_H;
  g.add(lip);
  // The handle, a half hoop over the top.
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.007, 6, 16, Math.PI), rim);
  handle.position.y = BUCKET_H;
  g.add(handle);
  // The feed: a disc whose height follows how much there is (body is open-topped, so it shows from above).
  const level = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.01, 18), grain);
  g.add(level);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return { group: g, level };
}

export class FeedBucket {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_FEED_BUCKET_PARAMS } }) {
    this.params = params;
    const built = buildBucket();
    this.model = built.group;
    this.level = built.level;
    this.scene = scene;
    this.world = world;
    this.held = false;
    this.feed = 0; // 0 empty .. 1 full
    this.putDown(position, yaw);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.2;
    this.model.add(this.proxy);
    this.setFeed(0);
  }

  get full() {
    return this.feed >= 0.999;
  }

  get empty() {
    return this.feed <= 0.0001;
  }

  setFeed(v) {
    this.feed = Math.max(0, Math.min(1, v));
    this.level.visible = this.feed > 0.001;
    this.level.position.y = 0.02 + (GRAIN_TOP - 0.02) * this.feed;
  }

  /** Holding E at the bin: fills it. Returns whether any went in. */
  fill(dt) {
    if (this.full) return false;
    this.setFeed(this.feed + dt / this.params.fillSeconds);
    return true;
  }

  /** Takes `amount` out (it went to the animals). */
  use(amount) {
    this.setFeed(this.feed - amount);
  }

  putDown(position, yaw) {
    this.held = false;
    this.scene.add(this.model);
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
  }

  /** Carried low in front of the camera, to the right, where the cans go. */
  pickUp(camera) {
    this.held = true;
    camera.add(this.model);
    this.model.position.set(0.38, -0.62, -0.7);
    this.model.rotation.set(0.1, 0.5, 0);
  }

  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}

/** The feed bin: a galvanised bin with a lid, stood against the wall. Hold E at it with the bucket to fill it. */
export class FeedBin {
  constructor({ scene, world, position, yaw = 0 }) {
    const g = new THREE.Group();
    g.name = 'feedBin';
    const tin = new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 0.5, metalness: 0.5 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x5f6469, roughness: 0.55, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.8, 20), tin);
    body.position.y = 0.4;
    g.add(body);
    for (const y of [0.2, 0.6]) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.305, 0.305, 0.03, 20), dark);
      rib.position.y = y;
      g.add(rib);
    }
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.04, 20), tin);
    lid.position.y = 0.82;
    g.add(lid);
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 10), dark);
    knob.position.y = 0.86;
    g.add(knob);
    g.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.model = g;
    this.model.position.set(position.x, world.heightAt(position.x, position.z), position.z);
    this.model.rotation.y = yaw;
    scene.add(g);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.5;
    this.model.add(this.proxy);
  }
}
