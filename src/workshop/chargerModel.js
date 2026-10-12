import * as THREE from 'three';

// The trickle charger on the workbench: a pressed-steel case with vents, a carrying handle, an ammeter with a needle that climbs as the
// battery fills, a red and a green lamp, a rotary switch, rubber feet, and two leads with crocodile clips lying on a rubber mat where the
// battery sits. The mains lead runs off the back to the wall. Local axes: +z is the front (towards the bay), the mat is to the right (+x).

export const CHARGER_SLOT = { x: 0.34, z: 0.02 }; // where the battery stands, in the charger's own space

const NEEDLE_FROM = -1.0; // radians, empty
const NEEDLE_TO = 1.0; // and full

function dialTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ece6d2';
  ctx.fillRect(0, 0, 128, 96);
  ctx.strokeStyle = '#2a261c';
  ctx.fillStyle = '#2a261c';
  ctx.lineWidth = 2;
  const cx = 64;
  const cy = 80;
  for (let i = 0; i <= 10; i++) {
    const a = NEEDLE_FROM + (i / 10) * (NEEDLE_TO - NEEDLE_FROM);
    const r1 = 58;
    const r0 = i % 5 === 0 ? 46 : 51;
    ctx.beginPath();
    ctx.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
    ctx.lineTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1);
    ctx.stroke();
  }
  ctx.fillStyle = '#b52418';
  ctx.beginPath();
  ctx.arc(cx, cy, 64, -Math.PI / 2 + 0.78, -Math.PI / 2 + 1.0, false);
  ctx.arc(cx, cy, 58, -Math.PI / 2 + 1.0, -Math.PI / 2 + 0.78, true);
  ctx.fill();
  ctx.fillStyle = '#2a261c';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('E', 24, 30);
  ctx.fillText('F', 104, 30);
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('CHARGE', 64, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function cable(points, mat, radius = 0.0045) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)));
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, radius, 6), mat);
  m.castShadow = true;
  return m;
}

