import * as THREE from 'three';

// A bottle of engine oil on the ground by the petrol tank. Hold E on it with a jerry can in your hands
// to add oil to the can (see jerryCan.addOil); the same bottle tops up a four-stroke's sump (Y at the
// quad, near it). Pick it up with E (empty-handed) to carry it about, stand it in the trailer or on the
// workbench, or put it down with G.

export const DEFAULT_OIL_BOTTLE_PARAMS = {
  pourRate: 0.04, // litres of oil per second into a can (0.4 L makes 20 L of 50:1 pre-mix: ten seconds)
};

export const OIL_BOTTLE_PARAM_RANGES = {
  pourRate: [0.005, 1, 0.005],
};

function buildModel() {
  const g = new THREE.Group();
  g.name = 'oilBottle';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe8e4d0, roughness: 0.45 });
  const label = new THREE.MeshStandardMaterial({ color: 0x1f5fb0, roughness: 0.6 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xd12a1a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.075, 0.26, 14), plastic);
  body.position.y = 0.13;
  g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0715, 0.0765, 0.12, 14), label);
  band.position.y = 0.13;
  g.add(band);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.05, 12), plastic);
  neck.position.y = 0.285;
  g.add(neck);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12), cap);
  lid.position.y = 0.325;
  g.add(lid);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

export class OilBottle {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_OIL_BOTTLE_PARAMS } }) {
    this.params = params;
    this.model = buildModel();
    this.scene = scene;
    this.world = world;
    this.held = false;
    this.putDown(position, yaw);
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.4), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = 0.2;
    this.model.add(this.proxy);
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

  /** Where it is in the world, held or not. */
  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}
