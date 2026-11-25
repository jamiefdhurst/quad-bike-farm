// The wet edge's and the grazed meadow's plants (#999), built once for every wet edge: a reed with flat streaked blades and a buff plume, a soft rush,
// a sedge, a meadow tussock, a spear thistle, a broad-leaved dock, a cowpat and a loose stone. They share one texture (`plantAtlas`): a reed blade
// greening to straw at its tip, a plume, a rush stem, a sedge blade, a thistle's spiny leaf, a dock's leaf and a white patch, which a part with only a
// colour of its own maps to, so its vertex colour shows. One material for the lot (`plantMaterial`), lit like the world. The Old Pit's relics (#1003)
// added a young birch (`birchModel`), with a bark column and a spray of birch leaves in the atlas, and use the reeds, rushes, sedge and tussocks too.

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from './outbuildingProps.js';

/** The atlas's columns, as [u0, u1] across it; v runs 0 at a blade's foot to 1 at its tip. `white` is a patch of plain white for coloured parts. */
export const ATLAS = { blade: [0, 0.125], plume: [0.125, 0.25], rush: [0.25, 0.375], sedge: [0.375, 0.5], thistle: [0.5, 0.625], dock: [0.625, 0.75], bark: [0.75, 0.8], white: [0.8, 0.9], birch: [0.9, 1] };

