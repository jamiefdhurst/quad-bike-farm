import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { boltsMesh } from './fixings.js';
import { cableGeometry } from './cables.js';

// A winch for the vehicle models (TODO 100/101): the one piece the green quad's front winch and the bale trailer's share. Laid along X with the drum's
// axis through the origin, +Z the way the rope pays out and +Y up: a base plate; the drum on a shaft between two flanges, wound with rope in layers; a
// gearbox housing on the -X end with its ring of bolts and the free-spool lever; the motor on the +X end with its end cap and two terminal studs;
// two tie rods over the drum from housing to motor; the solenoid box with its leads; and a hook-stop and thimble on the end of the rope. Pure
// geometry, in the parent's frame, one mesh per material (merged), so a vehicle adds it as is.

const merge = (geos) => mergeGeometries(geos.map((g) => (g.index ? g : g.toNonIndexed())), false);
const cyl = (r, len, at, seg = 14) => new THREE.CylinderGeometry(r, r, len, seg).rotateZ(Math.PI / 2).translate(at[0], at[1], at[2]);
const bx = (w, h, d, at) => new THREE.BoxGeometry(w, h, d).translate(at[0], at[1], at[2]);

let ropeMat = null;

/** Wound rope's material: a rough dark synthetic with the lay of the strands drawn across it (needs a canvas; plain without). */
function rope() {
  if (ropeMat) return ropeMat;
  ropeMat = new THREE.MeshStandardMaterial({ color: 0x2b2a27, roughness: 0.95 });
  if (typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2a27';
    g.fillRect(0, 0, 32, 32);
    g.strokeStyle = '#4a4740';
    g.lineWidth = 2;
    for (let i = -32; i < 64; i += 8) {
      g.beginPath();
      g.moveTo(i, 32);
      g.lineTo(i + 32, 0);
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    ropeMat.map = tex;
  }
  return ropeMat;
}

/**
 * Builds the winch. `mats`: { steel, dark (the housings), plate (the base and tie rods), rubber, brass }. Returns a group named 'winchUnit'
 * (keep it out of any merge you do not want it in; its meshes are named 'winchRope', 'winchDrum' and so on).
 */
export function buildWinchUnit({ mats, drumR = 0.03, drumW = 0.15, layers = 2 } = {}) {
  const g = new THREE.Group();
  g.name = 'winchUnit';
  const add = (geo, mat, name) => {
    const m = new THREE.Mesh(geo, mat);
    m.name = name;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const half = drumW / 2;
  const flangeR = drumR * 1.75;
  // The base: a plate under it all, with the foot of each housing standing on it.
  add(merge([bx(0.36, 0.014, 0.13, [0, -flangeR - 0.012, 0]), bx(0.09, 0.03, 0.12, [-0.14, -flangeR + 0.004, 0]), bx(0.06, 0.03, 0.12, [0.14, -flangeR + 0.004, 0])]), mats.plate, 'winchBase');
  // The drum on its shaft, the two flanges, and the rope wound on in layers (a ring per turn, wider rings under, so it reads as a coil).
  add(merge([cyl(drumR, drumW, [0, 0, 0], 16), cyl(drumR * 0.45, drumW + 0.07, [0, 0, 0], 8)]), mats.steel, 'winchDrum');
  add(merge([cyl(flangeR, 0.01, [-half - 0.005, 0, 0], 20), cyl(flangeR, 0.01, [half + 0.005, 0, 0], 20)]), mats.dark, 'winchFlanges');
  const turns = [];
  const pitch = 0.014;
  for (let layer = 0; layer < layers; layer++) {
    const r = drumR + 0.005 + layer * 0.009;
    const n = Math.floor((drumW - 0.01) / pitch) - layer;
    for (let i = 0; i < n; i++) turns.push(new THREE.TorusGeometry(r, 0.0062, 4, 10).rotateY(Math.PI / 2).translate(-half + 0.008 + layer * pitch * 0.5 + i * pitch, 0, 0));
  }
  add(merge(turns), rope(), 'winchRope');
  // The gearbox on the -X end: a housing with a flange and a ring of bolts, the free-spool lever on a stalk.
  const gx = -half - 0.045;
  add(merge([cyl(0.046, 0.06, [gx, 0, 0], 18), cyl(0.052, 0.012, [gx + 0.032, 0, 0], 18), bx(0.07, 0.03, 0.08, [gx - 0.01, -0.045, 0])]), mats.dark, 'winchGearbox');
  const ringBolts = Array.from({ length: 4 }, (_, i) => [gx + 0.0385, Math.cos((i / 4) * Math.PI * 2) * 0.042, Math.sin((i / 4) * Math.PI * 2) * 0.042]);
  g.add(boltsMesh(ringBolts, [1, 0, 0], mats.steel, { size: 0.008, kind: 'hex', name: 'winchGearBolts' }));
  const lever = new THREE.CylinderGeometry(0.004, 0.004, 0.055, 6).translate(0, 0.0275, 0);
  const levMesh = add(merge([lever, new THREE.SphereGeometry(0.01, 8, 6).translate(0, 0.058, 0)]), mats.rubber, 'winchClutchLever');
  levMesh.position.set(gx - 0.005, 0.046, 0);
  levMesh.rotation.z = -0.35;
  // The motor on the +X end: a can, an end cap, two terminal studs with nuts on the cap.
  const mx = half + 0.075;
  add(merge([cyl(0.04, 0.1, [mx, 0, 0], 18), cyl(0.043, 0.014, [mx + 0.055, 0, 0], 18), cyl(0.044, 0.008, [mx - 0.04, 0, 0], 18)]), mats.rubber, 'winchMotor');
  add(merge([cyl(0.0045, 0.03, [mx + 0.075, 0.02, 0.0], 6), cyl(0.0045, 0.03, [mx + 0.075, -0.02, 0.0], 6), cyl(0.008, 0.006, [mx + 0.086, 0.02, 0], 6), cyl(0.008, 0.006, [mx + 0.086, -0.02, 0], 6)]), mats.brass, 'winchTerminals');
  // Tie rods over the drum, housing to motor, one each side of the top.
  add(merge([-1, 1].map((s) => cyl(0.0045, drumW + 0.1, [0.005, flangeR * 0.9, s * flangeR * 0.55], 6))), mats.plate, 'winchTieRods');
  // The solenoid box on the base's front edge with a lead to the motor's terminal and a lead away to the battery.
  add(merge([bx(0.075, 0.045, 0.04, [0.04, -flangeR + 0.03, flangeR + 0.02])]), mats.dark, 'winchSolenoid');
  add(cableGeometry([[0.06, -flangeR + 0.03, flangeR + 0.02], [0.13, -flangeR + 0.05, flangeR + 0.03], [mx + 0.086, -0.02, 0.0]], 0.004, { sag: 0.1, steps: 8, radial: 5 }), mats.rubber, 'winchLead');
  add(cableGeometry([[0.0, -flangeR + 0.03, flangeR + 0.04], [-0.08, -flangeR + 0.0, flangeR + 0.06], [-0.18, -flangeR - 0.05, flangeR + 0.0]], 0.004, { sag: 0.15, steps: 8, radial: 5 }), mats.rubber, 'winchBatteryLead');
  g.userData.parts = { drumR, flangeR, half };
  return g;
}

/** The end of the rope: a rope running from `a` to `b` (the parent's frame), a hook stop (a thimble block) and a latched hook, hanging at `b`. Returns { hook }. */
export function addWinchHook(parent, a, b, mats, hookName = null) {
  const m = new THREE.Mesh(cableGeometry([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 0.004, (a[2] + b[2]) / 2], b], 0.0052, { sag: 0.02, steps: 6, radial: 5 }), rope());
  m.name = 'winchRopeOut';
  parent.add(m);
  const stop = new THREE.Mesh(merge([new THREE.BoxGeometry(0.03, 0.026, 0.03), new THREE.CylinderGeometry(0.0085, 0.0085, 0.036, 8).rotateX(Math.PI / 2).translate(0, 0, 0)]), mats.steel);
  stop.name = 'winchHookStop';
  stop.position.set(b[0], b[1] + 0.001, b[2] + 0.005);
  parent.add(stop);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.0055, 6, 14, Math.PI * 1.5), mats.steel);
  hook.name = hookName ?? 'winchHook';
  hook.rotation.y = Math.PI / 2;
  hook.position.set(b[0], b[1] - 0.035, b[2] + 0.025);
  parent.add(hook);
  return { hook, stop };
}
