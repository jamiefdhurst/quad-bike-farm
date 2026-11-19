// Post-and-wire fencing, the kit the gravel pit's boundary and its lip fence are both built from (#685): timber posts every 3 m, a strainer post with
// a strut at every corner and each side of a gate, three strands of barbed wire (a ribbon with the barbs drawn on it, rust and all), a post or two down
// with the wire slack, and a low collider along each span. Pieces are collected into a `Parts` (a mesh per material), so a whole side is a few draw calls.

import * as THREE from 'three';
import { canvasTexture } from './outbuildingProps.js';
import { woodTexture } from './neighbourTextures.js';

/** The fence's sizes, metres. */
export const WIRE_FENCE = {
  piece: 3, // between line posts
  post: 0.11, // a line post's thickness
  postHeight: 1.3, // above the ground
  sink: 0.45, // below it
  strainer: 0.2, // a strainer's thickness
  strainerHeight: 1.55,
  strut: 0.09,
  strands: [0.42, 0.8, 1.17], // heights of the three strands
  ribbon: 0.13, // the barbed wire's height as drawn: the barbs reach 6 cm either side of the line
  barbEvery: 0.6, // metres one tile of the wire's texture runs (four barbs, 15 cm apart)
  downShare: 0.04, // the share of line posts that are down
};