/** The plants' texture (`draw` given a 2D context, so a test can draw it on a stand-in). 256 by 256: six columns of 32 px, the white patch, and the birch's bark and leaves. */
export function drawPlantAtlas(g, w = 256, h = 256) {
  const col = (k) => ATLAS[k][0] * w;
  const cw = w / 8;
  const rnd = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; })();
  g.clearRect(0, 0, w, h);
  // Canvas y runs down and the texture's v up, so a blade's tip (v 1) is at the top.
  const blade = (k, foot, mid, tip, rib) => {
    const x0 = col(k);
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, foot);
    grad.addColorStop(0.6, mid);
    grad.addColorStop(0.86, mid);
    grad.addColorStop(1, tip);
    g.fillStyle = grad;
    g.fillRect(x0, 0, cw, h);
    for (let i = 0; i < 7; i++) { // the veins along it
      g.fillStyle = `rgba(255,255,230,${0.06 + rnd() * 0.06})`;
      g.fillRect(x0 + 2 + i * 4 + rnd(), 0, 1, h);
    }
    g.fillStyle = rib;
    g.fillRect(x0 + cw / 2 - 1, 0, 2, h); // the midrib
    for (let i = 0; i < 26; i++) { // flecks and the odd brown spot
      g.fillStyle = `rgba(${90 + rnd() * 40},${60 + rnd() * 30},${30},${0.2 + rnd() * 0.3})`;
      g.fillRect(x0 + rnd() * cw, rnd() * h, 1 + rnd() * 2, 2 + rnd() * 4);
    }
  };
  blade('blade', '#4f6a2c', '#6f8a3c', '#c2ab72', 'rgba(210,220,160,0.55)');
  blade('rush', '#2f4a22', '#3f5f2a', '#7c7a46', 'rgba(140,170,100,0.35)');
  blade('sedge', '#5f6e2a', '#90a04a', '#b8a35e', 'rgba(70,80,30,0.5)');
  // The plume: a drooping panicle of buff and purple-brown spikelets, see-through between them.
  {
    const x0 = col('plume');
    for (let i = 0; i < 420; i++) {
      const v = rnd();
      const spread = (0.25 + 0.75 * Math.sin(Math.PI * Math.min(1, v * 1.1))) * cw * 0.45;
      const x = x0 + cw / 2 + (rnd() - 0.5) * 2 * spread;
      const y = h * (1 - v);
      const l = 110 + rnd() * 60;
      g.fillStyle = rnd() < 0.3 ? `rgba(${l - 30},${l - 60},${l - 50},0.95)` : `rgba(${l + 40},${l + 20},${l - 20},0.95)`;
      g.fillRect(x, y, 1.5, 4 + rnd() * 5);
    }
    g.fillStyle = '#7a6a48';
    g.fillRect(x0 + cw / 2 - 1, 0, 2, h);
  }
  // The thistle's leaf: dark green, white-veined, with a ragged edge of spines (the rest of the column see-through).
  {
    const x0 = col('thistle');
    g.fillStyle = '#3f5a2a';
    g.beginPath();
    g.moveTo(x0 + cw / 2, h);
    for (let i = 0; i <= 12; i++) {
      const v = i / 12;
      const half = Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.03)) * cw * (i % 2 ? 0.48 : 0.28);
      g.lineTo(x0 + cw / 2 + half, h * (1 - v));
    }
    for (let i = 12; i >= 0; i--) {
      const v = i / 12;
      const half = Math.sin(Math.PI * Math.min(1, v * 1.05 + 0.03)) * cw * (i % 2 ? 0.48 : 0.28);
      g.lineTo(x0 + cw / 2 - half, h * (1 - v));
    }
    g.fill();
    g.fillStyle = 'rgba(225,230,200,0.6)';
    g.fillRect(x0 + cw / 2 - 1, 0, 2, h);
    for (let i = 1; i < 12; i++) { g.fillStyle = 'rgba(240,240,220,0.85)'; g.fillRect(x0 + (i % 2 ? cw - 3 : 1), h * (1 - i / 12), 2, 3); } // the spines' pale tips
  }
  // The dock's leaf: broad and oval, dark green with a reddish midrib and side veins.
  {
    const x0 = col('dock');
    const grad = g.createLinearGradient(x0, 0, x0 + cw, 0);
    grad.addColorStop(0, '#3d5a24');
    grad.addColorStop(0.5, '#4f7030');
    grad.addColorStop(1, '#3a5422');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(x0 + cw / 2, h / 2, cw * 0.48, h * 0.49, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(150,70,50,0.8)';
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(x0 + cw / 2, h); g.lineTo(x0 + cw / 2, 4); g.stroke();
    g.strokeStyle = 'rgba(170,190,120,0.35)';
    g.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const y = h * (i / 10);
      g.beginPath(); g.moveTo(x0 + cw / 2, y); g.lineTo(x0 + 3, y - 14); g.moveTo(x0 + cw / 2, y); g.lineTo(x0 + cw - 3, y - 14); g.stroke();
    }
    for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(120,70,40,${0.15 + rnd() * 0.25})`; g.fillRect(x0 + 4 + rnd() * (cw - 8), 10 + rnd() * (h - 20), 2, 2); } // rust spots
  }
  g.fillStyle = '#ffffff';
  g.fillRect(ATLAS.white[0] * w, 0, (ATLAS.white[1] - ATLAS.white[0]) * w, h);
  // A young birch's bark (#1003): white, grey at the foot, with dark lenticels across it and the odd black scar.
  {
    const x0 = ATLAS.bark[0] * w;
    const bw = (ATLAS.bark[1] - ATLAS.bark[0]) * w;
    const grad = g.createLinearGradient(0, h, 0, 0);
    grad.addColorStop(0, '#7d766a');
    grad.addColorStop(0.25, '#d9d6cc');
    grad.addColorStop(1, '#a4714f'); // a young twig's red-brown at the top
    g.fillStyle = grad;
    g.fillRect(x0, 0, bw, h);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(40,36,32,${0.4 + rnd() * 0.4})`;
      g.fillRect(x0 + rnd() * bw * 0.6, rnd() * h, 2 + rnd() * bw * 0.5, 1);
    }
  }
  // A spray of birch leaves (#1003): small toothed diamond-shaped leaves alternating along a thin twig, see-through between them.
  {
    const x0 = ATLAS.birch[0] * w;
    const bw = (ATLAS.birch[1] - ATLAS.birch[0]) * w;
    g.fillStyle = '#6a4a34';
    g.fillRect(x0 + bw / 2 - 0.5, 0, 1, h);
    for (let i = 0; i < 9; i++) {
      const y = h * (1 - (i + 0.7) / 10);
      const side = i % 2 ? 1 : -1;
      const l = 0.8 + rnd() * 0.2;
      g.fillStyle = rnd() < 0.15 ? '#a89a3c' : `rgb(${70 + rnd() * 25},${104 + rnd() * 30},${38 + rnd() * 14})`;
      g.beginPath(); // a leaf a hand's width long on a spray, pointed, broadest near its stalk
      g.moveTo(x0 + bw / 2, y);
      g.lineTo(x0 + bw / 2 + side * bw * 0.3 * l, y - 22 * l);
      g.lineTo(x0 + bw / 2 + side * bw * 0.49 * l, y - 8 * l);
      g.lineTo(x0 + bw / 2 + side * bw * 0.2 * l, y + 6 * l);
      g.closePath();
      g.fill();
    }
  }
}

