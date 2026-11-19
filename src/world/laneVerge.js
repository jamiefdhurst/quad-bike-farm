// The verge of Back Lane (#686): cow parsley, nettles and dock between the tarmac and the hedge, where the lane's mower doesn't go. `vergePlants` is the pure
// placement (where each stands, which kind, how big); `parsleyGeometry`, `nettleGeometry` and `dockGeometry` are the three plants, each a handful of cards with
// a canvas texture, tinted by vertex colour; `buildVerge` puts them in the scene in tiles that the ground cover's draw distance hides.

import * as THREE from 'three';
import { sidePoint, hedgeOffset } from './laneHedges.js';
import { canvasTexture } from './outbuildingProps.js';
import { tiledInstances } from './tiledInstances.js';
import { matrixAt } from './hillProps.js';

export const VERGE_KINDS = { parsley: 0.45, nettle: 0.3, dock: 0.25 }; // the share of the verge each takes
export const VERGE_STEP = 1.5; // m along the road between plants on a side, on average

/**
 * Where the verge plants go: [{ kind, side, s, off, scale, yaw }] down both sides, `off` m out from the middle, between the carriageway's edge (and the
 * grit beyond it) and a hedge's width short of the hedge. None where `skip(s, side)` says (a gate, the ford, a passing place's bay where the grit is).
 */
export function vergePlants(road, random, skip = () => false) {
  const out = [];
  for (const side of [1, -1]) {
    for (let s = 6; s < road.length - 6; s += VERGE_STEP * (0.5 + random())) {
      if (skip(s, side)) continue;
      const from = road.halfWidth + 0.35;
      const to = hedgeOffset(road, s, side) - 1.3; // a hedge block is up to 2.4 m through
      if (to <= from) continue;
      const pick = random();
      const kind = pick < VERGE_KINDS.parsley ? 'parsley' : pick < VERGE_KINDS.parsley + VERGE_KINDS.nettle ? 'nettle' : 'dock';
      // They crowd to the hedge's foot, thinner towards the road.
      const off = from + (to - from) * Math.sqrt(random());
      out.push({ kind, side, s, off, scale: 0.7 + random() * 0.7, yaw: random() * Math.PI * 2 });
    }
  }
  return out;
}

/** The leaf material: lit by the cards' own upward normals from either side (both windings are in the geometry), alpha-tested, tinted by vertex colour. */
const plantMaterial = (map) => new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5 });

const finish = (pos, uv, colors) => {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return geo;
};

/** A card from (x0, y0, z0) to (x1, y1, z1) `w` wide across the horizontal normal of its run, as six numbers a vertex, with `tint` and the uv rectangle. */
function card(arr, [x0, y0, z0], [x1, y1, z1], w, tint, [u0, v0, u1, v1] = [0, 0, 1, 1]) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const len = Math.hypot(dx, dz) || 1;
  const sx = (-dz / len) * w;
  const sz = (dx / len) * w;
  const v = [
    [x0 - sx, y0, z0 - sz, u0, v0],
    [x0 + sx, y0, z0 + sz, u1, v0],
    [x1 + sx, y1, z1 + sz, u1, v1],
    [x1 - sx, y1, z1 - sz, u0, v1],
  ];
  for (const tri of [[0, 1, 2], [0, 2, 3], [2, 1, 0], [3, 2, 0]]) { // both windings, so every card is a front face from above and below and lit by its upward normal
    for (const k of tri) {
      arr.pos.push(v[k][0], v[k][1], v[k][2]);
      arr.uv.push(v[k][3], v[k][4]);
      arr.colors.push(...tint);
    }
  }
}

