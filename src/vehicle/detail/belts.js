import * as THREE from 'three';
import { cabMats, mesh, merge, rounded } from './parts.js';
import { cablePath } from './cables.js';

// Seat belts (TODO 340): webbing as a flat strip, the inertia reel low on the pillar, the D-loop at the shoulder, the tongue, and the
// buckle on its stalk. A belt group has a `stowed` and a `worn` child, as the game's belt poser (poseUtvBelts) expects; the pure
// part is where the webbing runs across someone sat in the seat (`beltRun`, tested).

/**
 * Where a worn belt runs, from the shoulder mount `top` across the chest to the `buckle`, and the lap part from the sill anchor
 * `low` to the buckle: points [x, y, z] in the vehicle's frame, laid over a person sat with their hips at `hip` (the seat point).
 * Returns { diagonal, lap }.
 */
export function beltRun({ top, low, buckle, hip }) {
  const [hx, hy, hz] = hip;
  const across = (t) => low[0] + (buckle[0] - low[0]) * t;
  // Over the shoulder (forward of the mount and down), across the chest to the far hip; the lap over the thighs.
  const diagonal = [top, [top[0] + (hx - top[0]) * 0.35, hy + 0.58, hz + 0.08], [hx, hy + 0.42, hz + 0.17], [buckle[0] * 0.6 + hx * 0.4, hy + 0.2, hz + 0.15], buckle];
  const lap = [low, [across(0.3), hy + 0.1, hz + 0.12], [across(0.7), hy + 0.1, hz + 0.13], buckle];
  return { diagonal: cablePath(diagonal, { sag: 0, steps: 4 }), lap: cablePath(lap, { sag: 0, steps: 4 }) };
}

/**
 * A flat strip `width` wide and `thick` thick along `points`, its flat face turned towards `face` ([x, y, z]: the way it lies,
 * forward for a belt across a chest). Webbing, straps, a fan belt.
 */