let atlas = null;
/** The one atlas texture, made on first use. */
export function plantAtlas() {
  atlas ??= canvasTexture(256, 256, (g, w, h) => drawPlantAtlas(g, w, h));
  return atlas;
}

/** The plants' material: the atlas, cut out where it is see-through, both faces, tinted by each instance's colour and each part's vertex colour. */
export function plantMaterial() {
  return new THREE.MeshLambertMaterial({ map: plantAtlas(), vertexColors: true, alphaTest: 0.4, side: THREE.DoubleSide });
}

const WHITE_UV = [(ATLAS.white[0] + ATLAS.white[1]) / 2, 0.5];

/** A part with no texture of its own: its colour on every vertex and its uvs on the white patch. Non-indexed. */
function coloured(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const colors = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    c.toArray(colors, i * 3);
    uv[i * 2] = WHITE_UV[0];
    uv[i * 2 + 1] = WHITE_UV[1];
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.deleteAttribute('normal');
  g.computeVertexNormals();
  return g;
}

/**
 * One textured strip: `segs` pieces from its foot at (x, 0, z) out along `yaw`, `len` long, `width` wide at its widest, rising at `lean` from upright and
 * bowing over by `droop` (0 straight, 1 its tip at its foot's height). `col` names the atlas column; `taper` 1 to a point, 0 the same width all along.
 */
export function strip({ x = 0, z = 0, y = 0, yaw = 0, len, width, lean = 0.1, droop = 0.1, segs = 4, col = 'blade', taper = 1, shade = '#ffffff' }) {
  const [u0, u1] = ATLAS[col].map((u, i) => u + (i ? -0.006 : 0.006)); // a little in from the column's edges, so its neighbour doesn't bleed in
  const pos = [];
  const uv = [];
  const ca = Math.cos(yaw);
  const sa = Math.sin(yaw);
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const a = lean + droop * t * 1.6; // it bends further over as it goes
    const out = len * t * Math.sin(a);
    const up = len * t * Math.cos(a) - len * droop * t * t * 0.5;
    const w = (width / 2) * (taper ? 1 - t * taper * 0.92 : 1);
    pts.push({ px: x + ca * out, py: y + Math.max(-0.02, up), pz: z + sa * out, sx: -sa * w, sz: ca * w, t });
  }
  for (let i = 0; i < segs; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const quad = [[a, -1], [a, 1], [b, 1], [a, -1], [b, 1], [b, -1]];
    for (const [p, s] of quad) {
      pos.push(p.px + p.sx * s, p.py, p.pz + p.sz * s);
      uv.push(s < 0 ? u0 : u1, p.t);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const c = new THREE.Color(shade);
  const colors = new Float32Array(pos.length);
  for (let i = 0; i < pos.length / 3; i++) c.toArray(colors, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

/** A crossed pair of upright textured cards (the plume's or a seed head's), `h` tall and `w` wide, hanging from (x, y, z) and leaning by `bow`. */
function cards(x, y, z, h, w, col, bow = 0, yaw = 0) {
  return [0, Math.PI / 2].map((turn) => strip({ x, y, z, yaw: yaw + turn, len: h, width: w, lean: bow, droop: 0.2, segs: 2, col, taper: 0.3 }));
}

const merge = (parts) => mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));

/**
 * A reed clump (common reed): `blades` flat streaked blades `height` m tall that bow over and brown at their tips, plumes on `seeds` of them and `dead`
 * bent straw stalks. Three heights are made by the props, so a drift is not one clump over and over.
 */
export function reedModel(random, { height = 1.6, blades = 14, seeds = 0.5, dead = 2 } = {}) {
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const isDead = i < dead;
    const h = height * (isDead ? 0.6 + random() * 0.25 : 0.75 + random() * 0.35);
    const yaw = random() * Math.PI * 2;
    const r = random() * 0.16;
    const x = Math.cos(yaw) * r;
    const z = Math.sin(yaw) * r;
    // The stem, and a leaf or two off it that bows out further.
    parts.push(strip({ x, z, yaw, len: h, width: 0.022, lean: 0.04 + random() * 0.08, droop: isDead ? 0.5 + random() * 0.3 : 0.06, segs: 4, col: 'blade', taper: 0.6, shade: isDead ? '#d8c08a' : '#ffffff' }));
    if (!isDead) parts.push(strip({ x, z, y: h * (0.25 + random() * 0.3), yaw: yaw + (random() - 0.5) * 1.5, len: h * 0.45, width: 0.03, lean: 0.4 + random() * 0.4, droop: 0.4 + random() * 0.4, segs: 4, col: 'blade' }));
    if (!isDead && random() < seeds) {
      const tipX = x + Math.cos(yaw) * h * 0.1;
      const tipZ = z + Math.sin(yaw) * h * 0.1;
      parts.push(...cards(tipX, h * 0.92, tipZ, 0.26 + random() * 0.08, 0.09, 'plume', 0.3, yaw));
    }
  }
  return merge(parts);
}

