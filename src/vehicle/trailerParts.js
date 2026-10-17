import * as THREE from 'three';
import { treadTyre } from './detail/tread.js';
import { boltsMesh, boltCircle } from './detail/fixings.js';
import { cableGeometry } from './detail/cables.js';
import { buildLamp } from './detail/lamps.js';
import { bentTube, rod } from './quadGeometry.js';

// Bits both trailers share, so the big and the small one are dressed alike: a wheel with a treaded tyre and nuts, a curved mudguard
// with a flap, a coupling for the drawbar, a jockey wheel, and lamps. Everything is procedural and built from the trailer's own
// measurements, so changing a model's look never moves a seat, a collider or a cargo spot.

export const PART_MAT = {
  steel: new THREE.MeshStandardMaterial({ color: 0x4a4c4e, roughness: 0.55, metalness: 0.5 }),
  paint: new THREE.MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.6, metalness: 0.3 }), // chassis green, a bit chipped looking
  galv: new THREE.MeshStandardMaterial({ color: 0x9aa3a6, roughness: 0.45, metalness: 0.6 }),
  rubber: new THREE.MeshStandardMaterial({ color: 0x1a1917, roughness: 0.95 }),
  tread: new THREE.MeshStandardMaterial({ color: 0x141312, roughness: 1 }),
  rim: new THREE.MeshStandardMaterial({ color: 0x8a2f24, roughness: 0.6 }),
  rimInside: new THREE.MeshStandardMaterial({ color: 0x3a1a15, roughness: 0.8, side: THREE.DoubleSide }),
  timber: new THREE.MeshStandardMaterial({ color: 0x6b5a45, roughness: 0.85 }),
  chain: new THREE.MeshStandardMaterial({ color: 0x5a5d60, roughness: 0.4, metalness: 0.8 }),
  cable: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.7 }),
  cableSpiral: new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 }),
  nut: new THREE.MeshStandardMaterial({ color: 0x777b7d, roughness: 0.4, metalness: 0.7 }),
  rust: new THREE.MeshStandardMaterial({ color: 0x6e4a33, roughness: 0.9, metalness: 0.2 }),
  flap: new THREE.MeshStandardMaterial({ color: 0x232221, roughness: 0.95 }),
  red: new THREE.MeshStandardMaterial({ color: 0xaa1111, roughness: 0.4, emissive: 0x330000 }),
  amber: new THREE.MeshStandardMaterial({ color: 0xcc7a10, roughness: 0.4, emissive: 0x2a1500 }),
  plate: new THREE.MeshStandardMaterial({ color: 0xe8d34a, roughness: 0.5 }),
};

export function box(w, h, d, mat, x, y, z, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * A wheel group named `name` at (x, radius, 0) with a child group `spin` that the game turns. The tyre is the kit's (detail/tread.js: `kind`,
 * 'farm' for the bale trailer's implement tyre, 'atv' for the little one's), the rim a pressed steel dish with its lip, a hub with its grease cap
 * and a ring of wheel nuts (detail/fixings.js), and a valve. `width` is the tyre's.
 */
