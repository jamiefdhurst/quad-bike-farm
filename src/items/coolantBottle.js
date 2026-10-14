import * as THREE from 'three';
import { flushThermostat } from '../engine/coolant.js';

// A bottle of coolant on the ground by the oil. Pick it up with E, carry it to a water-cooled vehicle and hold Y beside it to top
// the radiator up (the engine has to be off and cooled, or the cap spits). With the radiator full, keep holding Y on a cold engine
// and the coolant flushes through, which frees a stuck thermostat. G puts it down.

export const DEFAULT_COOLANT_BOTTLE_PARAMS = {
  pourRate: 0.08, // radiator level a second poured in (about twelve seconds from nearly dry to full)
  capSafeHeat: 0.25, // the cap won't be opened with the engine hotter than this (running heat or soak): it would scald
};

export const COOLANT_BOTTLE_PARAM_RANGES = {
  pourRate: [0.01, 1, 0.01],
  capSafeHeat: [0, 1, 0.05],
};

/**
 * One step of holding Y at a vehicle with the bottle. Changes the engine's coolant and thermostat; returns what happened:
 * 'air' (nothing to fill), 'hot' (too hot or running), 'pouring', 'full' (nothing to add, nothing stuck), 'flushing' or 'freed'.
 */
export function pourStep(engine, h, P = DEFAULT_COOLANT_BOTTLE_PARAMS) {
  if (!engine.params.waterCooled) return 'air';
  if (engine.isRunning || Math.max(engine.heat, engine.soak) > P.capSafeHeat) return 'hot';
  if (engine.coolant < 0.999) {
    engine.coolant = Math.min(1, engine.coolant + P.pourRate * h);
    return 'pouring';
  }
  if (engine.thermostat <= 0) return 'full';
  engine.thermostat = flushThermostat(engine.thermostat, h, engine.params);
  return engine.thermostat > 0 ? 'flushing' : 'freed';
}

function buildModel() {
  const g = new THREE.Group();
  g.name = 'coolantBottle';
  const plastic = new THREE.MeshStandardMaterial({ color: 0xf0efe8, roughness: 0.45 });
  const label = new THREE.MeshStandardMaterial({ color: 0x1f9bd0, roughness: 0.6 });
  const cap = new THREE.MeshStandardMaterial({ color: 0x1fa04a, roughness: 0.5 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.26, 0.1), plastic);
  body.position.y = 0.13;
  g.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.12, 0.105), label);
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

export class CoolantBottle {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_COOLANT_BOTTLE_PARAMS } }) {
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