/** A soft rush tuft: a dense fan of round dark stems, nearly upright, splaying out, a few with a brown flower cluster near the top on one side. */
export function rushModel(random, { height = 0.95, stems = 40 } = {}) {
  const parts = [];
  for (let i = 0; i < stems; i++) {
    const yaw = random() * Math.PI * 2;
    const h = height * (0.7 + random() * 0.4);
    const lean = 0.05 + random() * 0.35;
    const x = Math.cos(yaw) * random() * 0.12;
    const z = Math.sin(yaw) * random() * 0.12;
    parts.push(strip({ x, z, yaw, len: h, width: 0.017, lean, droop: 0.08 + random() * 0.15, segs: 3, col: 'rush', taper: 0.85 }));
    if (random() < 0.3) {
      const t = 0.7;
      const head = new THREE.IcosahedronGeometry(0.022, 0).scale(1, 1.6, 1);
      head.translate(x + Math.cos(yaw) * h * t * Math.sin(lean + 0.1) + 0.012, h * t, z + Math.sin(yaw) * h * t * Math.sin(lean + 0.1));
      parts.push(coloured(head, ['#6b4a2a', '#7d5a33', '#5a3d22'][Math.floor(random() * 3)]));
    }
  }
  return merge(parts);
}

/** A sedge: arching yellow-green blades from a tight base and two or three stalks each with a drooping dark spike. */
export function sedgeModel(random, { height = 0.8, blades = 20 } = {}) {
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const yaw = (i / blades) * Math.PI * 2 + random() * 0.6;
    parts.push(strip({ yaw, len: height * (0.7 + random() * 0.5), width: 0.036, lean: 0.25 + random() * 0.35, droop: 0.55 + random() * 0.4, segs: 5, col: 'sedge' }));
  }
  const n = 2 + Math.floor(random() * 2);
  for (let i = 0; i < n; i++) {
    const yaw = random() * Math.PI * 2;
    const h = height * (1 + random() * 0.3);
    parts.push(strip({ yaw, len: h, width: 0.008, lean: 0.12, droop: 0.15, segs: 3, col: 'sedge', taper: 0 }));
    const tip = new THREE.CylinderGeometry(0.012, 0.007, 0.09, 5);
    tip.translate(0, -0.045, 0);
    tip.rotateZ(1.1);
    tip.rotateY(-yaw);
    tip.translate(Math.cos(yaw) * h * 0.2, h * 0.97, Math.sin(yaw) * h * 0.2);
    parts.push(coloured(tip, '#4a3a24'));
  }
  return merge(parts);
}