export function buildWheel(name, x, radius, width, kind = 'farm') {
  const w = new THREE.Group();
  w.name = name;
  w.userData.keep = true;
  w.position.set(x, radius, 0);
  const spin = new THREE.Group();
  spin.name = 'spin';
  spin.userData.keep = true;
  w.add(spin);
  const side = Math.sign(x) || 1;
  const rimR = radius * 0.6;

  const tyre = new THREE.Mesh(treadTyre(kind, { radius, width, rimR, count: radius > 0.35 ? 12 : 12, segments: radius > 0.35 ? 28 : 22 }), PART_MAT.rubber);
  tyre.castShadow = true;
  tyre.receiveShadow = true;
  spin.add(tyre);
  // The rim: a drum a little narrower than the tyre, a dished face on the outside, the rolled lips, and the hub.
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(rimR, rimR, width * 0.9, 20, 1, true), PART_MAT.rim);
  drum.rotation.z = Math.PI / 2;
  drum.material = PART_MAT.rimInside;
  spin.add(drum);
  const face = new THREE.Mesh(new THREE.CylinderGeometry(rimR * 0.97, rimR * 0.78, 0.04, 20), PART_MAT.rim); // the dish: wider at the lip, narrowing to the hub
  face.rotation.z = Math.PI / 2;
  face.position.x = side * (width * 0.5 - 0.035);
  spin.add(face);
  for (const e of [-1, 1]) {
    const lip = new THREE.Mesh(new THREE.TorusGeometry(rimR, 0.012, 6, 20), PART_MAT.nut); // the rim's rolled edge
    lip.rotation.y = Math.PI / 2;
    lip.position.x = (e * width * 0.9) / 2;
    spin.add(lip);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.2, radius * 0.24, 0.07, 14), PART_MAT.nut);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = side * (width * 0.5 - 0.005);
  spin.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.11, radius * 0.13, 0.03, 12), PART_MAT.galv); // the grease cap
  cap.rotation.z = Math.PI / 2;
  cap.position.x = side * (width * 0.5 + 0.03);
  spin.add(cap);
  const nuts = boltsMesh(boltCircle(4, radius * 0.3), [0, 0, 1], PART_MAT.nut, { size: 0.016, kind: 'nut', name: 'wheelNuts' });
  nuts.rotation.y = side * Math.PI / 2; // the kit's circle is in XY facing +Z: turn it to face outwards along the axle
  nuts.position.x = side * (width * 0.5 - 0.01);
  spin.add(nuts);
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 6), PART_MAT.rubber);
  valve.position.set(side * (width * 0.5 - 0.06), rimR * 0.92, 0);
  spin.add(valve);
  return w;
}

/** A curved mudguard over a wheel at `x`, `radius` high, with a flap hanging off the back (+Z is towards the puller, so the back is -Z). */
export function addMudguard(parent, x, radius, width, mat, stayFrom) {
  const r = radius + 0.07;
  const geo = new THREE.CylinderGeometry(r, r, width, 20, 1, true, Math.PI / 2 - 1.15, 2.3);
  geo.rotateZ(Math.PI / 2); // axis along X; height is r sin(theta), forward is r cos(theta)
  const guard = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: mat.color, roughness: mat.roughness, metalness: mat.metalness, side: THREE.DoubleSide }));
  guard.position.set(x, radius, 0);
  guard.castShadow = true;
  guard.receiveShadow = true;
  parent.add(guard);
  // Rolled lip on the outside edge, and the flap.
  const lipSide = Math.sign(x) || 1;
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.01, r + 0.01, 0.025, 20, 1, true, Math.PI / 2 - 1.15, 2.3), guard.material);
  lip.geometry.rotateZ(Math.PI / 2);
  lip.position.set(x + (lipSide * width) / 2, radius, 0);
  parent.add(lip);
  // A stay from the guard's top in to the trailer, so it isn't floating.
  const stay = box(Math.abs(x) - stayFrom, 0.03, 0.12, mat, Math.sign(x) * (stayFrom + (Math.abs(x) - stayFrom) / 2), radius + r - 0.01, 0, parent);
  stay.castShadow = false;
  // The flap: hangs from the guard's rear lip. The guard ends at angle pi/2 + 1.15, 0.41 r above the axle and 0.91 r behind it: the flap's top edge is clamped
  // behind that lip by a bracket plate and two bolts, and hangs down to 12 cm off the ground.
  const lipY = radius + r * Math.sin(Math.PI / 2 - 1.15);
  const lipZ = -r * Math.cos(Math.PI / 2 - 1.15);
  const flapH = lipY - 0.12;
  box(width * 0.9, 0.06, 0.08, PART_MAT.steel, x, lipY - 0.01, lipZ - 0.03, parent); // the bracket plate that carries it, bridging the guard's lip
  const flap = box(width * 0.9, flapH, 0.02, PART_MAT.flap, x, lipY - flapH / 2, lipZ - 0.045, parent);
  flap.rotation.x = 0.04;
  parent.add(boltsMesh([-0.3, 0.3].map((k) => [x + k * width * 0.9, lipY - 0.02, lipZ - 0.056]), [0, 0, -1], PART_MAT.nut, { size: 0.01, kind: 'hex', name: 'flapBolts' }));
}

/**
 * The lights board across the back: a plate on two brackets carrying a lamp cluster at each end (the kit's tail lamp: red stop and tail, amber
 * indicator, clear reverse, facing back), a red triangle reflector under each, and the number plate between them with its lamp. `halfWidth` is where
 * the clusters sit. Returns the group (at the back, facing -Z).
 */
