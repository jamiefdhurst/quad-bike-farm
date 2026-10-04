import * as THREE from 'three';

export const DEFAULT_JERRY_CAN_PARAMS = {
  capacity: 20, // litres
  startLitres: 20,
  pourRate: 0.5, // litres per second into a quad
  fillRate: 0.8, // litres per second from the fuel tank
};

export const JERRY_CAN_PARAM_RANGES = {
  capacity: [5, 40, 0.5],
  startLitres: [0, 40, 0.5],
  pourRate: [0.05, 5, 0.05],
  fillRate: [0.05, 5, 0.05],
};

const HEIGHT = 0.46;

function buildModel() {
  const g = new THREE.Group();
  g.name = 'jerryCan';
  const red = new THREE.MeshStandardMaterial({ color: 0xc4231a, roughness: 0.5, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x8c1812, roughness: 0.55, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.4, metalness: 0.7 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, HEIGHT - 0.04, 0.165), red);
  body.position.y = (HEIGHT - 0.04) / 2;
  g.add(body);
  // The pressed X on each side.
  for (const z of [-0.084, 0.084]) {
    for (const a of [0.9, -0.9]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.022, 0.006), dark);
      rib.position.set(0, (HEIGHT - 0.04) / 2, z);
      rib.rotation.z = a;
      rib.scale.x = 0.95;
      g.add(rib);
    }
  }
  // Three handles along the top.
  for (const x of [-0.1, 0, 0.1]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.05, 0.14), red);
    h.position.set(x, HEIGHT - 0.02, 0);
    g.add(h);
  }
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.016, 0.03), red);
  grip.position.set(0, HEIGHT + 0.004, 0);
  g.add(grip);
  // Spout cap at the front corner.
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.05, 12), steel);
  spout.position.set(0.14, HEIGHT - 0.02, 0);
  spout.rotation.z = -0.35;
  spout.name = 'spout';
  g.add(spout);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/**
 * A 20 litre jerry can. It sits on the ground until picked up, then rides in
 * front of the camera and tips forward while it's pouring.
 */
export class JerryCan {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_JERRY_CAN_PARAMS } }) {
    this.scene = scene;
    this.world = world;
    this.params = params;
    this.litres = Math.min(params.startLitres, params.capacity);
    this.model = buildModel();
    this.proxy = new THREE.Mesh(
      new THREE.BoxGeometry(0.45, 0.6, 0.3),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    this.proxy.position.y = 0.25;
    this.model.add(this.proxy);
    this.held = false;
    this.tilt = 0;
    this.pouring = false;
    this.putDown(position, yaw);
  }

  get space() {
    return this.params.capacity - this.litres;
  }

  putDown(position, yaw) {
    this.held = false;
    this.scene.add(this.model);
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
    this.model.scale.setScalar(1);
    this.proxy.visible = false;
  }

  /** Carried in front of the camera, low and to the right. */
  pickUp(camera) {
    this.held = true;
    camera.add(this.model);
    this.model.position.set(0.3, -0.62, -0.55);
    this.model.rotation.set(0, Math.PI / 2 + 0.25, 0);
  }

  /** Takes up to `wanted` litres out; returns how much came out. */
  take(wanted) {
    const out = Math.max(0, Math.min(wanted, this.litres));
    this.litres -= out;
    return out;
  }

  fill(litres) {
    const added = Math.max(0, Math.min(litres, this.space));
    this.litres += added;
    return added;
  }

  update(dt) {
    // Tip forward while pouring.
    const target = this.held && this.pouring ? -1.0 : 0;
    this.tilt += (target - this.tilt) * Math.min(1, 6 * dt);
    if (this.held) {
      this.model.rotation.set(0, Math.PI / 2 + 0.25, 0);
      this.model.rotateZ(this.tilt);
    }
    this.pouring = false;
  }
}