/** A meadow tussock: a rough clump of coarse grass, green with old straw blades through it, a little higher in the middle. */
export function tussockModel(random, { height = 0.48, blades = 32 } = {}) {
  const parts = [];
  for (let i = 0; i < blades; i++) {
    const yaw = random() * Math.PI * 2;
    const r = random() * 0.2;
    const old = random() < 0.3;
    parts.push(strip({ x: Math.cos(yaw) * r, z: Math.sin(yaw) * r, yaw, len: height * (0.6 + random() * 0.6) * (1 - r * 1.5), width: 0.05, lean: 0.12 + r * 2, droop: 0.15 + random() * 0.3, segs: 3, col: 'sedge', shade: old ? '#d9c690' : '#c8d8a0' }));
  }
  return merge(parts);
}

/** A spear thistle: a flat rosette of spiny leaves, and a stem with two or three side shoots, each with a green spiny bulb and a purple tuft. */
export function thistleModel(random, { height = 0.95 } = {}) {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2 + random() * 0.4;
    parts.push(strip({ yaw, len: 0.3 + random() * 0.08, width: 0.11, lean: 1.2, droop: 0.15, segs: 3, col: 'thistle', taper: 0.5 }));
  }
  const stem = new THREE.CylinderGeometry(0.008, 0.014, height, 5);
  stem.translate(0, height / 2, 0);
  parts.push(coloured(stem, '#5c6e34'));
  const heads = [[0, height, 0]];
  for (let i = 0; i < 2 + Math.floor(random() * 2); i++) {
    const yaw = random() * Math.PI * 2;
    const y0 = height * (0.55 + random() * 0.25);
    const len = 0.14 + random() * 0.1;
    const shoot = new THREE.CylinderGeometry(0.005, 0.007, len, 4);
    shoot.translate(0, len / 2, 0);
    shoot.rotateZ(-0.6);
    shoot.rotateY(-yaw);
    shoot.translate(0, y0, 0);
    parts.push(coloured(shoot, '#5c6e34'));
    heads.push([Math.cos(yaw) * len * 0.56, y0 + len * 0.82, Math.sin(yaw) * len * 0.56]);
    // A spiny leaf on the stem.
    parts.push(strip({ y: y0 - 0.08, yaw: yaw + Math.PI, len: 0.12, width: 0.05, lean: 0.9, droop: 0.2, segs: 2, col: 'thistle' }));
  }
  for (const [x, y, z] of heads) {
    const bulb = new THREE.IcosahedronGeometry(0.03, 0).scale(1, 1.25, 1);
    bulb.translate(x, y, z);
    parts.push(coloured(bulb, '#6d7a3a'));
    const tuft = new THREE.ConeGeometry(0.026, 0.04, 6, 1, true);
    tuft.rotateX(Math.PI);
    tuft.translate(x, y + 0.05, z);
    parts.push(coloured(tuft, random() < 0.8 ? '#8e3f86' : '#a5938a'));
  }
  return merge(parts);
}

/** A broad-leaved dock: a rosette of big oval leaves, raised a little, and a tall stem of rusty-brown seed whorls. */
export function dockModel(random, { height = 0.9 } = {}) {
  const parts = [];
  const leaves = 6 + Math.floor(random() * 3);
  for (let i = 0; i < leaves; i++) {
    const yaw = (i / leaves) * Math.PI * 2 + random() * 0.5;
    parts.push(strip({ yaw, len: 0.38 + random() * 0.14, width: 0.19 + random() * 0.04, lean: 0.6 + random() * 0.35, droop: 0.35, segs: 3, col: 'dock', taper: 0 }));
  }
  const h = height * (0.8 + random() * 0.4);
  const stem = new THREE.CylinderGeometry(0.008, 0.016, h, 5);
  stem.translate(0, h / 2, 0);
  parts.push(coloured(stem, '#6a4a2c'));
  for (let y = h * 0.45; y < h; y += 0.06) {
    for (let k = 0; k < 4; k++) {
      const a = random() * Math.PI * 2;
      const seed = new THREE.IcosahedronGeometry(0.018, 0).scale(1, 0.7, 1);
      seed.translate(Math.cos(a) * 0.02, y, Math.sin(a) * 0.02);
      parts.push(coloured(seed, ['#8a4a26', '#7a3e20', '#9b5a2e'][Math.floor(random() * 3)]));
    }
  }
  return merge(parts);
}

