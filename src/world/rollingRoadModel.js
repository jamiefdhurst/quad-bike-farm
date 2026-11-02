import * as THREE from 'three';
import { PART_MAT, box, buildWheel, addMudguard, addRearLights, addJockeyWheel, addChain, addCable, beam, galvanised, chequerPlate } from '../vehicle/trailerParts.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeStatic } from '../vehicle/quadGeometry.js';
import { RIG } from './rollingRoadSite.js';

// The tuner's rolling road (farm/rollingRoad.js): a low flat-bed trailer with a pit in the deck for two steel rollers, a ramp that folds up
// behind it, a cooling fan on a stand, a signboard, a red tool chest, a cable reel and a screen on a post. All procedural, built in the
// trailer's own frame (origin at the middle of the deck on the ground, +z towards the tow vehicle, +x to the right of the way it is towed) from
// the measurements in rollingRoadSite.js, so the colliders and the cradle always agree with what is drawn.
//
//   rolling-road-trailer
//   ├── body       everything static, merged to a few meshes
//   ├── ramp       hinged at the deck's rear edge; poseRamp(model, k) folds it up (0) or lowers it (1)
//   ├── rollerA, rollerB   spin about x (spinRollers)
//   ├── fanBlades  spin about z
//   ├── straps     four yellow straps over the quad's wheels, shown while it is held down
//   └── post       the screen on its post (userData.screen: a RoadScreen), with a beacon on top

const DECK = RIG.deckHeight;
const ROLLER_R = 0.1;

const MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.5, metalness: 0.55 }),
  darkSteel: new THREE.MeshStandardMaterial({ color: 0x2a2c2e, roughness: 0.6, metalness: 0.5 }),
  pit: new THREE.MeshStandardMaterial({ color: 0x1b1c1d, roughness: 0.9 }),
  roller: new THREE.MeshStandardMaterial({ color: 0x8b9094, roughness: 0.35, metalness: 0.8 }),
  rollerBand: new THREE.MeshStandardMaterial({ color: 0x3a3d40, roughness: 0.5, metalness: 0.7 }),
  chassis: new THREE.MeshStandardMaterial({ color: 0x2e3a44, roughness: 0.55, metalness: 0.35 }), // the tuner's slate blue, chipped
  red: new THREE.MeshStandardMaterial({ color: 0xa3231d, roughness: 0.45, metalness: 0.3 }),
  chrome: new THREE.MeshStandardMaterial({ color: 0xc8ccce, roughness: 0.25, metalness: 0.9 }),
  strap: new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.8 }),
  orange: new THREE.MeshStandardMaterial({ color: 0xd9741c, roughness: 0.6 }),
  black: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 }),
  grey: new THREE.MeshStandardMaterial({ color: 0x6f7377, roughness: 0.7 }),
  cream: new THREE.MeshStandardMaterial({ color: 0xd8d2bc, roughness: 0.7 }),
};

function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { canvas: c, texture: tex };
}

/** Yellow and black diagonal hazard stripes, for the pit's edges. */
function hazardMaterial() {
  if (typeof document === 'undefined') return MAT.strap;
  const { texture } = canvasOf(128, 32, (g, w, h) => {
    g.fillStyle = '#d9b21c';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#1d1d1b';
    for (let x = -h; x < w + h; x += 32) {
      g.beginPath();
      g.moveTo(x, h);
      g.lineTo(x + 16, h);
      g.lineTo(x + 16 + h, 0);
      g.lineTo(x + h, 0);
      g.fill();
    }
    g.fillStyle = 'rgba(60,40,10,0.18)';
    for (let i = 0; i < 40; i++) g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 8, 1 + Math.random() * 2); // scuffs
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(8, 1);
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.7 });
}

