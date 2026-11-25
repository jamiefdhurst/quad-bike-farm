// The wood's low plants (#561, folded into #683): the Fern Trail's ferns and brambles and the thorn and bramble edge at the wood's hedges. Each leaf is a
// textured card (a fern frond with its pinnae and midrib, a toothed bramble leaf with veins, alpha-tested) tinted by vertex colours, so one grey-green leaf
// painting serves every colour: in summer a green that varies leaf to leaf and lightens to the young tips, in autumn a plant that goes green at the heart
// and yellow, orange and brown out along its canes and fronds, not one russet. Both are instanced by the caller; the triangles in a plant are capped.

import * as THREE from 'three';
import { canvasTexture } from './outbuildingProps.js';

/** Triangles in one fern and in one bramble clump, at most (a test holds them to it: there are thousands along the trail and the edge). */
export const FERN_TRIANGLES = 130;
export const BRAMBLE_TRIANGLES = 150;

const clamp01 = (v) => Math.min(1, Math.max(0, v));

/**
 * The colour of a leaf at `t` (0 at the plant's heart, 1 at its tip) of a plant that is `turn` (0 green .. 1 well on) through its autumn, as [r, g, b] in
 * the working colour space. Summer is a green that varies from leaf to leaf (`random`) and lightens a little with `t`. Autumn mixes each leaf towards a
 * yellow, an orange or a brown (its own, from `random`) by how far the plant has turned and how far out the leaf is, so a plant is green, yellow, orange and brown at once.
 */
export function leafColour(random, autumn, t, turn = 0) {
  const green = new THREE.Color().setHSL(0.24 + random() * 0.07, 0.4 + random() * 0.18, 0.2 + t * 0.07 + random() * 0.1);
  if (!autumn) return [green.r, green.g, green.b];
  const pick = random();
  const rust = pick < 0.4 ? new THREE.Color().setHSL(0.13 + random() * 0.03, 0.7, 0.4 + random() * 0.08) // yellow
    : pick < 0.75 ? new THREE.Color().setHSL(0.06 + random() * 0.03, 0.75, 0.36 + random() * 0.06) // orange
      : new THREE.Color().setHSL(0.07 + random() * 0.02, 0.45, 0.22 + random() * 0.06); // brown
  const k = clamp01(turn * 0.8 + (t - 0.4) * 0.9 + (random() - 0.5) * 0.35);
  green.lerp(rust, k);
  return [green.r, green.g, green.b];
}

/** A fern frond, 128 by 256: a midrib and pairs of pinnae along it that shorten to the tip, in light greys for the vertex colours to tint, clear between. */
export function fernTexture(random) {
  return canvasTexture(128, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(0, 0, 6, 6); // an opaque patch, for the canes and stems of the plants sharing a texture
    ctx.strokeStyle = 'rgb(150,150,140)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(w / 2, h);
    ctx.lineTo(w / 2, 6);
    ctx.stroke();
    for (let y = h - 6; y > 14; y -= 9) {
      const t = 1 - y / h;
      const len = (w / 2 - 6) * (1 - 0.72 * t ** 1.3) * (0.9 + random() * 0.2);
      const wide = 7 * (1 - t * 0.55);
      for (const side of [-1, 1]) {
        const tipX = w / 2 + side * len;
        const tipY = y - len * 0.45;
        const lum = 205 + random() * 40;
        ctx.fillStyle = `rgb(${lum},${lum},${lum - 8})`;
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.quadraticCurveTo(w / 2 + side * len * 0.55, y - wide, tipX, tipY);
        ctx.quadraticCurveTo(w / 2 + side * len * 0.5, y + wide * 0.5, w / 2, y + 3);
        ctx.fill();
        ctx.strokeStyle = 'rgba(120,120,110,0.8)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(w / 2, y);
        ctx.lineTo(tipX, tipY);
        ctx.stroke();
      }
    }
  });
}

