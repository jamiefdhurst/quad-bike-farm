// The cheap far version of the hedges and walls: past `hedgeFullDistance` each tile of leafy blocks (props.js, buildHedges) is swapped for a
// plain strip of the same length, height and thickness, one mesh a tile, with the uneven top line the blocks make, a shaded foot and no leaves,
// sway or shadows. Walls (drystone, #696) are the same strip in grey with a lighter cope. See docs/decisions/performance.md, "Hedges and walls far
// away (#667)". The village and the neighbour's farm do the same with a far version of their own (farVersion.js).

import * as THREE from 'three';
import { tileInstances, distanceToTile } from './tiles.js';
import { MODEL_TILE } from './tiledInstances.js';

const SINK = 0.3; // m the strip goes into the ground, as the blocks do, so no gap shows on a slope
const FOOT = 0.6; // how dark the bottom of a hedge is against its top: the inside of a hedgerow gets little light
const KINDS = {
  // The share of its foot's width the top keeps (a hedge is clipped narrower at the top; a wall batters in), the colours as the near one has them.
  hedge: { taper: 0.65, side: 0x5d7d3f, top: 0x72925a, foot: FOOT },
  wall: { taper: 0.8, side: 0xa39e90, top: 0xb5b0a2, foot: 0.85 }, // the drystone wall's weathered grey, a little lighter and warmer than its stones' average (hsl 0.125, 0.09, 0.27), as seen at 150 m; lighter along the cope
};
export const FAR_HEDGE_TOP = 0.96; // the strip's top against the block's bounding box: a block is leafy and thins at its top, so its eye-level top is a little under it
export const FAR_HEDGE_WIDTH = 0.9; // and its width against the block's: the same
export const FAR_HEDGE_END = 0.7; // m a stretch's strip runs past its last block's middle
const WALL_END = 0.25; // m a wall's strip runs past its last stone's middle
const MARGIN = 10; // m a tile of the near version holds past the distance once drawn, so the swap doesn't flicker on the line

/**
 * Flat triangles for runs of hedge or wall: `positions` and `colors` (r, g, b a vertex, linear), and `normals`. A run is a list of pieces in order
 * along the line, each `{ x, z, cx, cz, along: [dx, dz], length, width, top, groundA, groundB }` (where its block stands, for the tile; the strip's centre, `x`, `z` if absent; unit direction; metres long and across; the
 * top's height above the sea level of the world; the ground at its two ends), and `kind` ('hedge' or 'wall'). A piece whose `gap` is true starts
 * a new stretch (there was a gateway before it); the stretch's ends are closed. Each piece's top rises to its own height in the middle and
 * meets its neighbours' halfway, so the line is uneven as the blocks are.
 */
export function farHedgeTriangles(runs, kind = 'hedge') {
  const spec = KINDS[kind];
  const positions = [];
  const colors = [];
  const col = (hex, k = 1) => {
    const c = new THREE.Color(hex);
    return [c.r * k, c.g * k, c.b * k];
  };
  const quad = (a, b, c, d, ca, cb) => {
    // a, b along the bottom edge, c, d the top edge above b, a: the colour at the foot and at the top; the winding faces out when they run anticlockwise from outside
    positions.push(...a, ...c, ...b, ...a, ...d, ...c);
    colors.push(...ca, ...cb, ...ca, ...ca, ...cb, ...cb);
  };
  const pieces = [];
  for (const run of runs) {
    run.forEach((p, i) => {
      const prev = run[i - 1] && !p.gap ? run[i - 1] : null;
      const next = run[i + 1] && !run[i + 1].gap ? run[i + 1] : null;
      const topA = prev ? (prev.top + p.top) / 2 : p.top;
      const topB = next ? (next.top + p.top) / 2 : p.top;
      const [dx, dz] = p.along;
      const nx = -dz;
      const nz = dx;
      const half = p.length / 2;
      const bw = p.width / 2;
      const tw = bw * spec.taper;
      // Three stations along the piece: its two ends and its middle, each a bottom and a top pair either side of the line.
      const station = (s, groundY, topY) => {
        const cx = (p.cx ?? p.x) + dx * s;
        const cz = (p.cz ?? p.z) + dz * s;
        return {
          bl: [cx - nx * bw, groundY - SINK, cz - nz * bw],
          br: [cx + nx * bw, groundY - SINK, cz + nz * bw],
          tl: [cx - nx * tw, topY, cz - nz * tw],
          tr: [cx + nx * tw, topY, cz + nz * tw],
        };
      };
      const A = station(-half, p.groundA, topA);
      const M = station(0, (p.groundA + p.groundB) / 2, p.top);
      const B = station(half, p.groundB, topB);
      const foot = col(spec.side, spec.foot);
      const side = col(spec.side);
      const top = col(spec.top);
      for (const [s, e] of [[A, M], [M, B]]) {
        quad(s.bl, e.bl, e.tl, s.tl, foot, side); // the side on the left of the line, wound to face out
        quad(e.br, s.br, s.tr, e.tr, foot, side); // and the right
        quad(s.tl, e.tl, e.tr, s.tr, top, top); // the top
      }
      if (!prev) quad(A.br, A.bl, A.tl, A.tr, foot, side); // the stretch's ends
      if (!next) quad(B.bl, B.br, B.tr, B.tl, foot, side);
      pieces.push(p);
    });
  }
  const normals = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 9) {
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = positions.slice(i, i + 9);
    const ux = bx - ax;
    const uy = by - ay;
    const uz = bz - az;
    const vx = cx - ax;
    const vy = cy - ay;
    const vz = cz - az;
    let x = uy * vz - uz * vy;
    let y = uz * vx - ux * vz;
    let z = ux * vy - uy * vx;
    const l = Math.hypot(x, y, z) || 1;
    x /= l;
    y /= l;
    z /= l;
    for (let k = 0; k < 3; k++) normals.set([x, y, z], i + k * 3);
  }
  return { positions: new Float32Array(positions), colors: new Float32Array(colors), normals, pieces: pieces.length };
}

