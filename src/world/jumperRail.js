import * as THREE from 'three';
import { JUMPERS } from '../npc/jumpers.js';

// The clothes rack in the barn where the jumpers hang: a freestanding rail on two legs, its bar running along the wall, with a
// baggy jumper on a hanger for each (grey and beige) unless a girl has it on. They hang edge-on to the wall, as clothes do on a
// rack. Each jumper is one soft knitted shape: a flattened body hanging from sloping shoulders round a ribbed neck, sleeves
// falling either side with a slight bend, ribbed cuffs and hem, and loose folds that deepen towards the hem.

const metal = new THREE.MeshStandardMaterial({ color: 0x55595c, roughness: 0.45, metalness: 0.7 });
const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.7 });

const smooth01 = (t) => {
  const k = Math.max(0, Math.min(1, t));
  return k * k * (3 - 2 * k);
};

// Sizes, in metres, of a hanging jumper. Its front faces +z; y = 0 is the top of the hanger's hook.
export const HANGING_JUMPER = {
  shoulderY: -0.07, // the shoulder seams, where the hanger holds it
  slope: 0.06, // how far the shoulders drop from the neck to the seam
  halfWidth: 0.23, // the body, at the chest
  halfDepth: 0.045, // front to back, hanging flat
  length: 0.58, // shoulder to hem
  neckX: 0.08, // half-width of the neck opening
  neckZ: 0.045,
  sleeveLength: 0.52,
  sleeveRadius: 0.055,
  rib: 0.06, // depth of the ribbed hem and cuffs
  ribShade: 0.78, // how much darker the ribbing is
};

/** A superellipse: a flattened loop with rounded ends, the shape of a garment hanging flat. */
function loop(halfW, halfD, ang, n = 3) {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [halfW * Math.sign(c) * Math.abs(c) ** (2 / n), halfD * Math.sign(s) * Math.abs(s) ** (2 / n)];
}

/**
 * The jumper's surface as rings of points, joined into one smooth mesh: [x, y, z, shade] per point, ring after ring, each
 * ring `around` points closing on itself. Pure: no Three.js objects, so it can be tested.
 */
/** Height of the shoulder line at x across a hanging jumper: highest at the neck, dropping to the seams. */
export function shoulderHeight(x, J = HANGING_JUMPER) {
  return J.shoulderY + 0.012 - J.slope * smooth01(Math.abs(x) / J.halfWidth);
}

export function hangingJumperRings(J = HANGING_JUMPER, around = 28) {
  const parts = [];
  const shoulderAt = (x) => shoulderHeight(x, J);
  // Body: from the ribbed neck up and over the shoulders, then down to the hem.
  const body = [];
  const neckRings = 3;
  const shoulderRings = 4;
  const bodyRings = 14;
  for (let k = 0; k < neckRings; k++) {
    // The neckband: a short rib standing up round the opening.
    const ring = [];
    for (let i = 0; i < around; i++) {
      const ang = (i / around) * Math.PI * 2;
      const [x, z] = loop(J.neckX + 0.004 * (k === 1 ? 1 : 0), J.neckZ, ang, 2.2);
      const dip = z > 0 ? 0.03 : 0.01; // the neck opening dips lower at the front than the back
      ring.push([x, J.shoulderY + 0.03 - dip - 0.012 * (neckRings - 1 - k), z, J.ribShade]);
    }
    body.push(ring);
  }
  for (let k = 1; k <= shoulderRings; k++) {
    // Out from the neck to the shoulder seams, over the hanger.
    const t = k / shoulderRings;
    const ring = [];
    for (let i = 0; i < around; i++) {
      const ang = (i / around) * Math.PI * 2;
      const [nx, nz] = loop(J.neckX, J.neckZ, ang, 2.2);
      const [bx, bz] = loop(J.halfWidth * 0.96, J.halfDepth * 0.8, ang);
      const x = nx + (bx - nx) * t;
      const z = nz + (bz - nz) * t;
      const dip = (z > 0 ? 0.03 : 0.01) * (1 - t);
      ring.push([x, shoulderAt(x) + 0.018 - dip - 0.012 * t * t, z, 1]);
    }
    body.push(ring);
  }
  for (let k = 1; k <= bodyRings; k++) {
    // Down to the hem: a little fuller through the middle, gathered by the rib at the bottom, with soft folds lower down.
    const v = k / bodyRings;
    const rib = smooth01((v - (1 - J.rib / J.length)) / 0.02);
    const width = J.halfWidth * (1 + 0.04 * Math.sin(Math.PI * v) - 0.07 * rib);
    const depth = J.halfDepth * (0.85 + 0.15 * Math.sin(Math.PI * Math.min(1, v * 1.3)) - 0.2 * rib);
    const ring = [];
    for (let i = 0; i < around; i++) {
      const ang = (i / around) * Math.PI * 2;
      const fold = 1 + 0.035 * v * Math.sin(5 * ang + 2.3) + 0.02 * v * Math.sin(9 * ang + 0.7);
      const [x, z] = loop(width * fold, depth * fold, ang);
      // The top of the body follows the shoulders; below that it hangs straight.
      const top = shoulderAt(x) - 0.01;
      const y = top + (J.shoulderY - J.slope - J.length - top) * v;
      ring.push([x, y, z, 1 - (1 - J.ribShade) * rib - 0.05 * v * Math.max(0, -Math.sin(5 * ang + 2.3))]);
    }
    body.push(ring);
  }
  parts.push(body);
  // Sleeves: from the shoulder seam, hanging down beside the body with a slight bend at the elbow, into a ribbed cuff.
  for (const side of [-1, 1]) {
    const sleeve = [];
    const rings = 12;
    for (let k = 0; k <= rings; k++) {
      const t = k / rings;
      const cx = side * (J.halfWidth + 0.02 + 0.035 * Math.sin(Math.PI * t * 0.9) - 0.03 * (1 - Math.min(1, t * 4)));
      const cy = J.shoulderY - J.slope - 0.01 - J.sleeveLength * t;
      const cz = 0.01 * Math.sin(Math.PI * t);
      const rib = smooth01((t - (1 - J.rib / J.sleeveLength)) / 0.03);
      const r = J.sleeveRadius * (1 - 0.2 * t) * (1 - 0.18 * rib);
      // Leaning out at the top, where it leaves the shoulder, then hanging straight.
      const lean = side * 0.5 * (1 - Math.min(1, t * 3));
      const ring = [];
      for (let i = 0; i < around; i++) {
        const ang = (i / around) * Math.PI * 2;
        const [ox, oz] = loop(r * 0.85, r * 0.62, ang, 2.4);
        ring.push([cx + ox * Math.cos(lean), cy + ox * Math.sin(lean), cz + oz, 1 - (1 - J.ribShade) * rib]);
      }
      sleeve.push(ring);
    }
    parts.push(sleeve);
  }
  return parts;
}