/** A bramble leaf, 128 square: a toothed oval with its midrib and side veins, base at the bottom middle, in greys for the tint, clear round it; an opaque patch for the canes. */
export function brambleLeafTexture(random) {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.fillRect(0, 0, 6, 6);
    const cx = w / 2;
    ctx.beginPath();
    const teeth = 26;
    for (let i = 0; i <= teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const rx = 52 + (i % 2) * 6;
      const ry = 56 + (i % 2) * 6;
      const x = cx + Math.cos(a) * rx * (1 - 0.1 * Math.sin(a));
      const y = h / 2 - Math.sin(a) * ry;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    const g = ctx.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, 'rgb(190,190,180)');
    g.addColorStop(1, 'rgb(245,245,238)');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(110,110,100,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, h - 6);
    ctx.lineTo(cx, 8);
    ctx.stroke();
    ctx.lineWidth = 1;
    for (let y = h - 26; y > 24; y -= 16) {
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx, y);
        ctx.lineTo(cx + side * (34 - (h - y) * 0.12), y - 20 - random() * 4);
        ctx.stroke();
      }
    }
  });
}

/** The leaf material: lit, alpha-tested, double-sided (the back of a leaf takes the light the other way, so its underside is darker), tinted by the geometry's vertex colours. */
export function plantMaterial(map) {
  return new THREE.MeshLambertMaterial({ map, vertexColors: true, alphaTest: 0.5, side: THREE.DoubleSide });
}

/** A BufferGeometry from flat arrays; every normal points up, so a plant is lit from above as the ground it stands in is. */
function finish(pos, uv, colors) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  return geo;
}

/**
 * A fern: `fronds` fronds arching out from the crown, each a curved strip of four segments (eight triangles, seen from both sides by the material) with the
 * fern texture across it, so it shows its pinnae. A plant `turn` (0..1) through its autumn: its fronds turn from their tips in, each its own colour.
 */
export function fernGeometry(random, { autumn = false, turn = 0, fronds = 13, length = 0.8, width = 0.11, droop = 0.8 } = {}) {
  const pos = [];
  const uv = [];
  const colors = [];
  for (let f = 0; f < fronds; f++) {
    const yaw = (f / fronds) * Math.PI * 2 + random() * 0.8;
    const lean = 0.5 + random() * 0.5;
    const len = length * (0.75 + random() * 0.5);
    const segs = 4;
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const out = len * t * lean;
      const up = len * (t * (1 - lean * 0.3) - droop * t * t);
      pts.push({ x: Math.cos(yaw) * out, y: up, z: Math.sin(yaw) * out, sx: -Math.sin(yaw) * width, sz: Math.cos(yaw) * width, t });
    }
    const frondTurn = clamp01(turn + (random() - 0.5) * 0.5);
    const tint = pts.map((p) => leafColour(random, autumn, p.t, frondTurn));
    for (let i = 0; i < segs; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const v = [
        [a.x - a.sx, a.y, a.z - a.sz, 0, a.t, tint[i]],
        [a.x + a.sx, a.y, a.z + a.sz, 1, a.t, tint[i]],
        [b.x + b.sx, b.y, b.z + b.sz, 1, b.t, tint[i + 1]],
        [b.x - b.sx, b.y, b.z - b.sz, 0, b.t, tint[i + 1]],
      ];
      for (const tri of [[0, 1, 2], [0, 2, 3]]) {
        for (const k of tri) {
          pos.push(v[k][0], v[k][1], v[k][2]);
          uv.push(v[k][3], 0.03 + v[k][4] * 0.97);
          colors.push(...v[k][5]);
        }
      }
    }
  }
  return finish(pos, uv, colors);
}

/**
 * A clump of arching bramble canes, a metre or so high: dark red-brown canes and, on each side of the cane, a leaf card with the bramble leaf's veins and teeth,
 * its colour its own and turning with the plant's autumn (`turn`), more out along the cane. The canes are the texture's opaque patch, brown by vertex colour.
 */