/** The barbed wire as a texture with cut-out edges: a twisted pair, and a pair of crossed barbs four times along. */
export function barbedWireTexture() {
  const tex = canvasTexture(256, 32, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    for (const [col, off] of [['#8b9094', -1], ['#6e7478', 1]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      for (let x = 0; x <= w; x += 4) {
        const y = h / 2 + Math.sin((x / w) * Math.PI * 8) * 1.6 * off;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    for (let k = 0; k < 4; k++) {
      const x = 32 + k * 64;
      ctx.strokeStyle = k % 2 ? '#7a4a30' : '#5e3a22'; // rust on the barbs
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x - 7, h / 2 - 9);
      ctx.lineTo(x + 7, h / 2 + 9);
      ctx.moveTo(x + 7, h / 2 - 9);
      ctx.lineTo(x - 7, h / 2 + 9);
      ctx.stroke();
    }
  });
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** The three materials: line posts, strainers and struts (darker, creosoted), and the wire. */
export function wireFenceMaterials(random) {
  return {
    post: new THREE.MeshStandardMaterial({ map: woodTexture(random, [118, 98, 74]), roughness: 0.95 }),
    strainer: new THREE.MeshStandardMaterial({ map: woodTexture(random, [84, 62, 40]), roughness: 0.95 }),
    wire: new THREE.MeshStandardMaterial({ map: barbedWireTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.4 }),
  };
}

/** A strand of barbed wire from `a` to `b` ([x, y, z]), `sag` m lower in the middle: a vertical ribbon along the line, its u running along the wire. */
export function barbedStrand(a, b, sag = 0.04) {
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - sag, (a[2] + b[2]) / 2];
  const pts = [a, mid, b];
  const len = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1;
  const nx = -(b[2] - a[2]) / len;
  const nz = (b[0] - a[0]) / len;
  const h = WIRE_FENCE.ribbon / 2;
  const position = [];
  const normal = [];
  const uv = [];
  let s = 0;
  pts.forEach((p, i) => {
    if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[2] - pts[i - 1][2]);
    position.push(p[0], p[1] - h, p[2], p[0], p[1] + h, p[2]);
    normal.push(nx, 0, nz, nx, 0, nz);
    uv.push(s / WIRE_FENCE.barbEvery, 0, s / WIRE_FENCE.barbEvery, 1);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex([0, 2, 1, 1, 2, 3, 2, 4, 3, 3, 4, 5]);
  return geo;
}

/** A line post at (x, z) on the ground at `y`, `lean` radians over (about x) and `lean2` about z, in `height`. A down post lies at a slant, half in the ground. */
export function addPost(parts, mats, x, y, z, { height = WIRE_FENCE.postHeight, lean = 0, lean2 = 0, yaw = 0, down = false } = {}) {
  const t = WIRE_FENCE.post;
  const total = height + WIRE_FENCE.sink;
  const geo = new THREE.BoxGeometry(t, total, t);
  if (down) parts.add(mats.post, geo, x, y + 0.22, z, 1.1 + lean * 0.5, yaw, lean2);
  else parts.add(mats.post, geo, x, y + height / 2 - WIRE_FENCE.sink / 2, z, lean2, yaw, lean);
}

/**
 * A strainer post at (x, z) with its strut: the strut runs from near the top of the post down to the ground a metre and a half along (`ux`, `uz`),
 * which is the way the wire pulls from.
 */
export function addStrainer(parts, mats, x, y, z, ux, uz, standing = null) {
  const t = WIRE_FENCE.strainer;
  const total = WIRE_FENCE.strainerHeight + WIRE_FENCE.sink;
  const key = `${x.toFixed(2)},${z.toFixed(2)}`;
  // Two lines meeting at a corner share its post (each has its own strut), or the two posts would be one plane twice over.
  if (!standing?.has(key)) parts.add(mats.strainer, new THREE.BoxGeometry(t, total, t), x, y + WIRE_FENCE.strainerHeight / 2 - WIRE_FENCE.sink / 2, z);
  standing?.add(key);
  parts.rod(mats.strainer, [x + ux * 0.1, y + 1.2, z + uz * 0.1], [x + ux * 1.5, y + 0.05, z + uz * 1.5], WIRE_FENCE.strut / 2, WIRE_FENCE.strut / 2, 6);
}

/** The three strands of wire from post `a` to post `b` ([x, y, z] where each stands on the ground), `slack` m extra sag when a post between is down. */
export function addSpan(parts, mats, a, b, random, slack = 0) {
  for (const h of WIRE_FENCE.strands) {
    const sag = 0.03 + random() * 0.04 + slack * (0.4 + h * 0.5);
    parts.add(mats.wire, barbedStrand([a[0], a[1] + h, a[2]], [b[0], b[1] + h, b[2]], sag));
  }
}

/** Where a polyline's length `s` falls: the point and the unit direction there. */
function along(points, s) {
  let left = s;
  for (let i = 0; i + 1 < points.length; i++) {
    const len = Math.hypot(points[i + 1][0] - points[i][0], points[i + 1][1] - points[i][1]);
    if (left <= len || i + 2 === points.length) {
      const f = len ? Math.min(left, len) / len : 0;
      return { x: points[i][0] + (points[i + 1][0] - points[i][0]) * f, z: points[i][1] + (points[i + 1][1] - points[i][1]) * f, ux: (points[i + 1][0] - points[i][0]) / (len || 1), uz: (points[i + 1][1] - points[i][1]) / (len || 1) };
    }
    left -= len;
  }
  return { x: points[0][0], z: points[0][1], ux: 1, uz: 0 };
}

/**
 * A line of fence along `points` ([[x, z], ...], game metres), open in `gaps` ([from, to] metres along it): a strainer and strut at each end of
 * every stretch and at each corner, a line post about every 3 m between, wire between all of them, and a collider along each span (`fixedBox`),
 * which a down post does not break. Returns { spans, posts, strainers } for the tests to count.
 */
export function wireFenceRun({ parts, mats, points, gaps = [], groundY, fixedBox, random, standing = new Set() }) {
  const lens = points.slice(1).map((p, i) => Math.hypot(p[0] - points[i][0], p[1] - points[i][1]));
  const corners = [];
  lens.reduce((s, l, i) => {
    if (i) corners.push(s);
    return s + l;
  }, 0);
  const total = lens.reduce((a, b) => a + b, 0);
  // The stretches between gaps, each cut again at the corners, so each is straight with a strainer at either end.
  const sorted = [...gaps].sort((a, b) => a[0] - b[0]);
  let stretches = [];
  let from = 0;
  for (const [g0, g1] of sorted) {
    if (g0 > from) stretches.push([from, g0]);
    from = Math.max(from, g1);
  }
  if (from < total) stretches.push([from, total]);
  stretches = stretches.flatMap(([a, b]) => {
    const cuts = corners.filter((c) => c > a + 0.5 && c < b - 0.5);
    const edges = [a, ...cuts, b];
    return edges.slice(1).map((e, i) => [edges[i], e]);
  });
  const out = { spans: 0, posts: 0, strainers: 0 };
  const stand = (s) => {
    const p = along(points, s);
    return { ...p, y: groundY(p.x, p.z) };
  };
  for (const [s0, s1] of stretches) {
    const n = Math.max(1, Math.round((s1 - s0) / WIRE_FENCE.piece));
    const stands = Array.from({ length: n + 1 }, (_, k) => stand(s0 + ((s1 - s0) * k) / n));
    const down = stands.map((p, k) => k > 0 && k < n && random() < WIRE_FENCE.downShare);
    stands.forEach((p, k) => {
      if (k === 0) addStrainer(parts, mats, p.x, p.y, p.z, stands[1].x - p.x, stands[1].z - p.z, standing);
      else if (k === n) addStrainer(parts, mats, p.x, p.y, p.z, stands[n - 1].x - p.x, stands[n - 1].z - p.z, standing);
      else addPost(parts, mats, p.x, p.y, p.z, { lean: (random() - 0.5) * 0.06, lean2: (random() - 0.5) * 0.06, yaw: Math.atan2(p.ux, p.uz), down: down[k] });
      out[k === 0 || k === n ? 'strainers' : 'posts']++;
    });
    for (let k = 0; k < n; k++) {
      const a = stands[k];
      const b = stands[k + 1];
      const slack = down[k] || down[k + 1] ? 0.3 : 0;
      addSpan(parts, mats, [a.x, a.y, a.z], [b.x, b.y, b.z], random, slack);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      fixedBox((a.x + b.x) / 2, (a.y + b.y) / 2 + 0.6, (a.z + b.z) / 2, len / 2, 0.6, 0.07, Math.atan2(-(b.z - a.z), b.x - a.x));
      out.spans++;
    }
  }
  return out;
}