export function addRearLights(parent, halfWidth, y, z, withPlate = true) {
  const g = new THREE.Group();
  g.position.set(0, y, z);
  parent.add(g);
  box(halfWidth * 2 + 0.2, 0.09, 0.03, PART_MAT.paint, 0, 0.0, 0.035, g); // the board (its back face clear of the frame behind it)
  for (const s of [-1, 1]) {
    const lamp = buildLamp('tail', { w: 0.16, h: 0.075 });
    lamp.rotation.y = Math.PI; // facing back
    if (s > 0) lamp.scale.x = -1; // the left cluster is the right one's mirror image (red on the inside of each, amber and clear on the outside), not a copy of it
    lamp.position.set(s * halfWidth, 0.015, -0.005);
    g.add(lamp);
    const tri = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 3), PART_MAT.red); // a triangle reflector
    tri.rotation.x = Math.PI / 2;
    tri.position.set(s * (halfWidth - 0.18), 0.01, -0.012);
    g.add(tri);
    box(0.06, 0.1, 0.06, PART_MAT.steel, s * (halfWidth + 0.05), -0.07, 0.035, g); // its bracket down to the frame
  }
  if (withPlate) {
    // The plate sits in a steel holder (a backing plate a little bigger than it, with a lip along the bottom to rest it on), and the holder hangs from the board
    // on two stays, so it is held by something.
    box(0.36, 0.13, 0.012, PART_MAT.steel, 0, -0.125, 0.012, g); // the holder's backing plate
    box(0.36, 0.015, 0.04, PART_MAT.steel, 0, -0.185, -0.005, g); // its lip along the bottom
    box(0.32, 0.1, 0.01, PART_MAT.plate, 0, -0.125, 0.0035, g); // the plate, on the backing's face
    for (const s of [-1, 1]) box(0.03, 0.09, 0.02, PART_MAT.steel, s * 0.16, -0.075, 0.025, g); // the two stays from the board down to the holder
    box(0.34, 0.012, 0.03, PART_MAT.steel, 0, -0.063, -0.01, g); // and the plate lamp's hood over it
  }
  return g;
}

/**
 * A jockey wheel on a post under the drawbar at `z`, wound up clear of the ground: a clamp round the drawbar, a telescoping post with its
 * collar, the fork and the little treaded wheel between its plates, and the wind-up handle with its grip. `y` is where the post meets the drawbar.
 */
export function addJockeyWheel(parent, x, y, z) {
  const lift = 0.25; // wound up off the ground while it is hitched
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  parent.add(g);
  box(0.1, 0.07, 0.1, PART_MAT.steel, 0, y - 0.02, 0, g); // the clamp round the drawbar
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, (y - lift) * 0.5, 10), PART_MAT.galv);
  outer.position.y = y - 0.05 - (y - lift) * 0.25 + 0.05;
  g.add(outer);
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, (y - lift) * 0.6, 10), PART_MAT.steel);
  inner.position.y = lift + (y - lift) * 0.3 + 0.02;
  g.add(inner);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 10), PART_MAT.steel);
  collar.position.y = lift + (y - lift) * 0.6 + 0.02;
  g.add(collar);
  for (const s of [-1, 1]) box(0.012, 0.13, 0.12, PART_MAT.steel, s * 0.035, lift + 0.01, 0, g); // the fork's two plates
  const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.045, 14), PART_MAT.rubber);
  wheel.rotation.z = Math.PI / 2;
  wheel.position.set(0, lift - 0.03, 0);
  g.add(wheel);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.07, 8), PART_MAT.nut);
  hub.rotation.z = Math.PI / 2;
  hub.position.set(0, lift - 0.03, 0);
  g.add(hub);
  // The handle: a crank arm from the top of the post, with a grip, set off to one side.
  box(0.2, 0.018, 0.018, PART_MAT.steel, 0.1, y * 0.88, 0, g);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.1, 8), PART_MAT.rubber);
  grip.position.set(0.2, y * 0.88 + 0.045, 0);
  g.add(grip);
  g.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  return g;
}

