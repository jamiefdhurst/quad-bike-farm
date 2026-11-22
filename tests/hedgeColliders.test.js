import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import { LAYOUT } from '../src/world/layout.js';
import { createFields } from '../src/world/fields.js';
import { layHedge } from '../src/world/hedgeLay.js';
import { HEDGE_SOLID_HALF, HEDGE_LEAF_SLACK, leafReach, blockWidth, bushHeight, widestBlock } from '../src/world/hedgeSolid.js';

// A hedge is solid as far as its leaves reach, and its leaves stay out of its gateways (#829). Built from the real hedge and bush models' vertices
// and the same laying-out props.js uses, so a block or bush that sticks out past the collider, or into a way through, fails here.

/** The model's vertices as a stand-in the code reads (traverse, matrixWorld and a position attribute), straight from the .glb. */
function glbModel(name) {
  const b = fs.readFileSync(new URL(`../public/models/${name}.glb`, import.meta.url));
  const n = b.readUInt32LE(12);
  const j = JSON.parse(b.subarray(20, 20 + n).toString());
  const acc = j.accessors[j.meshes[0].primitives[0].attributes.POSITION];
  const view = j.bufferViews[acc.bufferView];
  const off = 20 + n + 8 + (view.byteOffset || 0) + (acc.byteOffset || 0);
  const stride = view.byteStride || 12;
  const sc = j.nodes.find((x) => x.mesh !== undefined).scale[0];
  const xyz = (i, k) => b.readFloatLE(off + i * stride + 4 * k) * sc;
  const verts = Array.from({ length: acc.count }, (_, i) => [xyz(i, 0), xyz(i, 1), xyz(i, 2)]);
  const position = { count: verts.length, getX: (i) => verts[i][0], getY: (i) => verts[i][1], getZ: (i) => verts[i][2] };
  const mesh = { isMesh: true, geometry: { attributes: { position } }, matrixWorld: { elements: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] } };
  const lo = [0, 1, 2].map((k) => Math.min(...verts.map((v) => v[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...verts.map((v) => v[k])));
  return { root: { traverse: (f) => f(mesh) }, verts, size: { x: hi[0] - lo[0], y: hi[1] - lo[1], z: hi[2] - lo[2] } };
}

/** The corners of the points' outline in plan (x, z): every limit checked here is a distance in a direction, so a corner is the farthest. */
function outline(verts) {
  const pts = [...new Map(verts.map((v) => [`${v[0].toFixed(4)},${v[2].toFixed(4)}`, v])).values()].sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[2] - o[2]) - (a[2] - o[2]) * (b[0] - o[0]);
  const half = (list) => {
    const h = [];
    for (const p of list) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    return h.slice(0, -1);
  };
  return [...half(pts), ...half([...pts].reverse())];
}

const hedge = glbModel('hedge');
const bush = glbModel('bush');
hedge.corners = outline(hedge.verts);
bush.corners = outline(bush.verts);
const blockReach = leafReach(hedge.root, hedge.size);
const bushReach = leafReach(bush.root, { x: bush.size.y, z: bush.size.y });
const T = LAYOUT.hedgeThickness;
const seeded = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const lines = createFields(LAYOUT).hedges;

/** Every leaf vertex of every block and bush of a laid hedge, as { s (along), a (across) } in the hedge's own frame. */
function leaves(h, lay) {
  const out = [];
  const frame = (x, z) => {
    const flip = h.dx - h.dz < 0 ? -1 : 1;
    const side = { x: -h.dz * flip, z: h.dx * flip };
    const rx = x - h.x1;
    const rz = z - h.z1;
    return { s: rx * h.dx + rz * h.dz, a: rx * side.x + rz * side.z };
  };
  for (const b of lay.blocks) {
    const c = Math.cos(b.spin);
    const sn = Math.sin(b.spin);
    for (const v of hedge.corners) {
      const x = (v[0] / hedge.size.x) * b.width;
      const z = (v[2] / hedge.size.z) * b.width;
      out.push(frame(b.x + c * x + sn * z, b.z - sn * x + c * z));
    }
  }
  for (const b of lay.bushes) {
    const k = b.height / bush.size.y;
    const c = Math.cos(b.yaw);
    const sn = Math.sin(b.yaw);
    for (const v of bush.corners) out.push(frame(b.x + c * v[0] * k + sn * v[2] * k, b.z - sn * v[0] * k + c * v[2] * k));
  }
  return out;
}