/** The signboard on the headboard: a made-up tuner, never a real firm. */
function signMaterial() {
  if (typeof document === 'undefined') return MAT.cream;
  const { texture } = canvasOf(512, 160, (g, w, h) => {
    g.fillStyle = '#e6dfc6';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { // weathering
      g.fillStyle = `rgba(90,70,40,${0.02 + Math.random() * 0.05})`;
      g.fillRect(Math.random() * w, Math.random() * h, 20 + Math.random() * 60, 1 + Math.random() * 2);
    }
    g.fillStyle = '#26333d';
    g.fillRect(0, 0, w, 18);
    g.fillRect(0, h - 18, w, 18);
    g.textAlign = 'center';
    g.fillStyle = '#26333d';
    g.font = 'bold 54px Georgia, serif';
    g.fillText('HARGREAVE', w / 2, 70);
    g.font = 'bold 26px Arial, sans-serif';
    g.fillStyle = '#a3231d';
    g.fillText('ROLLING ROAD  ·  RUNS FOR QUADS', w / 2, 104);
    g.font = '20px Arial, sans-serif';
    g.fillStyle = '#26333d';
    g.fillText('Quads on the rollers, £15 a run', w / 2, 134);
  });
  return new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 });
}

/** The oil stains on the deck: a soft dark blot. */
function stainMaterial() {
  if (typeof document === 'undefined') return MAT.pit;
  const { texture } = canvasOf(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grad.addColorStop(0, 'rgba(12,10,8,0.8)');
    grad.addColorStop(0.6, 'rgba(12,10,8,0.35)');
    grad.addColorStop(1, 'rgba(12,10,8,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  return new THREE.MeshStandardMaterial({ map: texture, transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
}

/** The screen on the post: a canvas drawn by `show`. */
export class RoadScreen {
  constructor() {
    this.w = 320;
    this.h = 200;
    if (typeof document === 'undefined') return;
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w;
    this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.key = '';
  }

  /** Draws `lines` ({ text, size?, colour?, bar? }): the amber text of a workshop display. Does nothing if they are as last drawn. */
  show(lines, bar = null) {
    if (!this.ctx) return;
    const key = JSON.stringify([lines, bar]);
    if (key === this.key) return;
    this.key = key;
    const g = this.ctx;
    g.fillStyle = '#0b0f0c';
    g.fillRect(0, 0, this.w, this.h);
    g.textAlign = 'left';
    let y = 12;
    for (const l of lines) {
      const size = l.size ?? 22;
      g.font = `${l.bold ? 'bold ' : ''}${size}px "Courier New", monospace`;
      g.fillStyle = l.colour ?? '#f2b134';
      y += size;
      g.fillText(l.text, 14, y);
      y += 6;
    }
    if (bar != null) {
      g.strokeStyle = '#f2b134';
      g.lineWidth = 2;
      g.strokeRect(14, this.h - 34, this.w - 28, 20);
      g.fillStyle = '#f2b134';
      g.fillRect(17, this.h - 31, Math.max(0, (this.w - 34) * bar), 14);
    }
    g.fillStyle = 'rgba(255,255,255,0.04)'; // scan lines
    for (let i = 0; i < this.h; i += 4) g.fillRect(0, i, this.w, 1);
    this.texture.needsUpdate = true;
  }
}

/** A cylinder along the x axis, `len` long, at (x, y, z). */
function rollerMesh(len) {
  const g = new THREE.Group();
  g.userData.keep = true;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(ROLLER_R, ROLLER_R, len, 20), MAT.roller);
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const bands = []; // the knurled bands: a darker ring every so often, and the ends, as one mesh
  for (let i = -3; i <= 3; i++) {
    const band = new THREE.CylinderGeometry(ROLLER_R + 0.003, ROLLER_R + 0.003, 0.07, 20);
    band.rotateZ(Math.PI / 2);
    band.translate(i * (len / 7.5), 0, 0);
    bands.push(band);
  }
  g.add(new THREE.Mesh(mergeGeometries(bands), MAT.rollerBand));
  const flat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.03), MAT.chrome); // a bright mark on the surface so the turning shows
  flat.position.set(len * 0.2, ROLLER_R + 0.004, 0);
  g.add(flat);
  return g;
}