/** A chain hanging in a loop between two points, as separate links (alternate ones turned a quarter), for a safety chain or a breakaway chain. */
export function addChain(parent, a, b, links = 9, sag = 0.07, mat = PART_MAT.chain) {
  const pts = [];
  for (let i = 0; i < links; i++) {
    const t = (i + 0.5) / links;
    pts.push(new THREE.Vector3(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - 4 * t * (1 - t) * sag, a[2] + (b[2] - a[2]) * t));
  }
  const link = new THREE.TorusGeometry(0.014, 0.0035, 4, 8);
  pts.forEach((p, i) => {
    const m = new THREE.Mesh(link, mat);
    m.position.copy(p);
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const prev = pts[Math.max(0, i - 1)];
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), next.clone().sub(prev).normalize()); // the link's ring faces along the chain...
    m.rotateZ(i % 2 ? Math.PI / 2 : 0); // ...turned a quarter each time
    parent.add(m);
  });
}

/** A cable (a breakaway cable, the lights' lead) clipped through `anchors` (the parent's frame), with a sag, as one tube. */
export function addCable(parent, anchors, r = 0.006, sag = 0.1, mat = PART_MAT.cable) {
  const m = new THREE.Mesh(cableGeometry(anchors, r, { sag, steps: 8, radial: 5 }), mat);
  parent.add(m);
  return m;
}

/** A leaf spring: the main leaf (an arc from eye to eye), `leaves` shorter ones under it, the eyes at each end, and a centre bolt, along Z at `x`, centred on z 0. */
export function addLeafSpring(parent, x, y, len, leaves = 3, mat = PART_MAT.steel) {
  const arc = bentTube([[x, y - 0.025, len / 2], [x, y + 0.02, len / 4], [x, y + 0.035, 0], [x, y + 0.02, -len / 4], [x, y - 0.025, -len / 2]], 0.014, { bend: 0.25, radial: 6 });
  parent.add(new THREE.Mesh(arc, mat));
  for (let i = 1; i <= leaves; i++) box(0.07, 0.014, len * (1 - i * 0.2), mat, x, y + 0.035 - i * 0.017, 0, parent); // the shorter leaves under it
  for (const e of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.012, 6, 10), mat); // the rolled eye
    eye.rotation.y = Math.PI / 2;
    eye.position.set(x, y - 0.03, (e * len) / 2);
    parent.add(eye);
  }
  box(0.025, 0.1, 0.025, PART_MAT.nut, x, y - 0.0, 0, parent); // the centre bolt
}

/** A pair of U-bolts holding an axle to its spring at (x, y, z0 and z1): two legs and a bridge across under the axle. */
export function addUBolts(parent, x, y, z, spacing = 0.12, r = 0.016) {
  for (const dz of [-spacing / 2, spacing / 2]) {
    for (const dx of [-0.032, 0.032]) parent.add(Object.assign(new THREE.Mesh(rod([x + dx, y + 0.07, z + dz], [x + dx, y - r - 0.04, z + dz], 0.005, 5), PART_MAT.nut)));
    box(0.08, 0.012, 0.016, PART_MAT.nut, x, y - r - 0.04, z + dz, parent);
  }
}

let galvTex = null;

/**
 * Hot-dip galvanised steel for a trailer's front metalwork: a pale zinc grey with the crystal "spangle" of the coating (lighter and darker flakes
 * in patches), a few scratches and the odd dull patch, on a canvas. Falls back to the plain steel where there is no canvas (a test without one).
 */
export function galvanised() {
  if (galvTex) return galvTex;
  if (typeof document === 'undefined') return (galvTex = PART_MAT.galv);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = 41;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.fillStyle = '#8f979a';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { // the spangle: little angular flakes of slightly different brightness
    const x = rand() * 128;
    const y = rand() * 128;
    const r = 3 + rand() * 9;
    g.fillStyle = rand() > 0.5 ? `rgba(255,255,255,${0.05 + rand() * 0.13})` : `rgba(40,48,52,${0.06 + rand() * 0.14})`;
    g.beginPath();
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + rand() * 0.5;
      g.lineTo(x + Math.cos(a) * r * (0.6 + rand() * 0.6), y + Math.sin(a) * r * (0.6 + rand() * 0.6));
    }
    g.fill();
  }
  g.strokeStyle = 'rgba(30,34,36,0.25)'; // scratches
  g.lineWidth = 0.7;
  for (let i = 0; i < 14; i++) {
    g.beginPath();
    const x = rand() * 128;
    const y = rand() * 128;
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 40, y + (rand() - 0.5) * 12);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  galvTex = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.5, metalness: 0.55 });
  return galvTex;
}

