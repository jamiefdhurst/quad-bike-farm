import * as THREE from 'three';
import { buildQuadModel } from '../vehicle/quadModel.js';
import { buildTipTrailerModel, TIP_TRAILER_SPEC } from '../vehicle/tipTrailerModel.js';
import { WHEELS } from '../vehicle/quadPhysics.js';
import { rod } from '../vehicle/quadGeometry.js';

// The neighbour's two working vehicles (#925), parked in her yard as scenery: the farm quad she moves the herd with, and the tipping trailer she carries feed and
// bedding in. Both are the farm's own models (the Farm 300's body and the tipper) with what use does to them; trafficView.js `MODELS` builds them like any other,
// and `look` is what the farm's seed dealt (neighbourFarm.js `dealNeighbourVehicles`), so no two farms' are alike.

export const FARM_QUAD_GROUND_OFFSET = -0.36; // chassis origin to the ground at rest, as vehicle/quad.js has it
export const FARM_QUAD_LAYOUT = { wheels: WHEELS.map((w) => ({ ...w, radius: 0.3 })) };
export const TIP_TRAILER_LAYOUT = { wheels: [{ name: 'wheelLeft', x: TIP_TRAILER_SPEC.halfWidth + 0.11, z: 0, radius: TIP_TRAILER_SPEC.wheelRadius }, { name: 'wheelRight', x: -(TIP_TRAILER_SPEC.halfWidth + 0.11), z: 0, radius: TIP_TRAILER_SPEC.wheelRadius }] };

/** What the farm seed deals when nothing has (a test, a layout without a deal): the same look every time. */
export const DEFAULT_QUAD_LOOK = { fade: 0.5, crate: 0x2c5ea6, blanket: 0, mud: 1, seed: 3 };
export const DEFAULT_TRAILER_LOOK = { rust: 0.55, straw: 0.5, tarp: 0x2f5f8a, seed: 5 };

const rnd = (seed) => {
  let n = (seed * 2654435761) % 2147483647 || 1;
  return () => ((n = (n * 16807) % 2147483647) / 2147483647);
};

const MUD = [new THREE.MeshStandardMaterial({ color: 0x4a3a28, roughness: 1 }), new THREE.MeshStandardMaterial({ color: 0x5f4b34, roughness: 1 })];
const CORD = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
const HOOK = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.4, metalness: 0.7 });

/** A dog's blanket's weave: a tartan of two stripes over a dull red, on a canvas; the colour alone with no canvas. Four to choose from (`kind`). */
function blanketMaterial(kind) {
  const bases = [['#6b2a24', '#2c4a34', '#c9a24a'], ['#2f3e56', '#7a2a26', '#d4c8a8'], ['#4a3a2a', '#6a7a4a', '#b8b0a0'], ['#3a4a3a', '#8a6a2a', '#c8c0a8']];
  const [base, a, b] = bases[kind % bases.length];
  if (typeof document === 'undefined') return new THREE.MeshStandardMaterial({ color: base, roughness: 1 });
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 64, 64);
  g.globalAlpha = 0.7;
  g.fillStyle = a;
  for (const p of [8, 40]) {
    g.fillRect(p, 0, 9, 64);
    g.fillRect(0, p, 64, 9);
  }
  g.globalAlpha = 0.9;
  g.fillStyle = b;
  for (const p of [28, 52]) {
    g.fillRect(p, 0, 2, 64);
    g.fillRect(0, p, 64, 2);
  }
  g.globalAlpha = 0.18; // the worn nap: dog hair and dirt
  for (let i = 0; i < 90; i++) {
    g.fillStyle = i % 2 ? '#e8dcc0' : '#222';
    g.fillRect((i * 37) % 64, (i * 23) % 64, 2 + (i % 3), 1);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1.5, 1.5);
  return new THREE.MeshStandardMaterial({ map: tex, color: 0xffffff, roughness: 1, side: THREE.DoubleSide });
}