function addDeck(body) {
  const chequer = chequerPlate();
  const half = RIG.deckHalf;
  const pitFront = RIG.cradleZ + 0.5;
  const pitBack = RIG.cradleZ - 0.5;
  const w = RIG.deckHalfWide * 2;
  const front = box(w, 0.04, half - pitFront, chequer, 0, DECK - 0.02, (half + pitFront) / 2, body);
  const rear = box(w, 0.04, pitBack + half, chequer, 0, DECK - 0.02, (pitBack - half) / 2, body);
  for (const m of [front, rear]) { // the plate's pattern repeats every 12 cm
    const uv = m.geometry.attributes.uv;
    const sx = w / 0.25;
    const sz = m.geometry.parameters.depth / 0.25;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sz);
  }
  // The pit: a dark floor, lined at the sides, and hazard stripes along its front and rear edges.
  const pitLen = pitFront - pitBack;
  box(w - 0.02, 0.02, pitLen, MAT.pit, 0, 0.16, RIG.cradleZ, body);
  for (const s of [-1, 1]) box(0.03, DECK - 0.16, pitLen, MAT.darkSteel, s * (RIG.deckHalfWide - 0.04), (DECK + 0.16) / 2, RIG.cradleZ, body);
  const hazard = hazardMaterial();
  for (const z of [pitFront - 0.03, pitBack + 0.03]) box(w - 0.1, 0.012, 0.06, hazard, 0, DECK + 0.004, z, body);
  for (const z of [pitFront, pitBack]) box(w - 0.04, DECK - 0.15, 0.025, MAT.darkSteel, 0, (DECK + 0.15) / 2, z, body); // the lining at the ends
  // Side rails: a steel angle along each edge (a toe rail), with the D-rings the straps hook to.
  for (const s of [-1, 1]) {
    box(0.05, 0.06, half * 2, PART_MAT.galv, s * (RIG.deckHalfWide - 0.01), DECK + 0.03, 0, body);
    box(0.025, 0.06, half * 2, PART_MAT.galv, s * (RIG.deckHalfWide + 0.012), DECK - 0.03, 0, body);
    for (const dz of [-0.45, 0.45]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 5, 10), PART_MAT.nut);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(s * (RIG.deckHalfWide - 0.07), DECK + 0.012, RIG.cradleZ + dz);
      ring.rotation.x = 0.0;
      body.add(ring);
      box(0.05, 0.02, 0.06, PART_MAT.nut, s * (RIG.deckHalfWide - 0.07), DECK + 0.004, RIG.cradleZ + dz, body);
    }
  }
}

function addChassis(body) {
  const half = RIG.deckHalf;
  const gal = PART_MAT.galv;
  for (const s of [-1, 1]) {
    beam(body, [s * 0.92, 0.22, -half], [s * 0.92, 0.22, half], 0.08, 0.12, MAT.chassis);
    // The A-frame tongue to the coupling.
    beam(body, [s * 0.9, 0.26, half - 0.1], [s * 0.05, 0.46, half + 1.45], 0.06, 0.06, MAT.chassis);
  }
  for (const z of [-half + 0.1, -1.05, 0.2, 1.05, half - 0.1]) box(1.9, 0.07, 0.07, MAT.chassis, 0, 0.255, z, body); // cross members
  box(0.14, 0.09, 0.3, gal, 0, 0.47, half + 1.38, body); // the coupling head
  box(0.1, 0.09, 0.16, PART_MAT.steel, 0, 0.5, half + 1.52, body);
  const lever = box(0.025, 0.025, 0.28, MAT.red, 0, 0.58, half + 1.2, body); // the handbrake lever
  lever.rotation.x = -0.5;
  addChain(body, [-0.07, 0.5, half + 1.25], [0.07, 0.5, half + 1.25], 8, 0.09);
  addJockeyWheel(body, 0.0, 0.46, half + 0.9);
  // Four steadies wound down at the corners, with their foot plates.
  for (const [x, z] of [[-1.0, half - 0.1], [1.0, half - 0.1], [-1.0, -half + 0.12], [1.0, -half + 0.12]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.26, 8), MAT.steel);
    leg.position.set(x, 0.17, z);
    body.add(leg);
    box(0.12, 0.012, 0.12, MAT.steel, x, 0.012, z, body);
    box(0.06, 0.05, 0.06, MAT.steel, x, 0.3, z, body);
  }
  addRearLights(body, 0.95, 0.5, -half - 0.12, true);
}

