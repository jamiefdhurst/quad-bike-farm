import * as THREE from 'three';
import { treadTyre } from '../vehicle/detail/tread.js';
import { TYRE_SIZES, tyrePart } from '../vehicle/tyres.js';

// The tyre rack along the annex's south wall: a timber and steel frame with two decks, a bay for each size of tyre (tyres.js TYRE_SIZES) with the
// tyres lying in a stack, as many as the spares shelf has (up to what the bay holds), and a card tag on the front rail that says the size and the
// count. Origin on the floor under the middle of the rack, the wall behind it (0.16 m back from the origin), facing +z. `setCounts` shows the stacks.

export const TYRE_RACK_WIDTH = 3.5;
const BAY = 0.85;
const DECKS = [0.22, 1.5]; // the height of each deck's top
const DEPTH = [-0.14, 0.72]; // back and front of a deck
const TOP = 2.7;

// Bottom row: the biggest tyres. Top row: the smaller ones. `radius` and `width` are for the stack in the bay (a little under the real thing for the big ones, so it fits).
const BAYS = [
  { size: 'tractor', label: 'TRACTOR', kind: 'tractor', radius: 0.38, width: 0.24, rimR: 0.22, lugs: 12 },
  { size: 'landrover', label: 'LAND ROVER', kind: 'allTerrain', radius: 0.34, width: 0.21, rimR: 0.19, lugs: 14 },
  { size: 'utv', label: 'UTILITY', kind: 'allTerrain', radius: 0.31, width: 0.19, rimR: 0.17, lugs: 14 },
  { size: 'quad', label: 'QUAD', kind: 'atv', radius: 0.28, width: 0.19, rimR: 0.15, lugs: 11 },
  { size: 'kid', label: 'SMALL QUAD', kind: 'farm', radius: 0.2, width: 0.13, rimR: 0.1, lugs: 10 },
  { size: 'sport', label: 'SPORT', kind: 'atv', radius: 0.26, width: 0.17, rimR: 0.13, lugs: 11 },
  { size: 'trike', label: 'BALLOON', kind: 'trike', radius: 0.27, width: 0.21, rimR: 0.13, lugs: 10 },
  { size: 'car', label: 'CAR', kind: 'road', radius: 0.26, width: 0.16, rimR: 0.16, lugs: 20 },
];
const STACK_HEIGHT = 1.12; // clear height above a deck

const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });

/** The tag's card: the size in capitals and, to the right, how many there are. Redrawn when the count changes. */
function drawTag(ctx, label, n) {
  ctx.fillStyle = '#e9e1c6';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#6b5a35';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#2a241a';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, 14, 34);
  ctx.textAlign = 'right';
  ctx.fillStyle = n > 0 ? '#2a241a' : '#a3281c';
  ctx.fillText(n > 0 ? `x ${n}` : 'NONE', 242, 34);
}

export function buildTyreRackModel() {
  const g = new THREE.Group();
  g.name = 'tyreRack';
  const M = {
    timber: mat(0x6a4c30, { roughness: 0.9 }),
    plank: mat(0x8a6a44, { roughness: 0.9 }),
    steel: mat(0x3d4144, { roughness: 0.5, metalness: 0.7 }),
    rubber: mat(0x1b1b1d, { roughness: 0.92 }),
  };
  const add = (geo, m, x, y, z, parent = g) => {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true;
    parent.add(o);
    return o;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const W = BAY * 4;
  const mid = (DEPTH[0] + DEPTH[1]) / 2;
  const depth = DEPTH[1] - DEPTH[0];

  // Five uprights front and back, each pair tied across the top and by a beam under each deck.
  for (let i = 0; i <= 4; i++) {
    const x = (i - 2) * BAY;
    for (const z of [DEPTH[0] - 0.03, DEPTH[1] + 0.03]) add(box(0.08, TOP, 0.08), M.timber, x, TOP / 2, z);
    add(box(0.06, 0.06, depth + 0.12), M.timber, x, TOP - 0.03, mid);
    for (const y of DECKS) add(box(0.06, 0.1, depth + 0.1), M.timber, x, y - 0.1, mid);
  }
  // Long rails: front and back at each deck and the top, and a pair of steel diagonal braces on the back so the whole rack stands square.
  for (const y of [...DECKS.map((d) => d - 0.1), TOP - 0.03]) {
    for (const z of [DEPTH[0] - 0.03, DEPTH[1] + 0.03]) add(box(W + 0.08, 0.1, 0.05), M.timber, 0, y, z);
  }
  for (const [x0, x1] of [[-2, -1], [1, 2]]) {
    const len = Math.hypot(BAY, DECKS[1] - DECKS[0] + 0.5);
    const brace = add(box(len, 0.035, 0.012), M.steel, ((x0 + x1) / 2) * BAY, (DECKS[0] + DECKS[1]) / 2 + 0.2, DEPTH[0] - 0.065);
    brace.rotation.z = Math.atan2(DECKS[1] - DECKS[0] + 0.5, BAY) * (x0 < 0 ? 1 : -1);
  }
  // Decks of boards, running front to back, with a gap between.
  for (const y of DECKS) {
    for (let i = 0; i < 20; i++) add(box(W / 20 - 0.012, 0.035, depth), M.plank, -W / 2 + (i + 0.5) * (W / 20), y - 0.0175, mid);
  }

  const stacks = [];
  BAYS.forEach((b, i) => {
    const top = i >= 4;
    const x = ((i % 4) - 1.5) * BAY;
    const deck = DECKS[top ? 1 : 0];
    // The tyre lies with its axle up, stacked and a little out of line, as they are put on.
    const geo = treadTyre(b.kind, { radius: b.radius, width: b.width, rimR: b.rimR, count: b.lugs, segments: 14 }).rotateZ(Math.PI / 2);
    const max = Math.min(5, Math.floor(STACK_HEIGHT / (b.width + 0.004)));
    const mesh = new THREE.InstancedMesh(geo, M.rubber, max);
    mesh.castShadow = mesh.receiveShadow = true;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let k = 0; k < max; k++) {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k * 1.9);
      m.compose(new THREE.Vector3(x + Math.sin(k * 2.3) * 0.02, deck + b.width / 2 + k * (b.width + 0.004), 0.29 + Math.cos(k * 1.7) * 0.015), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(k, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.frustumCulled = true;
    g.add(mesh);
    // The tag, tacked to the front rail of the deck.
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    drawTag(ctx, b.label, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const tag = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.075), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    tag.position.set(x, deck - 0.1, DEPTH[1] + 0.03 + 0.026);
    g.add(tag);
    stacks.push({ b, mesh, ctx, tex, shown: -1, label: -1 });
  });

  // Shows that many of each size, and writes the count on the tag.
  g.userData.setCounts = (counts) => {
    for (const s of stacks) {
      const n = counts[tyrePart(s.b.size)] ?? 0;
      s.mesh.count = Math.min(n, s.mesh.instanceMatrix.count);
      if (n !== s.label) {
        s.label = n;
        drawTag(s.ctx, s.b.label, n);
        s.tex.needsUpdate = true;
      }
    }
  };
  g.userData.sizes = Object.keys(TYRE_SIZES);
  return g;
}