/** A cowpat: a flattened lumpy disc, dark and wet at its rim and crusted lighter on top with a dip in the middle. */
export function cowpatModel(random) {
  const geo = new THREE.CylinderGeometry(0.2, 0.24, 0.045, 12, 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dark = new THREE.Color('#3b2b1a');
  const crust = new THREE.Color('#6d5a3c');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const r = Math.hypot(x, z);
    const a = Math.atan2(z, x);
    const k = 1 + 0.18 * Math.sin(a * 3 + random()) + 0.08 * Math.sin(a * 5);
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
    const top = pos.getY(i) > 0;
    if (top) pos.setY(i, pos.getY(i) - 0.012 * (1 - r / 0.2) + (random() - 0.5) * 0.008);
    c.copy(dark).lerp(crust, top ? 0.55 + random() * 0.35 : 0.1);
    c.toArray(colors, i * 3);
  }
  geo.translate(0, 0.015, 0);
  const g = geo.toNonIndexed();
  const n = g.attributes.position.count;
  const uv = new Float32Array(n * 2).fill(0).map((_, i) => (i % 2 ? WHITE_UV[1] : WHITE_UV[0]));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const col = new Float32Array(n * 3);
  const src = geo.index.array;
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) col[i * 3 + k] = colors[src[i] * 3 + k];
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

/** A loose stone or cobble: a rounded lump, flattened, grey-brown. */
export function stoneModel() {
  return coloured(new THREE.IcosahedronGeometry(1, 1).scale(1, 0.55, 0.8), '#ffffff');
}