/** Rings to a smooth Three.js geometry with vertex colours (the jumper's colour, shaded per point). */
function ringsToGeometry(parts, color) {
  const base = new THREE.Color(color);
  const P = [];
  const C = [];
  const index = [];
  for (const rings of parts) {
    const start = P.length / 3;
    const around = rings[0].length;
    for (const ring of rings) {
      for (const [x, y, z, shade] of ring) {
        P.push(x, y, z);
        C.push(base.r * shade, base.g * shade, base.b * shade);
      }
    }
    for (let r = 0; r < rings.length - 1; r++) {
      for (let i = 0; i < around; i++) {
        const a = start + r * around + i;
        const b = start + r * around + ((i + 1) % around);
        const c = a + around;
        const d = b + around;
        index.push(a, c, b, b, c, d);
      }
    }
    // Close the end of each part (the hem and the cuffs) with a dark inside, so it doesn't look hollow from below.
    const last = rings[rings.length - 1];
    const centre = last.reduce((s, p) => [s[0] + p[0] / around, s[1] + p[1] / around, s[2] + p[2] / around], [0, 0, 0]);
    const ci = P.length / 3;
    P.push(centre[0], centre[1] + 0.02, centre[2]);
    C.push(base.r * 0.35, base.g * 0.35, base.b * 0.35);
    const lastStart = start + (rings.length - 1) * around;
    for (let i = 0; i < around; i++) index.push(lastStart + i, lastStart + ((i + 1) % around), ci);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}

function hangingJumper(color) {
  const g = new THREE.Group();
  const knit = new THREE.Mesh(ringsToGeometry(hangingJumperRings(), color), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, side: THREE.DoubleSide }));
  knit.castShadow = true;
  g.add(knit);
  // The hanger: a hook over the bar and a wooden shoulder bar inside the jumper, its ends just showing at the neck.
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.003, 6, 16, Math.PI * 1.3), metal);
  hook.position.set(0, -0.005, 0);
  hook.rotation.z = -0.3;
  g.add(hook);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.04, 6), metal);
  stem.position.set(0, -0.035, 0);
  g.add(stem);
  // Two arms following the slope of the shoulders, just under them, so the jumper hides them.
  for (const side of [-1, 1]) {
    const x0 = 0.03;
    const x1 = HANGING_JUMPER.halfWidth * 0.8;
    const y0 = shoulderHeight(x0) - 0.022;
    const y1 = shoulderHeight(x1) - 0.022;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0), 0.016, 0.022), wood);
    arm.position.set((side * (x0 + x1)) / 2, (y0 + y1) / 2, 0);
    arm.rotation.z = side * Math.atan2(y1 - y0, x1 - x0);
    g.add(arm);
  }
  // Turned so its front faces along the rack, not out into the barn.
  g.rotation.y = Math.PI / 2;
  return g;
}

/** The rack and its jumpers. `show` lists the ids that are hanging there. */
export class JumperRail {
  constructor(scene, layout, heightAt) {
    const r = layout.jumperRail;
    const floor = heightAt(r.x, r.z);
    this.group = new THREE.Group();
    this.group.name = 'jumperRack';
    this.group.position.set(r.x, floor, r.z);
    const add = (geo, x, y, z, rx = 0, rz = 0) => {
      const m = new THREE.Mesh(geo, metal);
      m.position.set(x, y, z);
      m.rotation.set(rx, 0, rz);
      m.castShadow = true;
      this.group.add(m);
    };
    const half = r.length / 2;
    // The bar, and at each end an upright with a foot, so it stands on its own.
    add(new THREE.CylinderGeometry(0.015, 0.015, r.length, 8), 0, r.y, 0, 0, Math.PI / 2);
    for (const side of [-1, 1]) {
      add(new THREE.CylinderGeometry(0.015, 0.015, r.y, 8), side * half, r.y / 2, 0);
      add(new THREE.BoxGeometry(0.05, 0.03, 0.6), side * half, 0.015, 0);
    }
    this.hung = {};
    JUMPERS.forEach((j, i) => {
      const jumper = hangingJumper(j.color);
      jumper.position.set((i - (JUMPERS.length - 1) / 2) * 0.5, r.y + 0.015, 0);
      this.group.add(jumper);
      this.hung[j.id] = jumper;
    });
    scene.add(this.group);
  }

  show(ids) {
    for (const [id, mesh] of Object.entries(this.hung)) mesh.visible = ids.includes(id);
  }
}