export function brambleGeometry(random, { autumn = false, turn = 0 } = {}) {
  const pos = [];
  const uv = [];
  const colors = [];
  const stem = (a, b, c, d, col) => {
    for (const tri of [[a, b, c], [a, c, d]]) {
      for (const v of tri) {
        pos.push(...v);
        uv.push(0.02, 0.02);
        colors.push(...col);
      }
    }
  };
  const leaf = (a, b, c, d, col) => {
    const uvs = [[0.5, 0.02], [0.02, 0.5], [0.5, 0.98], [0.98, 0.5]];
    for (const tri of [[0, 1, 2], [0, 2, 3]]) {
      for (const k of tri) {
        pos.push(...[a, b, c, d][k]);
        uv.push(...uvs[k]);
        colors.push(...col);
      }
    }
  };
  for (let k = 0; k < 5; k++) {
    const yaw = (k / 5) * Math.PI * 2 + random() * 0.6;
    const dx = Math.cos(yaw);
    const dz = Math.sin(yaw);
    const reach = 0.6 + random() * 0.5;
    const rise = 0.45 + random() * 0.35;
    const caneTurn = clamp01(turn + (random() - 0.5) * 0.5);
    let prev = null;
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      const p = [dx * reach * t, rise * Math.sin(t * Math.PI * 0.8) - t * t * 0.25, dz * reach * t];
      if (prev) {
        const w = 0.016 * (1 - t * 0.5);
        stem([prev[0] - dz * w, prev[1], prev[2] + dx * w], [prev[0] + dz * w, prev[1], prev[2] - dx * w], [p[0] + dz * w, p[1], p[2] - dx * w], [p[0] - dz * w, p[1], p[2] + dx * w], [0.2 + random() * 0.08, 0.1, 0.07]);
        if (i > 1) {
          for (const side of [-1, 1]) {
            const lx = p[0] - dz * side * 0.1;
            const lz = p[2] + dx * side * 0.1;
            const s = 0.12 + random() * 0.05;
            leaf([p[0], p[1], p[2]], [lx - dx * s, p[1] + 0.02, lz - dz * s], [lx + dz * s * 0.3, p[1] + 0.05, lz - dx * s * 0.3 + 0.0], [lx + dx * s, p[1] + 0.02, lz + dz * s], leafColour(random, autumn, t, caneTurn));
          }
        }
      }
      prev = p;
    }
  }
  return finish(pos, uv, colors);
}

/**
 * Leafy sprays for a tree's crown (#1004), 256 by 128, in their own colours, clear between: on the left a hawthorn's, a crooked twig crowded with
 * small dark lobed leaves, a thorn or two and bunches of red haws; on the right an ash's, compound leaves of paired pale leaflets and a hanging bunch
 * of keys; an opaque bark-brown patch in the top left corner for the stems. For the tree kit's crowns (landmarkProps.js `crownCards`).
 */