/**
 * The far pieces for a wall built of tiled stones (`hillProps.js`, buildWall): for each tile of `near` (a group of meshes with `userData.tile`)
 * and each of the wall's `spans` ([from, to] along x) it crosses, short pieces `step` m long that follow the ground, in the tile's own bounds
 * so a piece is in the same tile as the stones it stands for (`z` is the tile's, `cz` the wall's line). The first piece of a span has a `gap`.
 */
export function wallFarPieces(near, spans, { z, height, width, groundAt, step = 3 }) {
  const pieces = [];
  for (const mesh of near.children) {
    const tile = mesh.userData.tile;
    for (const [a, b] of spans) {
      const lo = Math.max(a, tile.minX - WALL_END);
      const hi = Math.min(b, tile.maxX + WALL_END);
      if (hi - lo < WALL_END) continue;
      const n = Math.max(1, Math.round((hi - lo) / step));
      for (let k = 0; k < n; k++) {
        const from = lo + ((hi - lo) * k) / n;
        const to = lo + ((hi - lo) * (k + 1)) / n;
        const mid = (from + to) / 2;
        pieces.push({
          x: mid, z: tile.minZ, cx: mid, cz: z, along: [1, 0], length: to - from, width, top: groundAt(mid, z) + height, gap: k === 0, kind: 'wall',
          groundA: groundAt(from, z), groundB: groundAt(to, z),
        });
      }
    }
  }
  return pieces;
}

/**
 * The far strips as a group of meshes, one a tile of ground in the same tiles the near blocks are in (`tiledInstances.js`, MODEL_TILE), each
 * with its tile in `userData.tile`, so each can be swapped for its near tiles by `HedgeSwap`. `pieces` are as for `farHedgeTriangles`, all in
 * one list in order, each with its `kind`, and a `gap` where a stretch starts. `tint` is the near leaves' colour multiplier (autumn and
 * winter turn them), so the strip turns with them.
 */
export function buildFarHedges(pieces, { tint = [1, 1, 1], name = 'hedgesFar' } = {}) {
  const group = new THREE.Group();
  group.name = name;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const wallMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  // The leaf texture is a green the tint multiplies; the plain strip has no texture, so the tint is applied to its vertex colours as it is built.
  for (const tile of tileInstances(pieces, MODEL_TILE)) {
    for (const kind of Object.keys(KINDS)) {
      const mine = tile.indices.map((i) => pieces[i]).filter((p) => (p.kind ?? 'hedge') === kind);
      if (!mine.length) continue;
      // Runs inside the tile: a stretch starts where a piece says so, or where the tile's pieces stop being next to each other.
      const runs = [];
      for (const p of mine) {
        if (!runs.length || p.gap) runs.push([{ ...p, gap: true }]);
        else runs[runs.length - 1].push(p);
      }
      const { positions, colors, normals } = farHedgeTriangles(runs, kind);
      if (kind === 'hedge') {
        for (let i = 0; i < colors.length; i += 3) {
          colors[i] *= tint[0];
          colors[i + 1] *= tint[1];
          colors[i + 2] *= tint[2];
        }
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, kind === 'wall' ? wallMaterial : material);
      mesh.castShadow = false;
      mesh.receiveShadow = true;
      mesh.visible = false; // the swap draws it once its near tile is out of reach
      mesh.userData.tile = tile;
      group.add(mesh);
    }
  }
  return group;
}

/**
 * Draws each tile of hedge or wall as its near blocks within `distance` metres of it, and as its far strip beyond, with `MARGIN` held either way
 * so a tile on the line doesn't flicker. A distance of 0 draws the blocks everywhere. `near` and `far` are groups of meshes with their tile
 * in `userData.tile`; a tile is the same one in both when its `key` is (tiles.js).
 */
export class HedgeSwap {
  constructor(near, far) {
    this.tiles = new Map();
    for (const [side, group] of [['near', near], ['far', far]]) {
      for (const mesh of group.children) {
        const key = mesh.userData.tile.key;
        let t = this.tiles.get(key);
        if (!t) this.tiles.set(key, (t = { near: [], far: [], tile: null, isNear: true }));
        t[side].push(mesh);
      }
    }
    for (const t of this.tiles.values()) t.tile = (t.near[0] ?? t.far[0]).userData.tile;
  }

  /** `fresh` decides each tile as for the first time, without the margin (the frame budget's count: what is drawn then doesn't depend on the way here). */
  update(position, distance, fresh = false) {
    for (const t of this.tiles.values()) {
      const d = distanceToTile(t.tile, position.x, position.z);
      const isNear = !(distance > 0) || !t.far.length || d <= (t.isNear && !fresh ? distance + MARGIN : distance);
      if (isNear === t.isNear && t.set) continue;
      t.isNear = isNear;
      t.set = true;
      for (const m of t.near) m.visible = isNear;
      for (const m of t.far) m.visible = !isNear;
    }
  }
}

/** The colour multiplier the near hedge leaves were given (autumn.js: yellow-brown in autumn, dull in winter), 1 if none. */
export function leafTint(root) {
  let tint = [1, 1, 1];
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m?.map && m.alphaTest === 0.5) tint = [m.color.r, m.color.g, m.color.b];
  });
  return tint;
}