/** A tapered stem from `a` to `b` ([x, y, z]), radius `r0` to `r1`, its bark from the atlas's bark column (v up it, `v0` to `v1`). Non-indexed. */
function barkStem(a, b, r0, r1, v0 = 0, v1 = 1, sides = 5) {
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true).toNonIndexed();
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  geo.translate((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const uv = geo.attributes.uv;
  const [u0, u1] = ATLAS.bark;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + 0.004 + uv.getX(i) * (u1 - u0 - 0.008), v0 + uv.getY(i) * (v1 - v0));
  const colors = new Float32Array(geo.attributes.position.count * 3).fill(1);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/**
 * A young birch (#1003), the first tree into waste ground: a white stem `height` m tall, a little crooked, `branches` slender side shoots up its top
 * two-thirds, and sprays of small leaves along each and at the top. A seedling at half a metre or a sapling at three, the bark and the leaves from
 * the atlas; its foot at the origin. For the pit's heaps, the sleepers under its container, and anywhere ground has been left. `facing` (radians,
 * the way `strip` takes a yaw) is for one growing against a wall: it leans that way and puts its shoots out on that side only.
 */
export function birchModel(random, { height = 1, branches = 4, facing = null } = {}) {
  const parts = [];
  const r0 = 0.006 + height * 0.012;
  const lean = facing === null ? (random() - 0.5) * 0.12 : 0.1 + random() * 0.06;
  const yaw0 = facing ?? random() * Math.PI * 2;
  const bend = [Math.cos(yaw0) * lean * height, Math.sin(yaw0) * lean * height];
  const stemAt = (t) => [bend[0] * t * t + 0.03 * height * Math.sin(t * 7), height * t, bend[1] * t * t];
  const steps = 4;
  for (let i = 0; i < steps; i++) parts.push(barkStem(stemAt(i / steps), stemAt((i + 1) / steps), r0 * (1 - (i / steps) * 0.8), r0 * (1 - ((i + 1) / steps) * 0.8), i / steps, (i + 1) / steps));
  // A spray of leaves: two strips crossed, so it reads from the side as well as from above.
  const spray = (at, yaw, len, lean2) => {
    for (const roll of [0, Math.PI / 2]) parts.push(strip({ x: at[0], y: at[1], z: at[2], yaw: yaw + roll * 0.25, len, width: Math.min(0.22, 0.1 + len * 0.35), lean: lean2 + (roll ? 0.35 : 0), droop: 0.35, segs: 3, col: 'birch', taper: 0.2 }));
  };
  for (let k = 0; k < branches; k++) {
    const t = 0.35 + (k / Math.max(1, branches)) * 0.55 + random() * 0.05;
    const from = stemAt(t);
    const yaw = facing === null ? yaw0 + k * 2.4 + random() * 0.6 : facing + (random() - 0.5) * 2.2;
    const blen = height * (0.25 + random() * 0.2) * (1.2 - t);
    const to = [from[0] + Math.cos(yaw) * blen, from[1] + blen * 0.55, from[2] + Math.sin(yaw) * blen];
    parts.push(barkStem(from, to, r0 * 0.35, r0 * 0.12, 0.6, 0.95, 4));
    spray(to, yaw, Math.min(0.4, 0.12 + height * 0.15), 0.9);
    spray([(from[0] + to[0]) / 2, (from[1] + to[1]) / 2, (from[2] + to[2]) / 2], yaw + 1.2, Math.min(0.32, 0.1 + height * 0.12), 1.2);
  }
  for (let t = 0.45; t < 0.97; t += 0.13) spray(stemAt(t), facing === null ? random() * Math.PI * 2 : facing + (random() - 0.5) * 1.6, Math.min(0.34, 0.1 + height * 0.12), 1.0); // short shoots off the stem itself
  const top = stemAt(1);
  for (let k = 0; k < 3; k++) spray(top, facing === null ? yaw0 + (k * Math.PI * 2) / 3 : facing + (k - 1) * 0.9, Math.min(0.36, 0.12 + height * 0.14), 0.45);
  return merge(parts);
}

/**
 * Roots hanging out of a cut bank's topsoil (#1004): a tangle of seven or so brown roots, thick where they leave the soil and thinning to hair, coming
 * out along a metre of the edge and trailing down the face, lifting off it a little and curling, with a few fine strands among them. In a face's own
 * frame: x along the edge, +z down the face, +y out of it, the edge at the origin. The bark and hair from the atlas, browned by vertex colour.
 */
export function rootTangleModel(random, { roots = 7, length = 0.75, steps = 3 } = {}) {
  const parts = [];
  const brown = (g, shade) => {
    const c = g.attributes.color;
    for (let i = 0; i < c.count; i++) c.setXYZ(i, 0.42 * shade, 0.3 * shade, 0.2 * shade);
    return g;
  };
  for (let i = 0; i < roots; i++) {
    const x0 = (random() - 0.5) * 1.0;
    const len = length * (0.4 + random() * 0.8);
    const r0 = 0.01 + random() * 0.016;
    const curl = (random() - 0.5) * 0.5;
    const lift = 0.05 + random() * 0.16;
    const at = (t) => [x0 + curl * t * t * len, lift * Math.sin(t * Math.PI) - 0.01, -0.06 + t * len];
    const shade = 0.75 + random() * 0.5;
    for (let s = 0; s < steps; s++) parts.push(brown(barkStem(at(s / steps), at((s + 1) / steps), r0 * (1 - (s / steps) * 0.7), r0 * (1 - ((s + 1) / steps) * 0.7), s / steps, (s + 1) / steps, 3), shade));
  }
  for (let i = 0; i < 4; i++) {
    const g = strip({ x: (random() - 0.5) * 0.9, y: 0.01, yaw: Math.PI / 2 + (random() - 0.5) * 0.4, len: 0.2 + random() * 0.25, width: 0.03, lean: 1.45, droop: 0.05, segs: 2, col: 'blade', shade: '#6b5238' });
    parts.push(g);
  }
  return merge(parts);
}