const laid = lines.map((h) => ({ h, lay: layHedge(h, { T, H: h.height ?? LAYOUT.hedgeHeight, heightAt: () => 0, random: seeded(1234), blockReach, bushReach }) }));
for (const l of laid) l.pts = leaves(l.h, l.lay); // once: every vertex of every block

describe('hedge leaves and colliders', () => {
  it('keeps every leaf within the solid part and a hand, on every hedge', () => {
    let blocks = 0;
    let bushes = 0;
    for (const { h, lay, pts } of laid) {
      blocks += lay.blocks.length;
      bushes += lay.bushes.length;
      const worst = pts.reduce((m, p) => Math.max(m, Math.abs(p.a)), 0);
      expect(worst).toBeLessThanOrEqual(HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK + 1e-6);
    }
    expect(blocks).toBeGreaterThan(1000);
    expect(bushes).toBeGreaterThan(100);
  });

  it('keeps leaves out of every gateway', () => {
    for (const { h, pts } of laid) {
      for (const p of pts) for (const g of h.gaps) expect(Math.abs(p.s - g.at)).toBeGreaterThanOrEqual(g.half - HEDGE_LEAF_SLACK - 1e-6);
    }
  });

  it('has a collider at every metre of a hedge except in its gateways, none in them', () => {
    for (const { h, lay } of laid) {
      for (let s = -1.5; s <= h.length + 1.5; s += 0.1) {
        const open = h.gaps.some((g) => Math.abs(s - g.at) < g.half);
        const covered = lay.colliders.some((k) => s >= k.s0 - 1e-6 && s <= k.s1 + 1e-6);
        if (open) expect(lay.colliders.some((k) => s > k.s0 + 1e-6 && s < k.s1 - 1e-6)).toBe(false);
        else expect(covered).toBe(true);
      }
    }
  });

  it('stops a walking capsule before any leaf clump, from either side, all along every hedge', () => {
    const r = 0.3; // the capsule's radius in plan
    for (const { h, lay, pts } of laid) {
      const byMetre = new Map(); // the leaves in each 0.5 m along the hedge, so each crossing looks only at its own
      for (const p of pts) {
        const key = Math.floor(p.s / 0.5);
        byMetre.set(key, [...(byMetre.get(key) ?? []), p]);
      }
      for (let s = -1; s <= h.length + 1; s += 0.25) {
        if (h.gaps.some((g) => Math.abs(s - g.at) < g.half + r)) continue; // the way through: walked freely
        const k = lay.colliders.find((c) => s >= c.s0 && s <= c.s1);
        expect(k, `a collider where the capsule crosses at ${s} on a hedge at ${h.x1.toFixed(0)}, ${h.z1.toFixed(0)}`).toBeDefined();
        for (let key = Math.floor((s - r) / 0.5); key <= Math.floor((s + r) / 0.5); key++) {
          for (const p of byMetre.get(key) ?? []) if (Math.abs(p.s - s) < r) expect(Math.abs(p.a)).toBeLessThanOrEqual(k.across + HEDGE_LEAF_SLACK); // any leaf further out is one the capsule would have to push through
        }
      }
    }
  });

  it('shrinks a block or bush only as far as it must', () => {
    expect(blockWidth(T, 0, blockReach, 0)).toBeCloseTo(T * 0.95, 6); // a slim block is as it was
    expect(blockWidth(T, 1, blockReach, 0.2)).toBeLessThanOrEqual(widestBlock(blockReach, 0.2) + 1e-9);
    expect(bushHeight(1, bushReach, 0.1) * bushReach + 0.1).toBeLessThanOrEqual(HEDGE_SOLID_HALF + HEDGE_LEAF_SLACK + 1e-9);
  });
});
