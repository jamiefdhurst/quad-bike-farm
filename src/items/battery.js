import * as THREE from 'three';

// A vehicle's battery as a thing you can carry. It starts in the vehicle (the engine's `battery` number is its charge); lifted out at the
// bench, or with the toolbox in the yard, it becomes a lump you pick up with E, stand in the UTV's bed, put on the bench charger
// (workshop/charger.js) or fit back. While it is out the engine has `batteryOut` set: no dash, no starter, nothing to drain or charge.
// Every vehicle with a starter has one, so the size follows the vehicle (a quad's, or a big car-sized one for the cars, tractor and UTV).

export const BATTERY_SIZES = {
  small: { w: 0.17, d: 0.09, h: 0.15 },
  big: { w: 0.27, d: 0.17, h: 0.19 },
};

/** Which size a vehicle's battery is: the quads' are small, everything with a car-sized engine bay has a big one. */
export function batterySizeFor(unit) {
  const s = unit.spec ?? {};
  return s.car || s.tractor || s.utv || unit.quad?.tractor || unit.quad?.landRover || unit.engine?.params.runsOnDiesel ? 'big' : 'small';
}

/** Whether a vehicle has a battery to take out (a pull-start-only machine has none). */
export function hasBattery(unit) {
  return !unit.engine.params.noStarter;
}

const MAT = {
  case: new THREE.MeshStandardMaterial({ color: 0x1d2024, roughness: 0.55 }),
  lid: new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.6 }),
  red: new THREE.MeshStandardMaterial({ color: 0xc2231b, roughness: 0.5 }),
  black: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.6 }),
  lead: new THREE.MeshStandardMaterial({ color: 0xa6a9ad, roughness: 0.35, metalness: 0.8 }),
  strap: new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9 }),
};

function label(text, sub) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e4e0d0';
  ctx.fillRect(0, 0, 256, 128);
  ctx.fillStyle = '#c2231b';
  ctx.fillRect(0, 0, 256, 30);
  ctx.fillStyle = '#f6f2e4';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('12V  LEAD ACID', 128, 16);
  ctx.fillStyle = '#23201a';
  ctx.font = 'bold 40px sans-serif';
  ctx.fillText(text, 128, 70);
  ctx.font = '18px sans-serif';
  ctx.fillText(sub, 128, 106);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The battery's body: a moulded case with a raised lid, a label, two lead posts with boots, a carrying strap and a rim round the foot. */
export function buildBatteryModel(size, name) {
  const { w, d, h } = BATTERY_SIZES[size];
  const g = new THREE.Group();
  g.name = 'battery';
  const part = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const lidH = h * 0.12;
  part(new THREE.BoxGeometry(w, h - lidH, d), MAT.case, 0, (h - lidH) / 2, 0);
  part(new THREE.BoxGeometry(w + 0.008, h * 0.08, d + 0.008), MAT.case, 0, h * 0.04, 0); // the thicker foot
  part(new THREE.BoxGeometry(w * 0.97, lidH, d * 0.97), MAT.lid, 0, h - lidH / 2, 0);
  // The label on the long front face.
  const sticker = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.62, h * 0.4), new THREE.MeshStandardMaterial({ map: label(size === 'big' ? '60Ah' : '12Ah', name), roughness: 0.8 }));
  sticker.position.set(0, h * 0.5, d / 2 + 0.0015);
  g.add(sticker);
  // Cell caps along the lid, flush plugs in a row.
  const cells = size === 'big' ? 6 : 3;
  for (let i = 0; i < cells; i++) {
    const x = (i - (cells - 1) / 2) * (w * 0.78 / cells);
    part(new THREE.CylinderGeometry(w * 0.025, w * 0.025, 0.004, 10), MAT.black, x, h + 0.001, -d * 0.12);
  }
  // Two posts at the front corners of the lid, red and black, each with a boot and a bolt.
  for (const [mat, sx] of [[MAT.red, -1], [MAT.black, 1]]) {
    const x = sx * w * 0.36;
    part(new THREE.CylinderGeometry(0.012, 0.014, 0.022, 10), MAT.lead, x, h + 0.01, d * 0.26);
    part(new THREE.CylinderGeometry(0.019, 0.021, 0.014, 10), mat, x, h + 0.007, d * 0.26); // the boot
    part(new THREE.CylinderGeometry(0.005, 0.005, 0.014, 6), MAT.lead, x, h + 0.028, d * 0.26);
  }
  // A strap handle over the lid, from two small lugs.
  const arch = new THREE.Mesh(new THREE.TorusGeometry(d * 0.3, 0.006, 6, 14, Math.PI), MAT.strap);
  arch.rotation.y = Math.PI / 2;
  arch.position.set(0, h, -d * 0.04);
  arch.castShadow = true;
  g.add(arch);
  return g;
}

export class BatteryItem {
  constructor({ scene, world, unit, size = batterySizeFor(unit) }) {
    this.scene = scene;
    this.world = world;
    this.unitId = unit.id;
    this.name = `${unit.label} battery`;
    this.engine = unit.engine;
    this.size = size;
    this.model = buildBatteryModel(size, unit.label);
    this.model.name = 'battery';
    const dims = BATTERY_SIZES[size];
    this.proxy = new THREE.Mesh(new THREE.BoxGeometry(dims.w + 0.12, dims.h + 0.12, dims.d + 0.12), new THREE.MeshBasicMaterial({ visible: false }));
    this.proxy.position.y = dims.h / 2;
    this.model.add(this.proxy);
    this.where = 'in'; // 'in' the vehicle, 'held', 'loose' (on the ground, on a bench, in a bed) or 'charger'
    this.model.visible = false;
  }

  get held() {
    return this.where === 'held';
  }

  get out() {
    return this.where !== 'in';
  }

  /** The engine is told whether the battery is in it. */
  sync() {
    this.engine.batteryOut = this.where !== 'in';
  }

  /** Stands somewhere (the ground, the bench, a bed spot's own placing). */
  putDown(position, yaw = 0, y = null) {
    this.where = 'loose';
    this.scene.add(this.model);
    this.model.visible = true;
    this.model.position.set(position.x, y ?? this.world.heightAt(position.x, position.z) + 0.005, position.z);
    this.model.rotation.set(0, yaw, 0);
    this.sync();
  }

  /** On the charger's mat: a fixed spot (world coordinates, bench height). */
  setOnCharger(at, yaw) {
    this.putDown(at, yaw, at.y);
    this.where = 'charger';
  }

  /** Carried low in front of the camera. */
  pickUp(camera) {
    this.where = 'held';
    this.model.visible = true;
    camera.add(this.model);
    this.model.position.set(0.34, -0.6, -0.65);
    this.model.rotation.set(0.1, -0.4, 0);
    this.sync();
  }

  /** Back in the vehicle, out of sight. */
  fit() {
    this.where = 'in';
    this.model.removeFromParent();
    delete this.model.userData.cargoHold;
    this.model.visible = false;
    this.sync();
  }

  worldPosition() {
    return this.model.getWorldPosition(new THREE.Vector3());
  }
}
