import * as THREE from 'three';

// A bundle of hedge cuttings, tied with twine, lying by the south hedge. Pick one up with E (empty-handed), carry it to the bonfire site and
// press E there to put it on the pile, or put it down with G. Three make a fire (world/bonfire.js).

const wood = [0x5b4128, 0x6b4d30, 0x4a3522, 0x7a5a3a].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 }));
const twine = new THREE.MeshStandardMaterial({ color: 0xb59a52, roughness: 0.9 });
const leaf = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, roughness: 1 });

/** A bundle of sticks about a metre long, with a few leaves left on and a loop of twine round the middle. */
export function buildBundle(random = Math.random) {
  const g = new THREE.Group();
  g.name = 'brushwood';
  for (let i = 0; i < 16; i++) {
    const len = 0.85 + random() * 0.35;
    const r = 0.008 + random() * 0.014;
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.7, r, len, 5), wood[i % wood.length]);
    stick.rotation.z = Math.PI / 2 + (random() - 0.5) * 0.12;
    stick.rotation.y = (random() - 0.5) * 0.14;
    const a = random() * Math.PI * 2;
    const d = random() * 0.07;
    stick.position.set((random() - 0.5) * 0.1, 0.07 + Math.sin(a) * d, Math.cos(a) * d);
    g.add(stick);
  }
  for (let i = 0; i < 4; i++) {
    const tuft = new THREE.Mesh(new THREE.IcosahedronGeometry(0.05 + random() * 0.03, 0), leaf);
    tuft.position.set(-0.5 + random(), 0.09 + random() * 0.04, (random() - 0.5) * 0.12);
    g.add(tuft);
  }
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.008, 5, 12), twine);
  band.rotation.y = Math.PI / 2;
  band.position.set(0, 0.07, 0);
  g.add(band);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

export class BrushwoodHeap {
  constructor({ scene, world, x, z, yaw = 0, random = Math.random }) {
    this.scene = scene;
    this.world = world;
    this.home = { x, z, yaw };
    this.model = buildBundle(random);
    this.model.userData.moves = true; // carried and put down anywhere, so far detail measures it from where it lies now (#823)
    this.held = false;
    this.used = false; // on the pile
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.5, 0.5), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.15;
    this.model.add(this.proxy);
    this.putDown({ x, z }, yaw);
  }

  putDown(position, yaw) {
    this.held = false;
    this.scene.add(this.model);
    this.model.position.set(position.x, this.world.heightAt(position.x, position.z) + 0.01, position.z);
    this.model.rotation.set(0, yaw, 0);
  }

  /** Carried low in front of the camera, across your body. */
  pickUp(camera) {
    this.held = true;
    camera.add(this.model);
    this.model.position.set(0.1, -0.55, -0.8);
    this.model.rotation.set(0.08, 1.2, 0);
  }

  /** It goes on the fire: gone from the hand and the ground. */
  burn() {
    this.held = false;
    this.used = true;
    this.model.removeFromParent();
  }

  /** Back where it lay (the debug panel). */
  reset() {
    this.used = false;
    this.putDown(this.home, this.home.yaw);
  }

  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}
