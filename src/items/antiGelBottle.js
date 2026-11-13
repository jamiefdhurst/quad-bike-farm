import * as THREE from 'three';
import { pourAntiGel } from '../vehicle/dieselWax.js';

// A bottle of diesel anti-gel on the ground by the coolant. Pick it up with E, carry it to a diesel (the tractor, the UTV, a Tor or Crag) and
// hold Y beside it to dose the tank. Treated fuel stops waxing in a hard frost and dissolves what has already waxed (vehicle/dieselWax.js);
// topping up with untreated diesel thins it out. G puts it down.

export const DEFAULT_ANTI_GEL_BOTTLE_PARAMS = {
  pourRate: 0.25, // share of the tank treated a second while you hold Y (about four seconds for a full dose)
};

export const ANTI_GEL_BOTTLE_PARAM_RANGES = {
  pourRate: [0.02, 2, 0.01],
};

/** One step of holding Y at a vehicle with the bottle: 'petrol' (it doesn't wax), 'empty' (nothing in the tank to treat), 'pouring' or 'full'. */
export function doseStep(fuel, engine, h, P = DEFAULT_ANTI_GEL_BOTTLE_PARAMS) {
  if (!engine.params.compressionIgnition) return 'petrol';
  if (fuel.litres < 0.05) return 'empty';
  if (fuel.antiGel > 0.999) return 'full';
  fuel.antiGel = pourAntiGel(fuel.antiGel, h, P.pourRate);
  return 'pouring';
}

function buildModel() {
  const g = new THREE.Group();
  g.name = 'antiGelBottle';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xe9e6dc, roughness: 0.45 });
  const label = new THREE.MeshStandardMaterial({ color: 0x3a7bd5, roughness: 0.6 });
  const cap = new THREE.MeshStandardMaterial({ color: 0xc43a2a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.24, 14), plastic);
  body.position.y = 0.12;
  g.add(body);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0515, 0.0565, 0.1, 14), label);
  band.position.y = 0.12;
  g.add(band);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.04, 0.04, 12), plastic);
  neck.position.y = 0.26;
  g.add(neck);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.027, 0.027, 0.028, 12), cap);
  lid.position.y = 0.294;
  g.add(lid);
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

export class AntiGelBottle {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_ANTI_GEL_BOTTLE_PARAMS } }) {
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