function addAxle(body) {
  const axle = new THREE.Group();
  axle.position.set(0, 0, 0.95);
  body.add(axle);
  box(2.3, 0.07, 0.07, MAT.steel, 0, 0.3, 0, axle);
  for (const s of [-1, 1]) {
    const wheel = buildWheel(s < 0 ? 'wheelL' : 'wheelR', s * 1.2, 0.3, 0.2, 'atv');
    wheel.userData.keep = false; // the trailer never rolls here, so the wheels can be merged with the rest
    wheel.getObjectByName('spin').userData.keep = false;
    axle.add(wheel);
    addMudguard(axle, s * 1.2, 0.3, 0.26, MAT.chassis, 1.0);
  }
}

function addHeadboard(body) {
  const z = RIG.deckHalf - 0.12;
  for (const s of [-1, 1]) {
    box(0.06, 1.75, 0.06, MAT.chassis, s * 0.96, DECK + 0.875, z, body);
    box(0.08, 0.04, 0.08, MAT.steel, s * 0.96, DECK + 0.02, z, body);
  }
  box(2.0, 0.06, 0.06, MAT.chassis, 0, DECK + 1.72, z, body);
  box(2.0, 0.05, 0.05, MAT.chassis, 0, DECK + 0.8, z, body);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.84, 0.58), signMaterial());
  mesh.rotation.y = Math.PI; // faces the ramp (-z)
  mesh.position.set(0, DECK + 1.25, z - 0.035);
  body.add(mesh);
  const back = box(1.88, 0.62, 0.02, MAT.chassis, 0, DECK + 1.25, z, body);
  back.castShadow = false;
  // Bolts at the sign's corners.
  for (const [x, y] of [[-0.86, 0.97], [0.86, 0.97], [-0.86, 1.53], [0.86, 1.53]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 6), PART_MAT.nut);
    bolt.rotation.x = Math.PI / 2;
    bolt.position.set(x, DECK + y - 0.0, z - 0.046);
    body.add(bolt);
  }
}

function addFan(root) {
  const g = new THREE.Group();
  g.position.set(0.3, DECK, 1.45);
  root.add(g);
  box(0.5, 0.025, 0.4, MAT.darkSteel, 0, 0.012, 0, g);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.58, 10), PART_MAT.galv);
  pole.position.y = 0.3;
  g.add(pole);
  for (const s of [-1, 1]) { // the two feet that brace the stand
    const foot = box(0.04, 0.03, 0.4, MAT.darkSteel, s * 0.18, 0.04, 0, g);
    foot.rotation.y = s * 0.2;
  }
  const head = new THREE.Group();
  head.position.y = 0.6;
  head.scale.setScalar(0.78); // a bench fan, so the sign behind it stays readable
  g.add(head);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 14), MAT.grey);
  motor.rotation.x = Math.PI / 2;
  motor.position.z = 0.12;
  head.add(motor);
  for (const r of [0.34, 0.2]) { // the cage: two rings, spokes
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.007, 5, 28), MAT.chrome);
    ring.position.z = -0.03;
    head.add(ring);
  }
  for (let i = 0; i < 8; i++) {
    const spoke = box(0.008, 0.34, 0.008, MAT.chrome, 0, 0, -0.03, head);
    spoke.position.set(Math.sin((i / 8) * Math.PI) * 0, 0, -0.03);
    spoke.rotation.z = (i / 8) * Math.PI;
    spoke.castShadow = false;
  }
  const blades = new THREE.Group();
  blades.name = 'fanBlades';
  blades.userData.keep = true;
  blades.position.z = 0.0;
  for (let i = 0; i < 5; i++) {
    const blade = box(0.09, 0.3, 0.012, MAT.black, 0, 0.15, 0, blades);
    blade.rotation.x = 0.0;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 5) * Math.PI * 2;
    arm.add(blade);
    blades.add(arm);
  }
  head.add(blades);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), MAT.chrome);
  cap.position.z = -0.01;
  head.add(cap);
  head.rotation.y = Math.PI; // faces the ramp
  head.rotation.x = 0.0;
  const lead = addCable(g, [[0, 0.02, 0.05], [-0.2, 0.01, 0.2], [-0.5, 0.02, 0.28]], 0.007, 0.01);
  lead.castShadow = false;
  mergeStatic(g);
  return blades;
}

