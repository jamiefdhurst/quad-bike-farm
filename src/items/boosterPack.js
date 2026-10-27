import * as THREE from 'three';

// A jump-start booster pack: a sealed lead-acid pack with its own clamps, charged on the bench charger and carried to a flat vehicle.
// Hold E on a switched-off vehicle to push charge from the pack into its battery, up to starting. The pack gives more than it
// is worth (`drainPerCharge`), so a full one starts about one and a half flat batteries before it is flat itself, and it loses a
// little each night on the shelf. It is kept in the game's `batteries` map under `BOOSTER_ID`, so carrying, putting down and the
// charger treat it like any battery (`engine.battery` is its charge).

export const BOOSTER_ID = 'boosterPack';

export const DEFAULT_BOOSTER_PARAMS = {
  rate: 0.12, // battery (0..1) gained per second while you hold E: flat to starting in about five seconds
  boostTo: 0.6, // it stops there: enough to start on, not a full charge
  drainPerCharge: 1.4, // pack charge used for each 1 of battery given
  nightDrain: 0.06, // pack charge lost overnight sitting unused
  minPack: 0.02, // below this it has nothing left to give
};

export const BOOSTER_PARAM_RANGES = {
  rate: [0.02, 0.5, 0.01],
  boostTo: [0.3, 1, 0.05],
  drainPerCharge: [0.5, 4, 0.1],
  nightDrain: [0, 0.5, 0.01],
  minPack: [0, 0.2, 0.01],
};

/**
 * One step of boosting `engine` from a pack whose charge is `pack.battery`. Returns 'boosting' while charge moves, or why not:
 * 'out' (no battery in the vehicle to charge), 'running' (it is already going), 'enough' (it is up to starting), 'flat' (the pack is empty).
 */
export function boostStep(pack, engine, dt, P = DEFAULT_BOOSTER_PARAMS) {
  if (engine.batteryOut) return 'out';
  if (engine.isRunning || engine.state === 'cranking') return 'running';
  if (engine.battery >= P.boostTo) return 'enough';
  if (pack.battery <= P.minPack) return 'flat';
  const gain = Math.min(P.rate * dt, P.boostTo - engine.battery, (pack.battery - P.minPack) / P.drainPerCharge);
  engine.battery += gain;
  pack.battery = Math.max(0, pack.battery - gain * P.drainPerCharge);
  return 'boosting';
}

/** The pack's charge after a night unused. */
export function packOvernight(charge, P = DEFAULT_BOOSTER_PARAMS) {
  return Math.max(0, charge - P.nightDrain);
}

export const PACK_SIZE = { w: 0.24, d: 0.11, h: 0.17 };

const MAT = {
  body: new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.55 }),
  trim: new THREE.MeshStandardMaterial({ color: 0xe2a312, roughness: 0.5 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc2231b, roughness: 0.5 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.8 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xa6a9ad, roughness: 0.35, metalness: 0.8 }),
};

function faceTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1b1d20';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#e2a312';
  ctx.fillRect(0, 0, 256, 26);
  ctx.fillStyle = '#1b1d20';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('JUMP START  12V', 128, 14);
  ctx.fillStyle = '#ebe7d8';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('BOOSTER', 128, 62);
  ctx.font = '16px sans-serif';
  ctx.fillText('500 PEAK AMPS', 128, 92);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The pack's body: a black case with yellow end caps, a carrying handle, a label, four charge lamps, a socket, and the clamps hooked on its side. */
export function buildBoosterModel() {
  const { w, d, h } = PACK_SIZE;
  const g = new THREE.Group();
  g.name = 'boosterPack';
  const part = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  part(new THREE.BoxGeometry(w, h * 0.78, d), MAT.body, 0, h * 0.39, 0);
  part(new THREE.BoxGeometry(w * 1.02, h * 0.1, d * 1.04), MAT.rubber, 0, h * 0.05, 0); // the rubber foot
  for (const sx of [-1, 1]) part(new THREE.BoxGeometry(w * 0.12, h * 0.8, d * 1.04), MAT.trim, sx * w * 0.47, h * 0.4, 0); // end caps, proud of the body so the faces are not coplanar
  part(new THREE.BoxGeometry(w * 0.8, h * 0.06, d * 0.9), MAT.trim, 0, h * 0.8, 0); // the lid trim, standing above the body's top
  // The handle across the top, from two posts.
  for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.014, h * 0.2, 0.014), MAT.rubber, sx * w * 0.3, h * 0.9, 0);
  part(new THREE.BoxGeometry(w * 0.64, 0.016, 0.02), MAT.rubber, 0, h * 1.0, 0);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.7, h * 0.5), new THREE.MeshStandardMaterial({ map: faceTexture(), roughness: 0.7 }));
  face.position.set(0, h * 0.42, d / 2 + 0.0015);
  g.add(face);
  // Four charge lamps in a row under the label, and the 12 V socket beside them.
  for (let i = 0; i < 4; i++) {
    const lamp = part(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 8), i < 3 ? MAT.trim : MAT.red, (i - 1.5) * 0.026, h * 0.13, d / 2 + 0.002);
    lamp.rotation.x = Math.PI / 2;
  }
  const socket = part(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 10), MAT.rubber, w * 0.3, h * 0.13, d / 2 + 0.004);
  socket.rotation.x = Math.PI / 2;
  // The clamps hang from the side: a red and a black jaw on short cables.
  for (const [mat, dz] of [[MAT.red, -0.025], [MAT.rubber, 0.025]]) {
    part(new THREE.BoxGeometry(0.03, 0.02, 0.05), mat, -w / 2 - 0.02, h * 0.5, dz);
    part(new THREE.BoxGeometry(0.015, 0.012, 0.03), MAT.steel, -w / 2 - 0.04, h * 0.5, dz);
  }
  return g;
}

/** The booster pack as a thing you carry. Same shape as a vehicle's `BatteryItem` where the charger and the hands need it. */
export class BoosterPack {
  constructor({ scene, world, charge = 1 }) {
    this.scene = scene;
    this.world = world;
    this.unitId = BOOSTER_ID;
    this.name = 'booster pack';
    this.engine = { battery: charge, batteryOut: false }; // its charge, in the one field the charger already raises
    this.size = 'small';
    this.model = buildBoosterModel();
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(PACK_SIZE.w + 0.14, PACK_SIZE.h + 0.12, PACK_SIZE.d + 0.12), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = PACK_SIZE.h / 2;
    this.model.add(this.proxy);
    this.where = 'loose'; // 'held', 'loose' (the ground, the bench, a bed) or 'charger'
  }

  get held() {
    return this.where === 'held';
  }

  get out() {
    return true; // it is never in a vehicle
  }

  sync() {}

  putDown(position, yaw = 0, y = null) {
    this.where = 'loose';
    this.scene.add(this.model);
    this.model.visible = true;
    this.model.position.set(position.x, y ?? this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
  }

  setOnCharger(at, yaw) {
    this.putDown(at, yaw, at.y);
    this.where = 'charger';
  }

  pickUp(camera) {
    this.where = 'held';
    this.model.visible = true;
    camera.add(this.model);
    this.model.position.set(0.34, -0.6, -0.65);
    this.model.rotation.set(0.1, -0.4, 0);
  }

  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}