/** A flat square card, side 2r, centred (x, y, z), turned `yaw` and tipped up at its far edge by `tilt` m: the flower head of a cow parsley. */
function flat(arr, [x, y, z], r, yaw, tilt, tint, [u0, v0, u1, v1]) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const corner = (a, b, lift) => [x + a * c - b * s, y + lift, z + a * s + b * c];
  const v = [[corner(-r, -r, -tilt), u0, v0], [corner(r, -r, -tilt), u1, v0], [corner(r, r, tilt), u1, v1], [corner(-r, r, tilt), u0, v1]];
  for (const tri of [[0, 1, 2], [0, 2, 3], [2, 1, 0], [3, 2, 0]]) {
    for (const k of tri) {
      arr.pos.push(...v[k][0]);
      arr.uv.push(v[k][1], v[k][2]);
      arr.colors.push(...tint);
    }
  }
}

/** One leaf texture: a serrated, veined leaf in a green on transparent. */
export function vergeLeafTexture(base = '#4c7a35', serrate = 6) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = base;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 2);
    for (let i = 0; i <= serrate * 2; i++) {
      const t = i / (serrate * 2);
      const spread = Math.sin(t * Math.PI) * (w * 0.42) * (i % 2 ? 0.82 : 1);
      ctx.lineTo(w / 2 + spread, h - 6 - t * (h - 12));
    }
    for (let i = serrate * 2; i >= 0; i--) {
      const t = i / (serrate * 2);
      const spread = Math.sin(t * Math.PI) * (w * 0.42) * (i % 2 ? 0.82 : 1);
      ctx.lineTo(w / 2 - spread, h - 6 - t * (h - 12));
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(20,50,15,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, h - 4);
    ctx.lineTo(w / 2, 8);
    for (let i = 1; i < 5; i++) {
      ctx.moveTo(w / 2, h - 8 - i * 20);
      ctx.lineTo(w / 2 + 34, h - 30 - i * 20);
      ctx.moveTo(w / 2, h - 8 - i * 20);
      ctx.lineTo(w / 2 - 34, h - 30 - i * 20);
    }
    ctx.stroke();
  });
}

/**
 * The cow parsley's atlas, 256 by 128: its flower head on the left half (a flat spray of tiny white flowers on fine rays), and on the right a solid green for the
 * stems (top) and a feathery, finely cut leaf (bottom), on transparent.
 */