function addToolChest(body) {
  const g = new THREE.Group();
  g.position.set(-0.68, DECK, 1.5);
  body.add(g);
  box(0.62, 0.74, 0.44, MAT.red, 0, 0.45, 0, g);
  box(0.64, 0.03, 0.46, MAT.darkSteel, 0, 0.83, 0, g); // the lid
  for (let i = 0; i < 4; i++) { // drawers, each with a chrome handle
    box(0.56, 0.005, 0.01, MAT.black, 0, 0.18 + i * 0.16, -0.225, g);
    box(0.22, 0.014, 0.014, MAT.chrome, 0, 0.26 + i * 0.16, -0.235, g);
  }
  for (const [x, z] of [[-0.25, -0.15], [0.25, -0.15], [-0.25, 0.15], [0.25, 0.15]]) { // the castors
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10), MAT.black);
    c.rotation.z = Math.PI / 2;
    c.position.set(x, 0.045, z);
    g.add(c);
  }
  box(0.04, 0.5, 0.025, MAT.chrome, 0.33, 0.55, 0.0, g); // the side handle
  box(0.3, 0.07, 0.2, MAT.orange, -0.1, 0.885, 0, g); // a socket case on top
  box(0.12, 0.012, 0.06, MAT.chrome, -0.1, 0.925, 0, g);
  const can = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.14, 10), MAT.cream); // an oil can
  can.position.set(0.18, 0.92, 0.05);
  g.add(can);
  const spout = beam(g, [0.18, 0.99, 0.05], [0.26, 1.04, 0.05], 0.012, 0.012, MAT.chrome);
  spout.castShadow = false;
  // The fire extinguisher stood beside it, and a bucket with rags.
  const ext = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.36, 12), MAT.red);
  ext.position.set(-0.46, 0.18, 0.08);
  g.add(ext);
  const exTop = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, 0.06, 10), MAT.black);
  exTop.position.set(-0.46, 0.39, 0.08);
  g.add(exTop);
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.115, 0.28, 12), MAT.grey);
  bucket.position.set(0.5, 0.14, 0.3);
  g.add(bucket);
  const rag = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 5), MAT.cream);
  rag.scale.y = 0.5;
  rag.position.set(0.5, 0.29, 0.3);
  g.add(rag);
}

function addReel(body) {
  const g = new THREE.Group();
  g.position.set(0.82, DECK, 1.62);
  body.add(g);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.2, 18), MAT.black);
  drum.rotation.z = Math.PI / 2;
  drum.position.y = 0.3;
  g.add(drum);
  for (const s of [-1, 1]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 18), MAT.orange);
    flange.rotation.z = Math.PI / 2;
    flange.position.set(s * 0.11, 0.3, 0);
    g.add(flange);
  }
  const frame = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 5, 14, Math.PI), MAT.steel);
  frame.rotation.y = Math.PI / 2;
  frame.position.set(0, 0.3, 0);
  g.add(frame);
  box(0.4, 0.02, 0.4, MAT.steel, 0, 0.012, 0, g);
}

function addStains(body) {
  const mat = stainMaterial();
  for (const [x, z, s] of [[-0.2, -1.4, 0.5], [0.5, RIG.cradleZ + 0.75, 0.36], [-0.5, -0.05, 0.3], [0.1, 1.0, 0.28]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, DECK + 0.002, z);
    body.add(m);
  }
}