const _up = new THREE.Vector3(0, 1, 0);

/** A box beam of section `w` by `h` from point `a` to point `b` (the parent's frame), its long side along the line and its `h` kept upright. */
export function beam(parent, a, b, w, h, mat) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, len), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(B, A, _up)); // z along the beam
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A gusset plate: a flat triangle of steel `size` along each leg lying in the XZ plane at (x, y, z) (thickness `t`), the right angle at the corner, bolted at its two ends. */
export function addGusset(parent, x, y, z, size, mx, mz, mat, t = 0.008) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(size * mx, 0);
  shape.lineTo(0, size * mz);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false }).rotateX(Math.PI / 2); // lying flat, the shape's y along z
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y + t, z);
  m.castShadow = true;
  parent.add(m);
  parent.add(boltsMesh([[x + size * mx * 0.7, y + t, z + size * mz * 0.12], [x + size * mx * 0.12, y + t, z + size * mz * 0.7]], [0, 1, 0], PART_MAT.nut, { size: 0.01, kind: 'hex', name: 'gussetBolts' }));
  return m;
}

/** A chain eye: a small plate welded to the metal at (x, y, z) standing out along `dir` (+1 or -1 in x), with a ring through it for a chain's end. */
export function addEye(parent, x, y, z, dir = 1) {
  box(0.012, 0.045, 0.045, PART_MAT.steel, x + dir * 0.006, y, z, parent);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.014, 0.004, 5, 10), PART_MAT.chain);
  ring.rotation.y = Math.PI / 2;
  ring.position.set(x + dir * 0.02, y - 0.012, z);
  parent.add(ring);
}

let chequerMat = null;

/**
 * Aluminium chequer plate for the ramps' walking face: lozenge-shaped raised bars in rows turned a quarter turn from each other, bright on their tops and
 * shaded at their lower edges, on a brushed grey with scuffs worn through the pattern, tiling every 12 cm. Falls back to plain aluminium without a canvas.
 */
export function chequerPlate() {
  if (chequerMat) return chequerMat;
  if (typeof document === 'undefined') return (chequerMat = new THREE.MeshStandardMaterial({ color: 0x9aa0a4, roughness: 0.45, metalness: 0.7 }));
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#8d9498';
  g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 2) { // brushing
    g.fillStyle = y % 4 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    g.fillRect(0, y, 128, 1);
  }
  const bar = (cx, cy, angle) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(angle);
    g.fillStyle = 'rgba(30,34,38,0.55)'; // the shaded lower edge
    g.beginPath();
    g.ellipse(1.5, 2, 15, 4.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c4cacd'; // the bar's top
    g.beginPath();
    g.ellipse(0, 0, 15, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.beginPath();
    g.ellipse(-1, -1, 10, 1.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  };
  for (let row = 0; row < 2; row++) for (let col = 0; col < 2; col++) {
    bar(16 + col * 64 + (row ? 32 : 0), 16 + row * 64, ((row + col) % 2 ? 1 : -1) * Math.PI / 4);
    bar(48 + col * 64 + (row ? 32 : 0), 48 + row * 64 - (row ? 0 : 0), ((row + col) % 2 ? -1 : 1) * Math.PI / 4);
  }
  let seed = 17;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = 'rgba(40,44,48,0.3)'; // scuffs worn across the pattern
  g.lineWidth = 0.8;
  for (let i = 0; i < 16; i++) {
    const x = rand() * 128;
    const y = rand() * 128;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + (rand() - 0.5) * 50, y + (rand() - 0.5) * 14);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  chequerMat = new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 0.42, metalness: 0.65 });
  return chequerMat;
}

/** A flat face `w` by `len` facing the -Y side of its group (the ramp's walking face), with a texture repeating every `tile` metres, its length along +Z. */
export function walkingFace(parent, w, len, y, z, mat, tile = 0.12) {
  const geo = new THREE.PlaneGeometry(w, len).rotateX(Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w / tile), uv.getY(i) * (len / tile));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(0, y, z);
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