/** Builds the charger. `set({ level, charging, full })` moves the needle and the lamps. */
export function buildChargerModel() {
  const g = new THREE.Group();
  g.name = 'batteryCharger';
  const paint = new THREE.MeshStandardMaterial({ color: 0x2f5f78, roughness: 0.5, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0d0d0e, roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x9a9da0, roughness: 0.35, metalness: 0.8 });
  const redCable = new THREE.MeshStandardMaterial({ color: 0xb5211a, roughness: 0.6 });
  const blackCable = new THREE.MeshStandardMaterial({ color: 0x101011, roughness: 0.6 });
  const part = (geo, mat, x, y, z, rot = null) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rot) m.rotation.set(...rot);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const W = 0.26;
  const D = 0.15;
  const H = 0.14;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) part(new THREE.CylinderGeometry(0.012, 0.014, 0.012, 8), rubber, sx * (W / 2 - 0.02), 0.006, sz * (D / 2 - 0.02)); // feet
  part(new THREE.BoxGeometry(W, H, D), paint, 0, 0.012 + H / 2, 0);
  part(new THREE.BoxGeometry(W + 0.01, 0.012, D + 0.01), dark, 0, 0.012 + H, 0); // the lip of the lid
  // Vent slots on both sides and the top.
  for (let i = 0; i < 6; i++) {
    for (const sx of [-1, 1]) part(new THREE.BoxGeometry(0.002, 0.07, 0.008), dark, sx * (W / 2 + 0.0005), 0.012 + H * 0.5, -0.05 + i * 0.02);
    part(new THREE.BoxGeometry(0.1, 0.002, 0.008), dark, -0.04, 0.012 + H + 0.007, -0.05 + i * 0.02);
  }
  // The carrying handle: two posts and a bar across the top, over the vents' side.
  part(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6), steel, 0.09, 0.012 + H + 0.026, -0.04);
  part(new THREE.CylinderGeometry(0.006, 0.006, 0.04, 6), steel, 0.09, 0.012 + H + 0.026, 0.04);
  part(new THREE.CylinderGeometry(0.007, 0.007, 0.1, 8), dark, 0.09, 0.012 + H + 0.046, 0, [Math.PI / 2, 0, 0]);
  // The front panel: a darker plate with the dial, the lamps and the switch.
  const fz = D / 2 + 0.0015;
  part(new THREE.BoxGeometry(W - 0.03, H - 0.03, 0.004), dark, 0, 0.012 + H / 2, fz - 0.001);
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.075), new THREE.MeshStandardMaterial({ map: dialTexture(), roughness: 0.5 }));
  dial.position.set(-0.04, 0.012 + H * 0.58, fz + 0.002);
  g.add(dial);
  part(new THREE.BoxGeometry(0.108, 0.083, 0.006), steel, -0.04, 0.012 + H * 0.58, fz); // the bezel
  const pivot = new THREE.Group();
  pivot.position.set(-0.04, 0.012 + H * 0.58 - 0.0295, fz + 0.0045);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.0014, 0.05, 0.0012), new THREE.MeshStandardMaterial({ color: 0x9a1810, roughness: 0.5 }));
  needle.position.y = 0.022;
  pivot.add(needle);
  g.add(pivot);
  const lampMat = (c) => new THREE.MeshStandardMaterial({ color: 0x222222, emissive: c, emissiveIntensity: 0, roughness: 0.3 });
  const redLamp = part(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), lampMat(0xff2a1a), 0.06, 0.012 + H * 0.72, fz + 0.003, [Math.PI / 2, 0, 0]);
  const greenLamp = part(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10), lampMat(0x22ff44), 0.095, 0.012 + H * 0.72, fz + 0.003, [Math.PI / 2, 0, 0]);
  part(new THREE.CylinderGeometry(0.014, 0.016, 0.014, 12), steel, 0.078, 0.012 + H * 0.35, fz + 0.007, [Math.PI / 2, 0, 0]); // the switch knob
  part(new THREE.BoxGeometry(0.003, 0.02, 0.004), dark, 0.078, 0.012 + H * 0.35 + 0.004, fz + 0.015);
  // The mains lead out of the back, curling off the bench edge.
  g.add(cable([[-0.1, 0.05, -D / 2], [-0.14, 0.03, -0.14], [-0.2, 0.012, -0.2], [-0.3, 0.006, -0.28]], dark, 0.006));
  // The rubber mat the battery sits on, and the two leads to it with clips lying on it.
  const mat = part(new THREE.BoxGeometry(0.34, 0.006, 0.24), rubber, CHARGER_SLOT.x, 0.003, CHARGER_SLOT.z);
  mat.castShadow = false;
  const clip = (x, z, m) => {
    part(new THREE.BoxGeometry(0.014, 0.012, 0.04), m, x, 0.012, z);
    part(new THREE.BoxGeometry(0.01, 0.004, 0.026), steel, x, 0.021, z + 0.004, [0.2, 0, 0]);
  };
  const sx = CHARGER_SLOT.x;
  const clipZ = CHARGER_SLOT.z + 0.1;
  g.add(cable([[W / 2, 0.1, 0.03], [W / 2 + 0.04, 0.04, 0.09], [sx - 0.08, 0.012, clipZ - 0.01]], redCable));
  g.add(cable([[W / 2, 0.08, 0.04], [W / 2 + 0.05, 0.03, 0.1], [sx + 0.08, 0.012, clipZ - 0.01]], blackCable));
  clip(sx - 0.08, clipZ, redCable);
  clip(sx + 0.08, clipZ, blackCable);
  const set = ({ level = 0, charging = false, full = false }) => {
    pivot.rotation.z = -(NEEDLE_FROM + Math.max(0, Math.min(1, level)) * (NEEDLE_TO - NEEDLE_FROM));
    redLamp.material.emissiveIntensity = charging && !full ? 1.6 : 0;
    greenLamp.material.emissiveIntensity = charging && full ? 1.6 : 0;
  };
  set({});
  return { group: g, set };
}