export function sprayTexture(random) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(112,98,84)';
    ctx.fillRect(0, 0, 6, 6);
    const leaf = (x, y, r, a, fill, edge) => {
      ctx.fillStyle = fill;
      for (const [dx, dy, k] of [[0, 0, 1], [-0.5, 0.35, 0.65], [0.5, 0.35, 0.65]]) {
        ctx.beginPath();
        ctx.ellipse(x + (Math.cos(a) * dx - Math.sin(a) * dy) * r, y + (Math.sin(a) * dx + Math.cos(a) * dy) * r, r * 0.55 * k, r * k, a, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = edge;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.9);
      ctx.lineTo(x, y - r * 0.8);
      ctx.stroke();
    };
    // The hawthorn: a twig and its side shoots, leaves all along them filling a rough round spray, haws in bunches.
    const cx = w / 4;
    ctx.strokeStyle = 'rgb(70,54,40)';
    ctx.lineWidth = 2.5;
    const shoots = [];
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (random() - 0.5) * 2.2;
      const len = 26 + random() * 30;
      const x0 = cx + (random() - 0.5) * 10;
      const y0 = h - 6 - random() * 30;
      shoots.push([x0, y0, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len]);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
      ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const [x0, y0, x1, y1] = shoots[Math.floor(random() * shoots.length)];
      const t = random();
      const x = x0 + (x1 - x0) * t + (random() - 0.5) * 16;
      const y = y0 + (y1 - y0) * t + (random() - 0.5) * 16;
      if (x < 10 && y < 10) continue;
      const g = 0.8 + random() * 0.4;
      leaf(Math.max(6, Math.min(w / 2 - 6, x)), Math.max(6, y), 5 + random() * 3, random() * Math.PI * 2, `rgb(${Math.round(72 * g)},${Math.round(106 * g)},${Math.round(46 * g)})`, `rgba(40,58,26,0.6)`);
    }
    // Haws, a centimetre across, in small bunches at the shoots' ends.
    for (let i = 0; i < 4; i++) {
      const [, , x1, y1] = shoots[Math.floor(random() * shoots.length)];
      for (let k = 0; k < 3; k++) {
        const x = x1 + (random() - 0.5) * 6;
        const y = y1 + (random() - 0.5) * 5 + 3;
        ctx.fillStyle = 'rgb(128,30,20)';
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // The ash: four compound leaves from the foot of the spray, each a midrib with five or six pairs of leaflets and one at its end, and keys.
    const ax = (3 * w) / 4;
    for (let i = 0; i < 4; i++) {
      const a = -Math.PI / 2 + (i - 1.5) * 0.45 + (random() - 0.5) * 0.2;
      const len = 46 + random() * 12;
      const x0 = ax + (random() - 0.5) * 6;
      const y0 = h - 4;
      ctx.strokeStyle = 'rgb(96,110,60)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a) * len, y0 + Math.sin(a) * len);
      ctx.stroke();
      for (let k = 1; k <= 6; k++) {
        const t = k / 6.3;
        const px = x0 + Math.cos(a) * len * t;
        const py = y0 + Math.sin(a) * len * t;
        for (const side of k === 6 ? [0] : [-1, 1]) {
          const la = a + side * 1.15;
          const g = 0.85 + random() * 0.3;
          ctx.fillStyle = `rgb(${Math.round(86 * g)},${Math.round(118 * g)},${Math.round(52 * g)})`;
          ctx.beginPath();
          ctx.ellipse(px + Math.cos(la) * 6, py + Math.sin(la) * 6, 6.5, 2.4, la, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    for (let k = 0; k < 9; k++) {
      ctx.fillStyle = 'rgb(150,136,84)';
      ctx.beginPath();
      ctx.ellipse(ax + 30 + (random() - 0.5) * 10, 30 + k * 3 + random() * 4, 1.6, 6, 0.3 + (random() - 0.5) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

/** Triangles in one gorse bush, at most (#1004): the pit's field has a hundred or so of them. */
export const GORSE_TRIANGLES = 200;

/**
 * Gorse shoots, 256 by 128 (#1004), in their own colours: two shoots side by side, each a stiff green stem bristling with dark spines all along it, the
 * left one in flower (clusters of yellow pea flowers up its top two-thirds), the right one not, clear between; an opaque dark patch for the bush's heart.
 */
export function gorseTexture(random) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgb(52,72,34)';
    ctx.fillRect(0, 0, 6, 6);
    for (const [cx, flowers] of [[w * 0.25, true], [w * 0.75, false]]) {
      ctx.strokeStyle = 'rgb(66,88,40)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cx, h - 2);
      ctx.quadraticCurveTo(cx + 4, h / 2, cx - 2, 6);
      ctx.stroke();
      // Spines: short, stiff and pointing up the shoot, in tufts all the way along it.
      for (let i = 0; i < 150; i++) {
        const y = 6 + random() * (h - 10);
        const side = random() < 0.5 ? -1 : 1;
        const len = 9 + random() * 16;
        const a = -Math.PI / 2 + side * (0.35 + random() * 0.7);
        ctx.strokeStyle = random() < 0.5 ? 'rgb(44,66,30)' : 'rgb(70,96,44)';
        ctx.lineWidth = 1 + random() * 1.2;
        ctx.beginPath();
        ctx.moveTo(cx + side * random() * 3, y);
        ctx.lineTo(cx + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      if (!flowers) continue;
      for (let i = 0; i < 26; i++) {
        const y = 8 + random() * h * 0.62;
        const x = cx + (random() - 0.5) * 34;
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = k ? 'rgb(240,196,30)' : 'rgb(196,142,20)';
          ctx.beginPath();
          ctx.ellipse(x + (random() - 0.5) * 5, y + (random() - 0.5) * 4, 3 + random() * 2, 2.4 + random() * 1.5, random() * Math.PI, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  });
}

/**
 * A gorse bush (#1004), about a metre and a half across and a metre high at scale 1: a dark, dense heart and about forty spiny shoots standing out
 * of it all round and over the top, each a crossed pair of the gorse texture's cards, `flowering` of them in flower. Its foot at the origin. For the
 * pit's field, and anywhere rough ground has gone to gorse. The material is `plantMaterial(gorseTexture(...))`.
 */
export function gorseBushGeometry(random, { shoots = 44, flowering = 0.45 } = {}) {
  const pos = [];
  const uv = [];
  const colors = [];
  const put = (p, q, col) => {
    pos.push(...p);
    uv.push(...q);
    colors.push(...col);
  };
  // The heart: a low dark-green dome, smaller than the shoots' reach, so you never see through the bush and never see it either.
  const heart = new THREE.IcosahedronGeometry(0.24, 0).toNonIndexed();
  const hp = heart.attributes.position;
  for (let i = 0; i < hp.count; i++) {
    const y = hp.getY(i);
    put([hp.getX(i) * 1.15, Math.max(0.02, 0.24 + y * 0.8), hp.getZ(i) * 1.15], [0.012, 0.98], [1, 1, 1]);
  }
  for (let k = 0; k < shoots; k++) {
    const a = random() * Math.PI * 2;
    const up = k < 10 ? 0.02 + random() * 0.2 : 0.15 + random() * 0.85; // a ring of them low round the skirt, the rest over the top
    const d = [Math.cos(a) * Math.sqrt(1 - up * up), up, Math.sin(a) * Math.sqrt(1 - up * up)];
    const base = [d[0] * 0.22, 0.26 + d[1] * 0.2, d[2] * 0.22];
    const len = 0.45 + random() * 0.35;
    const tip = [base[0] + d[0] * len, base[1] + d[1] * len, base[2] + d[2] * len];
    const half = 0.13 + random() * 0.05;
    const [u0, u1] = random() < flowering ? [0.0, 0.5] : [0.5, 1.0];
    const shade = 0.8 + random() * 0.3;
    const col = [shade, shade, shade * 0.95];
    // Two cards crossed along the shoot: one across it level, one across it upright.
    const across = [[-d[2], 0, d[0]], [d[1] * d[0], -(d[0] * d[0] + d[2] * d[2]), d[1] * d[2]]];
    for (const s of across) {
      const l = Math.hypot(...s) || 1;
      const o = s.map((v) => (v / l) * half);
      const a0 = [base[0] - o[0], base[1] - o[1], base[2] - o[2]];
      const a1 = [base[0] + o[0], base[1] + o[1], base[2] + o[2]];
      const b0 = [tip[0] - o[0], tip[1] - o[1], tip[2] - o[2]];
      const b1 = [tip[0] + o[0], tip[1] + o[1], tip[2] + o[2]];
      // The canvas is drawn top down with the shoot's foot at its bottom, so v = 0 is the foot.
      for (const [p, q] of [[a0, [u0, 0]], [a1, [u1, 0]], [b1, [u1, 1]], [a0, [u0, 0]], [b1, [u1, 1]], [b0, [u0, 1]]]) put(p, q, col);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