export function umbelTexture(random) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#f2f3ea';
    for (let r = 0; r < 11; r++) {
      const a = (r / 11) * Math.PI * 2;
      for (let k = 0; k < 8; k++) {
        const d = 10 + k * 6.5;
        ctx.beginPath();
        ctx.arc(64 + Math.cos(a) * d + (random() - 0.5) * 5, 64 + Math.sin(a) * d + (random() - 0.5) * 5, 3.6 + random() * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#dfe4cf';
    ctx.beginPath();
    ctx.arc(64, 64, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5b8a3c'; // the stem
    ctx.fillRect(132, 4, 120, 56);
    ctx.fillStyle = '#4f8035'; // the leaf: a midrib and fine leaflets either side
    ctx.fillRect(188, 66, 8, 58);
    for (let i = 0; i < 9; i++) {
      const y = 120 - i * 6;
      ctx.beginPath();
      ctx.ellipse(192 - 22, y, 20 - i, 3.2, -0.5, 0, Math.PI * 2);
      ctx.ellipse(192 + 30, y, 20 - i, 3.2, 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Cow parsley: a tuft of feathery leaves at the foot and four or five thin stems, each with a flat white umbel 0.8 to 1.1 m up. */
export function parsleyGeometry(random) {
  const a = { pos: [], uv: [], colors: [] };
  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2 + random();
    const len = 0.4 + random() * 0.2;
    card(a, [0, 0, 0], [Math.cos(yaw) * len, 0.22 + random() * 0.1, Math.sin(yaw) * len], 0.15, [0.75, 1.0, 0.65], [0.5, 0, 1, 0.5]);
  }
  for (let i = 0; i < 5; i++) {
    const yaw = random() * Math.PI * 2;
    const lean = 0.05 + random() * 0.18;
    const top = [Math.cos(yaw) * lean, 0.8 + random() * 0.3, Math.sin(yaw) * lean];
    card(a, [0, 0, 0], top, 0.014, [0.7, 0.85, 0.5], [0.6, 0.55, 0.9, 0.95]); // the stem, a sliver of the atlas's solid green
    const r = 0.13 + random() * 0.05;
    // The umbel: a flat head, the near and far sides of it a little different in height so it is a shallow dome.
    flat(a, top, r, random() * Math.PI, 0.05, [1.05, 1.05, 1.0], [0, 0, 0.5, 1]);
  }
  return finish(a.pos, a.uv, a.colors);
}

/** Nettles: a dense clump of upright stems, 0.7 to 1 m, each with pairs of dark, serrated leaves. */
export function nettleGeometry(random) {
  const a = { pos: [], uv: [], colors: [] };
  for (let i = 0; i < 7; i++) {
    const yaw = random() * Math.PI * 2;
    const lean = 0.05 + random() * 0.1;
    for (let pair = 0; pair < 4; pair++) {
      const y = 0.18 + pair * 0.17 + random() * 0.04;
      for (const side of [-1, 1]) {
        const dir = yaw + (side * Math.PI) / 2 + (random() - 0.5) * 0.4;
        const len = 0.2 - pair * 0.015;
        const g = 0.75 + random() * 0.3;
        card(a, [Math.cos(yaw) * lean * y, y, Math.sin(yaw) * lean * y], [Math.cos(yaw) * lean * y + Math.cos(dir) * len, y + 0.07, Math.sin(yaw) * lean * y + Math.sin(dir) * len], 0.075, [0.7 * g, 0.9 * g, 0.6 * g]);
      }
    }
  }
  return finish(a.pos, a.uv, a.colors);
}

/** Dock: a rosette of broad, long leaves arching out and a tall seed spike gone rusty. */
export function dockGeometry(random) {
  const a = { pos: [], uv: [], colors: [] };
  for (let i = 0; i < 9; i++) {
    const yaw = (i / 9) * Math.PI * 2 + random() * 0.5;
    const len = 0.45 + random() * 0.25;
    card(a, [0, 0.02, 0], [Math.cos(yaw) * len, 0.28 + random() * 0.15, Math.sin(yaw) * len], 0.15, [0.62 + random() * 0.15, 0.95, 0.55]);
  }
  const lean = 0.06;
  card(a, [0, 0, 0], [lean, 1.05, 0], 0.014, [0.55, 0.33, 0.2], [0.45, 0.5, 0.55, 1]);
  card(a, [0, 0, 0], [0, 1.05, lean], 0.014, [0.55, 0.33, 0.2], [0.45, 0.5, 0.55, 1]);
  for (let k = 0; k < 6; k++) {
    const y = 0.55 + k * 0.08;
    card(a, [lean * y, y, 0], [lean * y + 0.07, y + 0.05, 0.02], 0.03, [0.75, 0.4, 0.2], [0.45, 0.5, 0.55, 1]);
  }
  return finish(a.pos, a.uv, a.colors);
}

/** Puts the verge plants of `road` in the scene as three tiled instance groups. `skip(s, side)` leaves a stretch bare. Returns the groups. */
export function buildVerge({ scene, heights, random, drawDistance }, road, skip) {
  const plants = vergePlants(road, random, skip);
  const makers = {
    parsley: [parsleyGeometry(random), plantMaterial(umbelTexture(random))],
    nettle: [nettleGeometry(random), plantMaterial(vergeLeafTexture('#3f6f2c', 7))],
    dock: [dockGeometry(random), plantMaterial(vergeLeafTexture('#58803a', 3))],
  };
  const groups = [];
  for (const kind of Object.keys(makers)) {
    const matrices = plants.filter((p) => p.kind === kind).map((p) => {
      const at = sidePoint(road, p.s, p.side, p.off);
      return matrixAt(at.x, heights.heightAt(at.x, at.z) - 0.02, at.z, p.yaw, p.scale);
    });
    if (!matrices.length) continue;
    const group = tiledInstances(makers[kind][0], makers[kind][1], matrices, { name: `lane-${kind}`, receiveShadow: false });
    scene.add(drawDistance.add(group, 'coverDistance'));
    groups.push(group);
  }
  return groups;
}