/** A blanket draped over a seat: its section across hugging the seat and falling off each side, swept from z 0.17 back to -0.4, wrinkled, with tartan UVs. */
function blanketGeometry(seed) {
  const section = [[-0.37, 0.8], [-0.36, 0.855], [-0.3, 0.898], [-0.14, 0.915], [0, 0.918], [0.14, 0.915], [0.3, 0.898], [0.36, 0.855], [0.37, 0.8]];
  const rows = 8;
  const random = rnd(seed + 11);
  const positions = [];
  const uvs = [];
  for (let j = 0; j <= rows; j++) {
    const z = 0.17 - (0.57 * j) / rows;
    for (const [x, y] of section) {
      const slide = j === rows ? 0.03 : 0; // the back edge has slumped a little
      positions.push(x * (1 + (random() - 0.5) * 0.03), y + 0.07 * (z + 0.18) - slide * (y > 0.85 ? 1 : 0) + (random() - 0.5) * 0.012, z);
      uvs.push(x * 1.4, z * 1.4);
    }
  }
  const index = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < section.length - 1; i++) {
      const a = j * section.length + i;
      index.push(a, a + section.length, a + 1, a + 1, a + section.length, a + section.length + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}

/** A plastic crate, `w` across, `d` along and `h` tall: a base, a rim band top and bottom, and the slots between four corner posts and two ribs a side. */
function crateParts(w, h, d, mat) {
  const parts = [];
  const add = (sx, sy, sz, x, y, z) => parts.push({ size: [sx, sy, sz], at: [x, y, z] });
  const t = 0.014;
  add(w, t, d, 0, t / 2, 0); // the floor
  for (const s of [-1, 1]) {
    for (const z of [-1, 1]) add(0.03, h, 0.03, s * (w / 2 - 0.015), h / 2, z * (d / 2 - 0.015)); // corner posts
    add(t, 0.034, d, s * (w / 2 - t / 2), h - 0.017, 0); // the sides' top band
    add(t, 0.034, d, s * (w / 2 - t / 2), 0.017, 0);
    add(t, 0.022, d, s * (w / 2 - t / 2), h * 0.5, 0); // a rib across the slots
    add(w - 0.04, 0.034, t, 0, h - 0.017, s * (d / 2 - t / 2)); // the ends'
    add(w - 0.04, 0.034, t, 0, 0.017, s * (d / 2 - t / 2));
    add(w - 0.04, 0.022, t, 0, h * 0.5, s * (d / 2 - t / 2));
    add(0.022, h - 0.07, t, s * w * 0.18, h / 2, d / 2 - t / 2); // a slot divider each end
    add(0.022, h - 0.07, t, s * w * 0.18, h / 2, -d / 2 + t / 2);
  }
  return parts.map((p) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(...p.size), mat);
    m.position.set(...p.at);
    return m;
  });
}

/**
 * The farm quad: the Farm 300 body (front and rear racks) in the layout's green, worn: its paint chalked and thin (`look.fade`), a plastic crate bungeed to the
 * rear rack, a dog's blanket over the seat and dried mud in the footwells.
 */
export function buildFarmQuad(colour, look = DEFAULT_QUAD_LOOK) {
  const object = buildQuadModel({ bodyColor: colour, dashStyle: 'farm300', style: 'utility' });
  const root = object.getObjectByName('bodyRoot');
  const random = rnd(look.seed);
  // The paint: chalked towards a dusty green-grey and dulled, so it reads as years out in the weather and not the showroom's. (Its own material, per quad.)
  const paint = root.getObjectByName('frontPanel')?.material;
  if (paint) {
    paint.color.lerp(new THREE.Color(0x8a8f72), 0.5 * look.fade);
    paint.roughness = 0.62 + 0.25 * look.fade;
  }
  // Mud, dried, in the footwells: flat clods and splashes over the plate where boots stand, thicker toward the heel.
  for (const side of [-1, 1]) {
    for (let i = 0; i < Math.round(9 * look.mud); i++) {
      const r = 0.025 + random() * 0.045;
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 6, 4), MUD[i % 2]);
      m.scale.set(1.2, 0.22, 1.5);
      m.position.set(side * (0.445 + (random() - 0.5) * 0.19), 0.335 + r * 0.1, -0.01 + (random() - 0.35) * 0.5);
      m.rotation.y = random() * 3;
      root.add(m);
    }
  }
  // The crate on the rear rack, over the rack's rail, with two bungee cords across its top hooked to the rack's side rails.
  const crateMat = new THREE.MeshStandardMaterial({ color: look.crate, roughness: 0.6 });
  const crate = new THREE.Group();
  crate.name = 'crate';
  for (const p of crateParts(0.42, 0.27, 0.3, crateMat)) crate.add(p);
  crate.position.set(0, 0.932, -0.95);
  crate.rotation.y = (random() - 0.5) * 0.08;
  root.add(crate);
  const top = 0.932 + 0.27;
  for (const z of [-0.86, -1.04]) {
    const pts = [[-0.415, 0.93, z], [-0.3, top + 0.006, z], [0.3, top + 0.006, z], [0.415, 0.93, z]];
    for (let i = 0; i < pts.length - 1; i++) {
      const c = new THREE.Mesh(rod(pts[i], pts[i + 1], 0.006, 5), CORD);
      c.name = 'bungee';
      root.add(c);
    }
    for (const s of [-1, 1]) {
      const h = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.003, 4, 8), HOOK);
      h.position.set(s * 0.415, 0.93, z);
      h.rotation.y = Math.PI / 2;
      root.add(h);
    }
  }
  // The dog's blanket: a tartan square thrown over the rider's seat, hanging over the seat's sides and wrinkled, lying along the seat's tilt (quadModel.js: it falls away
  // to the back).
  const blanket = new THREE.Mesh(blanketGeometry(look.seed), blanketMaterial(look.blanket));
  blanket.name = 'blanket';
  root.add(blanket);
  return object;
}

export const buildFarmTrailer = (look = DEFAULT_TRAILER_LOOK) => buildTipTrailerModel({ farm: look });