export function ribbonGeometry(points, width, thick, face = [0, 0, 1], { uv = false } = {}) {
  const pts = points.map((p) => new THREE.Vector3(...p));
  const f = new THREE.Vector3(...face).normalize();
  const pos = [];
  const idx = [];
  const uvs = [];
  let along = 0;
  const T = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3();
  for (let i = 0; i < pts.length; i++) {
    T.subVectors(pts[Math.min(i + 1, pts.length - 1)], pts[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(T, f);
    if (side.lengthSq() < 1e-8) side.set(1, 0, 0);
    side.normalize();
    up.crossVectors(side, T).normalize();
    if (i) along += pts[i].distanceTo(pts[i - 1]);
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const p = pts[i].clone().addScaledVector(side, (a * width) / 2).addScaledVector(up, (b * thick) / 2);
      pos.push(p.x, p.y, p.z);
      uvs.push(a < 0 ? 0 : 1, along); // across the strip, then along it in metres (the weave texture's repeat sets its scale)
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 4; k++) {
      const a = i * 4 + k;
      const b = i * 4 + ((k + 1) % 4);
      idx.push(a, b, a + 4, b, b + 4, a + 4);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/**
 * A lap-and-diagonal belt for one seat, named `belt_<name>` with `stowed` (hanging down the pillar from the D-loop, the tongue
 * loose at the reel) and `worn` (across the person) children, the worn one hidden. `top`: the D-loop on the pillar; `low`: the
 * reel and sill anchor; `buckle`: the buckle's top on the seat's inner side; `hip`: the seat point. `lapOnly` gives a plain lap belt
 * (a back seat's middle, an old Land Rover's). The D-loop, reel and buckle are added to the group itself, outside both.
 */
export function buildSeatBelt(name, { top, low, buckle, hip, lapOnly = false, mats = {} }) {
  const m = { ...cabMats(), ...mats };
  const web = mats.webbing ?? m.webbing;
  const group = new THREE.Group();
  group.name = `belt_${name}`;
  group.userData.keep = true;
  const stowed = new THREE.Group();
  stowed.name = 'stowed';
  const worn = new THREE.Group();
  worn.name = 'worn';
  worn.visible = false;
  group.add(stowed, worn);
  const out = Math.sign(top[0] - hip[0]) || 1; // which way the pillar is
  const face = [out, 0, 0]; // hanging down the pillar it lies flat against it
  if (!lapOnly) mesh(ribbonGeometry([top, [low[0], low[1] + 0.08, low[2]]], 0.046, 0.003, face), web, stowed, 'beltWebbing');
  mesh(rounded(0.03, 0.05, 0.008, 0.003).translate(low[0] - out * 0.01, low[1] + 0.1, low[2]), m.steel, stowed, 'beltTongue');
  const run = beltRun({ top, low, buckle, hip });
  const worns = [ribbonGeometry(run.lap, 0.046, 0.003, [0, 1, 0.4])];
  if (!lapOnly) worns.push(ribbonGeometry(run.diagonal, 0.046, 0.003, [0, 0.3, 1]));
  mesh(merge(worns), web, worn, 'beltWorn');
  // The fixed parts: the D-loop at the shoulder, the reel at the bottom of the pillar, the buckle on its stalk.
  if (!lapOnly) mesh(rounded(0.05, 0.03, 0.02, 0.008).translate(...top), m.plastic, group, 'beltLoop');
  mesh(rounded(0.06, 0.09, 0.05, 0.01).translate(low[0], low[1], low[2]), m.plastic, group, 'beltReel');
  mesh(rounded(0.035, 0.07, 0.03, 0.008).translate(buckle[0], buckle[1] - 0.03, buckle[2]), m.plastic, group, 'beltBuckle');
  mesh(rounded(0.024, 0.012, 0.022, 0.004).translate(buckle[0], buckle[1] + 0.008, buckle[2]), mats.button ?? m.red, group, 'beltButton');
  mesh(ribbonGeometry([[buckle[0], buckle[1] - 0.06, buckle[2]], [buckle[0], buckle[1] - 0.16, buckle[2] - 0.02]], 0.03, 0.004, [out, 0, 0]), m.plastic, group, 'beltStalk');
  return group;
}

// A buckled belt -------------------------------------------------------------------------------------

let weave = null;
/** The webbing's texture: a fine diagonal twill in dark grey, with a row of stitching just inside each edge. u across the strip, v along it. */
export function webbingMaterial(base = 0x2b2d30) {
  if (!weave) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2d30';
    g.fillRect(0, 0, 64, 128);
    g.strokeStyle = 'rgba(190,194,198,0.22)';
    g.lineWidth = 1.2;
    for (let i = -128; i < 192; i += 5) {
      g.beginPath();
      g.moveTo(0, i);
      g.lineTo(64, i + 64);
      g.stroke();
    }
    g.fillStyle = 'rgba(214,218,220,0.55)';
    for (const x of [6, 58]) for (let y = 0; y < 128; y += 8) g.fillRect(x - 0.7, y, 1.4, 5); // the edge stitching, dashes
    g.fillStyle = 'rgba(0,0,0,0.5)';
    for (const x of [2, 62]) g.fillRect(x - 1, 0, 2, 128); // the darker selvedge
    weave = new THREE.CanvasTexture(c);
    weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
    weave.colorSpace = THREE.SRGBColorSpace;
    weave.anisotropy = 4;
  }
  return new THREE.MeshStandardMaterial({ color: base === 0x2b2d30 ? 0xffffff : base, map: weave, roughness: 0.92 });
}

/** The steel tongue plate: a rounded plate with a long slot for the webbing across its top and the latch's hole low down. Its top is at y 0, the plate hangs down. */
export function tongueGeometry({ w = 0.038, h = 0.082, t = 0.004 } = {}) {
  const shape = new THREE.Shape();
  const r = 0.008;
  shape.moveTo(-w / 2 + r, 0);
  shape.lineTo(w / 2 - r, 0);
  shape.quadraticCurveTo(w / 2, 0, w / 2, -r);
  shape.lineTo(w / 2 - 0.006, -h + 0.016);
  shape.quadraticCurveTo(w / 2 - 0.006, -h, w / 2 - 0.014, -h);
  shape.lineTo(-w / 2 + 0.014, -h);
  shape.quadraticCurveTo(-w / 2 + 0.006, -h, -w / 2 + 0.006, -h + 0.016);
  shape.lineTo(-w / 2, -r);
  shape.quadraticCurveTo(-w / 2, 0, -w / 2 + r, 0);
  const slot = new THREE.Path();
  slot.absellipse(0, -0.016, w * 0.36, 0.0045, 0, Math.PI * 2, false); // the webbing's slot
  const hole = new THREE.Path();
  hole.absellipse(0, -h + 0.024, 0.0065, 0.0065, 0, Math.PI * 2, false); // the latch's hole
  shape.holes.push(slot, hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false, curveSegments: 8 });
  g.translate(0, 0, -t / 2);
  return g;
}

/**
 * A three-point belt with a proper buckle, for the UTV (and anything else that wants one): flat woven webbing with stitched edges, a steel
 * D-loop on the cage at the shoulder, a spring-loaded inertia reel at the foot of the belt, a steel tongue with its slot for the webbing and
 * its latch hole, and a buckle on a short strap out of the seat's crease, a black housing with a slot, a red release button and an arrow.
 * Worn, the webbing runs shoulder to chest to the tongue and the lap part from the reel across the lap to it, and the tongue stands
 * clicked into the buckle's slot; stowed, the webbing hangs from the loop down the seat back with the tongue parked on a stop button.
 * The group is `belt_<name>` with `stowed` and `worn` children (poseUtvBelts); the fixed parts (loop, reel, buckle, its strap) are on it.
 *   top: the D-loop; low: the reel; buckle: the buckle housing's top centre; hip: the seat point.
 */
export function buildBuckledBelt(name, { top, low, buckle, hip, faceZ = null, mats = {} }) {
  const m = { ...cabMats(), ...mats };
  const web = mats.webbing ?? webbingMaterial();
  const group = new THREE.Group();
  group.name = `belt_${name}`;
  group.userData.keep = true;
  const stowed = new THREE.Group();
  stowed.name = 'stowed';
  const worn = new THREE.Group();
  worn.name = 'worn';
  worn.visible = false;
  group.add(stowed, worn);
  const tongueAt = [buckle[0], buckle[1] + 0.075, buckle[2]]; // where the tongue's slot is when it is clicked in: just above the housing
  // Stowed: down from the loop over the seat back's face to the parked tongue, which hangs on the webbing's end just above the reel.
  const fz = faceZ ?? low[2] + 0.025; // the seat back's face, where it hangs when the loop is behind the seat
  const park = [low[0], low[1] + 0.14, fz];
  const over = faceZ === null ? [(top[0] + park[0]) / 2, (top[1] + park[1]) / 2, (top[2] + park[2]) / 2 + 0.012] : [top[0], top[1] - 0.03, (top[2] + fz) / 2 + 0.03]; // over the top of the seat back
  mesh(ribbonGeometry([top, over, [park[0], Math.min(top[1] - 0.07, park[1] + 0.5), fz - 0.002], park], 0.046, 0.0032, [0, 0, 1], { uv: true }), web, stowed, 'beltWebbing');
  const parked = mesh(tongueGeometry(), m.steel, stowed, 'beltTongue');
  parked.position.set(park[0], park[1] - 0.012, park[2] + 0.003);
  mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.01, 12).rotateX(Math.PI / 2), m.plastic, stowed, 'beltStop').position.set(park[0], park[1] - 0.095, park[2] + 0.004); // the button the tongue parks on
  // Worn: the run from the loop to the tongue and from the reel to it, ending in the tongue's slot.
  const run = beltRun({ top, low, buckle: tongueAt, hip });
  mesh(ribbonGeometry(run.lap, 0.046, 0.0032, [0, 1, 0.4], { uv: true }), web, worn, 'beltLap');
  mesh(ribbonGeometry(run.diagonal, 0.046, 0.0032, [0, 0.3, 1], { uv: true }), web, worn, 'beltSash');
  const tongue = mesh(tongueGeometry(), m.steel, worn, 'beltTongueWorn');
  tongue.position.set(tongueAt[0], tongueAt[1], tongueAt[2]);
  tongue.rotation.x = -0.35; // laid back with the lap, its bottom into the buckle's slot
  // The fixed parts. The D-loop: a flat steel plate bolted to the cage's bar with the webbing through a slot, and the bolt's head.
  const loop = mesh(tongueGeometry({ w: 0.056, h: 0.05, t: 0.005 }), m.steel, group, 'beltLoop');
  loop.position.set(top[0], top[1] + 0.012, top[2]);
  mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.008, 8).rotateX(Math.PI / 2), m.chrome, group, 'beltLoopBolt').position.set(top[0], top[1] + 0.022, top[2] + 0.004);
  // The reel: a black housing with a rounded cover on the face, the webbing's slot at its top, and two bolts.
  mesh(rounded(0.066, 0.1, 0.044, 0.012), m.plastic, group, 'beltReel').position.set(...low);
  mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.006, 18).rotateX(Math.PI / 2), m.greyPlastic, group, 'beltReelCover').position.set(low[0], low[1] - 0.01, low[2] + 0.025);
  mesh(rounded(0.05, 0.008, 0.01, 0.003), m.dark, group, 'beltReelSlot').position.set(low[0], low[1] + 0.05, low[2] + 0.012);
  for (const dy of [-0.034, 0.034]) mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.006, 6).rotateX(Math.PI / 2), m.chrome, group).position.set(low[0], low[1] + dy, low[2] + 0.026);
  // The buckle: a strap from the seat's crease, a black housing with the tongue's slot on its top, the red release button on its face
  // with an arrow, and a stamped steel frame round its lower part.
  const sx = buckle[0];
  mesh(ribbonGeometry([[sx, buckle[1] - 0.14, buckle[2] - 0.02], [sx, buckle[1] - 0.07, buckle[2] - 0.005]], 0.03, 0.005, [1, 0, 0], { uv: true }), web, group, 'beltStalk');
  mesh(rounded(0.04, 0.078, 0.026, 0.008), m.plastic, group, 'beltBuckle').position.set(sx, buckle[1] - 0.04, buckle[2]);
  mesh(rounded(0.043, 0.036, 0.029, 0.006), m.steel, group, 'beltBuckleFrame').position.set(sx, buckle[1] - 0.063, buckle[2]);
  mesh(rounded(0.03, 0.0035, 0.006, 0.0015), m.dark, group, 'beltBuckleSlot').position.set(sx, buckle[1] + 0.0005, buckle[2]);
  mesh(rounded(0.024, 0.02, 0.008, 0.004), mats.button ?? m.red, group, 'beltButton').position.set(sx, buckle[1] - 0.026, buckle[2] + 0.0135);
  const arrow = new THREE.Shape([new THREE.Vector2(0, 0.007), new THREE.Vector2(0.006, -0.004), new THREE.Vector2(-0.006, -0.004)]);
  mesh(new THREE.ShapeGeometry(arrow), m.chrome, group, 'beltButtonArrow').position.set(sx, buckle[1] - 0.027, buckle[2] + 0.0176);
  return group;
}
