import * as THREE from 'three';
import { mixOil } from '../engine/lubrication.js';

export const DEFAULT_JERRY_CAN_PARAMS = {
  capacity: 20, // litres
  startLitres: 20,
  startOil: 0, // oil fraction of what's in it: 0 for petrol, 0.02 (50:1) for the pre-mix can
  startDiesel: 0, // diesel fraction of what's in it: 1 for the red diesel can
  pourRate: 0.5, // litres per second into a quad
  fillRate: 0.8, // litres per second from the fuel tank
};

export const JERRY_CAN_PARAM_RANGES = {
  capacity: [5, 40, 0.5],
  startLitres: [0, 40, 0.5],
  startOil: [0, 0.2, 0.001],
  startDiesel: [0, 1, 0.01],
  pourRate: [0.05, 5, 0.05],
  fillRate: [0.05, 5, 0.05],
};

const HEIGHT = 0.46;

function labelTexture(text, ink) {
  if (typeof document === 'undefined') return null; // unit tests build cans with no DOM
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#e9e3cf';
  ctx.fillRect(0, 0, 256, 96);
  ctx.strokeStyle = ink;
  ctx.lineWidth = 5;
  ctx.strokeRect(5, 5, 246, 86);
  ctx.fillStyle = ink;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 50);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  return s;
}

// A shell with bevelled edges, centred, `w` by `h` in x and y and `d` deep in z.
function bevelled(w, h, d, r, bevel, curveSegments = 4) {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, h - bevel * 2, r), {
    depth: d - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments,
  });
  geo.translate(0, 0, -(d - bevel * 2) / 2);
  return geo;
}

function buildModel(colour = 0xc4231a, darkColour = 0x8c1812, text = 'PETROL') {
  const g = new THREE.Group();
  g.name = 'jerryCan';
  const red = new THREE.MeshStandardMaterial({ color: colour, roughness: 0.5, metalness: 0.3 });
  const dark = new THREE.MeshStandardMaterial({ color: darkColour, roughness: 0.55, metalness: 0.3 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9c9e, roughness: 0.4, metalness: 0.7 });
  const bodyH = HEIGHT - 0.04;

  // The shell, with softened edges, a pressed frame round each side and the X inside it.
  const body = new THREE.Mesh(bevelled(0.34, bodyH, 0.165, 0.03, 0.012), red);
  body.position.y = bodyH / 2;
  g.add(body);
  for (const z of [-1, 1]) {
    const zf = z * 0.0835;
    for (const [w, h, x, y] of [[0.3, 0.012, 0, bodyH - 0.035], [0.3, 0.012, 0, 0.035], [0.012, bodyH - 0.07, -0.15, bodyH / 2], [0.012, bodyH - 0.07, 0.15, bodyH / 2]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.006), dark);
      bar.position.set(x, y, zf);
      g.add(bar);
    }
    for (const a of [0.9, -0.9]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.022, 0.006), dark);
      rib.position.set(0, bodyH / 2 - 0.01, zf);
      rib.rotation.z = a;
      g.add(rib);
    }
    // The stencilled label, in the middle of the X's lower triangle.
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.0375), new THREE.MeshStandardMaterial({ map: labelTexture(text, '#222'), roughness: 0.7 }));
    plate.position.set(0, 0.075, zf + z * 0.0045);
    if (z < 0) plate.rotation.y = Math.PI;
    g.add(plate);
  }
  // The carrying handle: one moulded slab along the top with three finger slots cut through it, and a raised pad each end.
  const handle = new THREE.Shape();
  handle.moveTo(-0.13, 0);
  handle.lineTo(0.13, 0);
  handle.lineTo(0.12, 0.062);
  handle.lineTo(-0.12, 0.062);
  for (const x of [-0.07, 0, 0.07]) {
    const hole = new THREE.Path();
    hole.moveTo(x - 0.026, 0.012);
    hole.lineTo(x + 0.026, 0.012);
    hole.lineTo(x + 0.026, 0.044);
    hole.lineTo(x - 0.026, 0.044);
    handle.holes.push(hole);
  }
  const hgeo = new THREE.ExtrudeGeometry(handle, { depth: 0.04, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1 });
  hgeo.translate(0, 0, -0.02);
  const grip = new THREE.Mesh(hgeo, red);
  grip.position.set(0, bodyH - 0.004, 0);
  g.add(grip);
  // Spout at the front corner: a neck, a cap with a flange and a short chain to the handle.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.045, 12), red);
  neck.position.set(0.13, bodyH + 0.018, 0);
  neck.rotation.z = -0.35;
  g.add(neck);
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.026, 14), steel);
  spout.position.set(0.14, HEIGHT - 0.004, 0);
  spout.rotation.z = -0.35;
  spout.name = 'spout';
  g.add(spout);
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.008, 14), steel);
  flange.position.set(0.133, HEIGHT - 0.03, 0);
  flange.rotation.z = -0.35;
  g.add(flange);
  const chain = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.003, 4, 10, Math.PI), steel);
  chain.position.set(0.1, bodyH + 0.03, 0);
  chain.rotation.x = Math.PI / 2;
  g.add(chain);

  g.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return g;
}

/** The pre-mix can's body, a different colour to the red petrol can. */
export const PREMIX_CAN_COLOURS = { colour: 0xd8b21c, darkColour: 0x9a7d10, text: 'MIX 50:1' };
/** The red diesel can's body: dark green, so it isn't mistaken for the red petrol one (until you're in a hurry). */
export const DIESEL_CAN_COLOURS = { colour: 0x2f4a36, darkColour: 0x1d3023, text: 'DIESEL' };

/**
 * A 20 litre jerry can. It sits on the ground until picked up, then rides in
 * front of the camera and tips forward while it's pouring.
 */
export class JerryCan {
  constructor({ scene, world, position, yaw = 0, params = { ...DEFAULT_JERRY_CAN_PARAMS }, colours, name = 'jerryCan' }) {
    this.scene = scene;
    this.world = world;
    this.params = params;
    this.litres = Math.min(params.startLitres, params.capacity);
    this.oil = params.startOil ?? 0; // oil fraction of what's in it
    this.diesel = params.startDiesel ?? 0; // diesel fraction of what's in it
    this.model = buildModel(colours?.colour, colours?.darkColour, colours?.text);
    this.model.name = name;
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

  /** Fills it from a tank (`oil` and `diesel` are the fractions in what goes in: none for petrol); returns how much went in. */
  fill(litres, oil = 0, diesel = 0) {
    const added = Math.max(0, Math.min(litres, this.space));
    this.oil = mixOil(this.litres, this.oil, added, oil);
    this.diesel = mixOil(this.litres, this.diesel, added, diesel);
    this.litres += added;
    return added;
  }

  /** Tops up the oil from the bottle; returns the litres of oil that went in. */
  addOil(litres) {
    const added = Math.max(0, Math.min(litres, this.space));
    this.oil = mixOil(this.litres, this.oil, added, 1);
    this.diesel = mixOil(this.litres, this.diesel, added, 0);
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