function addRamp(root) {
  const pivot = new THREE.Group();
  pivot.name = 'ramp';
  pivot.userData.keep = true;
  pivot.position.set(0, DECK, -RIG.deckHalf);
  const L = RIG.rampLength;
  const w = RIG.rampHalfWide * 2;
  const chequer = chequerPlate();
  const surface = box(w, 0.04, L, chequer, 0, -0.02, -L / 2, pivot);
  const uv = surface.geometry.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / 0.25), uv.getY(i) * (L / 0.25));
  for (const s of [-1, 1]) {
    box(0.04, 0.08, L, PART_MAT.galv, s * (RIG.rampHalfWide - 0.02), 0.0, -L / 2, pivot);
    box(0.03, 0.05, L - 0.3, MAT.chassis, s * (RIG.rampHalfWide - 0.02), -0.05, -L / 2, pivot);
  }
  for (let i = 1; i < 9; i++) box(w - 0.1, 0.012, 0.025, PART_MAT.nut, 0, 0.004, -i * (L / 9), pivot); // the cleats
  const nose = box(w, 0.012, 0.2, PART_MAT.galv, 0, -0.012, -L - 0.07, pivot);
  nose.rotation.x = 0.0;
  box(w + 0.06, 0.05, 0.06, MAT.steel, 0, -0.03, 0.0, pivot); // the hinge
  for (const s of [-1, 1]) { // and the lashing eyes with the ramp's two lift chains
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.006, 5, 8), PART_MAT.nut);
    eye.position.set(s * (RIG.rampHalfWide - 0.05), 0.0, -L + 0.12);
    pivot.add(eye);
  }
  root.add(pivot);
  mergeStatic(pivot);
  return pivot;
}

function addStraps(root) {
  const g = new THREE.Group();
  g.name = 'straps';
  g.userData.keep = true;
  g.visible = false;
  for (const s of [-1, 1]) {
    for (const dz of [-0.45, 0.45]) {
      const from = new THREE.Vector3(s * (RIG.deckHalfWide - 0.07), DECK + 0.02, RIG.cradleZ + dz);
      const to = new THREE.Vector3(s * 0.46, DECK + 0.5, RIG.cradleZ + dz * 0.8);
      const len = from.distanceTo(to);
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.006, len), MAT.strap);
      strap.position.copy(from).add(to).multiplyScalar(0.5);
      strap.lookAt(to);
      strap.rotateZ(Math.PI / 2); // flat side to the quad
      g.add(strap);
      const ratchet = box(0.05, 0.05, 0.07, MAT.chrome, from.x - s * 0.01, from.y + 0.06, from.z, g);
      ratchet.castShadow = false;
    }
  }
  root.add(g);
  mergeStatic(g);
  return g;
}

function addPost(root) {
  const g = new THREE.Group();
  g.name = 'post';
  g.position.set(RIG.postX, 0, RIG.postZ);
  g.rotation.y = Math.atan2(-0.89, -0.46); // the screen turns in towards the ramp and the cradle
  root.add(g);
  box(0.3, 0.02, 0.3, MAT.darkSteel, 0, 0.01, 0, g);
  for (const [x, z] of [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]]) {
    const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.012, 6), PART_MAT.nut);
    bolt.position.set(x, 0.026, z);
    g.add(bolt);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.0, 10), galvanised());
  pole.position.y = 0.52;
  g.add(pole);
  // The enclosure with its screen, tilted back a little, a hood over it and a green button below.
  const head = new THREE.Group();
  head.position.set(0, 1.18, 0.0);
  head.rotation.x = -0.22;
  g.add(head);
  box(0.46, 0.36, 0.12, MAT.darkSteel, 0, 0, 0, head);
  const screen = new RoadScreen();
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, emissive: 0xffffff, emissiveMap: screen.texture ?? null, emissiveIntensity: 0.9 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.25), screenMat);
  face.name = 'screenFace'; // named so the merge below keeps its UVs
  face.position.set(0, 0.03, 0.062);
  head.add(face);
  box(0.44, 0.03, 0.1, MAT.black, 0, 0.17, 0.07, head); // the hood
  box(0.36, 0.04, 0.012, MAT.black, 0, -0.14, 0.064, head); // a label strip
  const button = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 12), new THREE.MeshStandardMaterial({ color: 0x2a9c3f, roughness: 0.4, emissive: 0x0a2a10 }));
  button.rotation.x = Math.PI / 2;
  button.position.set(0.14, -0.14, 0.075);
  head.add(button);
  const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.05, 6), MAT.black);
  gland.position.set(-0.12, -0.2, 0.0);
  head.add(gland);
  // The beacon on top, which lights while a run is on.
  const beaconMat = new THREE.MeshStandardMaterial({ color: 0x8a4a08, roughness: 0.3, emissive: 0x000000 });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.07, 10), beaconMat);
  beacon.position.set(0, 0.23, 0);
  head.add(beacon);
  // The lead from the post's foot to the reel on the deck.
  addCable(root, [[RIG.postX - 0.05, 0.03, RIG.postZ + 0.05], [RIG.postX - 0.3, 0.02, RIG.postZ + 1.2], [RIG.deckHalfWide + 0.02, DECK - 0.02, 1.4], [0.85, DECK + 0.05, 1.62]], 0.012, 0.04);
  mergeStatic(g);
  g.userData.screen = screen;
  g.userData.beaconMat = beaconMat;
  g.userData.buttonPos = new THREE.Vector3(0, 1.15, 0.12);
  return g;
}

/** The whole rig's trailer. See the file header for the tree. */
export function buildRollingRoadModel() {
  const root = new THREE.Group();
  root.name = 'rolling-road-trailer';
  const body = new THREE.Group();
  body.name = 'body';
  root.add(body);
  addChassis(body);
  addAxle(body);
  addDeck(body);
  addHeadboard(body);
  addToolChest(body);
  addReel(body);
  addStains(body);
  const rollerA = rollerMesh(1.6);
  const rollerB = rollerMesh(1.6);
  rollerA.name = 'rollerA';
  rollerB.name = 'rollerB';
  rollerA.position.set(0, DECK + 0.02 - ROLLER_R, RIG.cradleZ + RIG.rollerGap / 2);
  rollerB.position.set(0, DECK + 0.02 - ROLLER_R, RIG.cradleZ - RIG.rollerGap / 2);
  root.add(rollerA, rollerB);
  for (const z of [RIG.cradleZ + RIG.rollerGap / 2, RIG.cradleZ - RIG.rollerGap / 2]) { // the bearings the rollers turn in
    for (const s of [-1, 1]) {
      box(0.1, 0.12, 0.1, MAT.steel, s * 0.85, DECK + 0.02 - ROLLER_R, z, body);
      box(0.12, 0.02, 0.12, MAT.darkSteel, s * 0.85, 0.17, z, body);
    }
  }
  const blades = addFan(root);
  const ramp = addRamp(root);
  const straps = addStraps(root);
  const post = addPost(root);
  mergeStatic(body);
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  root.userData = { ramp, rollers: [rollerA, rollerB], blades, straps, post, screen: post.userData.screen, beaconMat: post.userData.beaconMat };
  poseRamp(root, 0);
  return root;
}

const RAMP_UP = Math.PI / 2;

/** Folds the ramp up against the back of the deck (0, as it travels) or lowers it to the ground (1). `drop` is how far the deck is above the ground at the ramp's foot. */
export function poseRamp(model, k, drop = DECK) {
  const c = Math.max(0, Math.min(1, k));
  const down = -Math.asin(Math.max(-0.5, Math.min(0.5, drop / RIG.rampLength)));
  model.userData.ramp.rotation.x = RAMP_UP + (down - RAMP_UP) * c;
}

/** Turns the rollers and the fan: `rollerAngle` and `fanAngle` in radians. */
export function spinRollers(model, rollerAngle, fanAngle) {
  for (const r of model.userData.rollers) r.rotation.x = rollerAngle;
  model.userData.blades.rotation.z = fanAngle;
}

/** The beacon lights while a run is on, and the straps show while the quad is held. */
export function setRunning(model, on) {
  model.userData.straps.visible = on;
  const m = model.userData.beaconMat;
  m.emissive.setHex(on ? 0xff8a1a : 0x000000);
  m.emissiveIntensity = on ? 1.6 : 0;
}
