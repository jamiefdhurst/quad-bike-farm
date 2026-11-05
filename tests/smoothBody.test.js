import { describe, it, expect } from 'vitest';
import { splitBody, smoothBodyWanted } from '../src/npc/smoothBody.js';

// A roof: two flat-shaded triangles meeting at a ridge along x, each with its own corners, sloping down to eaves `drop` below
// either side (0.4 a gentle roof, 1 a right angle at the ridge).
function roof({ bones = [[0, 1], [1, 1]], drop = 0.4 } = {}) {
  const tri = [
    [[0, 1, 0], [1, 1, 0], [0, 1 - drop, 1]],
    [[1, 1, 0], [0, 1, 0], [0, 1 - drop, -1]],
  ];
  const corners = tri.flat();
  const positions = new Float32Array(corners.flat());
  const uvs = new Float32Array(corners.flatMap((_, i) => [(i % 3) / 2, i < 3 ? 0 : 1]));
  // The ridge's ends weighted to bone 0 and 1 (by x), the eaves to bone 2.
  const skinIndex = new Uint16Array(corners.length * 4);
  const skinWeight = new Float32Array(corners.length * 4);
  corners.forEach((p, i) => {
    const [bone, w] = p[1] === 1 ? bones[p[0]] : [2, 1];
    skinIndex[i * 4] = bone;
    skinWeight[i * 4] = w;
  });
  return { positions, uvs, skinIndex, skinWeight, index: [0, 1, 2, 3, 4, 5] };
}

const pointAt = (out, i) => [...out.positions.slice(i * 3, i * 3 + 3)];
const near = (a, b) => a.every((x, k) => Math.abs(x - b[k]) < 1e-5);

describe('splitBody', () => {
  it('splits each triangle into four, each with its own corners', () => {
    const out = splitBody(roof(), { round: 0 });
    expect(out.index).toHaveLength(24);
    expect(out.positions).toHaveLength(72);
    expect(out.uvs).toHaveLength(48);
  });

  it('lays the new points at the middle of each edge when nothing is rounded, so the shape is unchanged', () => {
    const out = splitBody(roof(), { round: 0 });
    const ridge = [0.5, 1, 0];
    const at = Array.from({ length: 24 }, (_, i) => pointAt(out, i)).filter((p) => near(p, ridge));
    // The ridge's middle is a corner of three small triangles on each side.
    expect(at).toHaveLength(6);
  });

  it('pushes a shared edge out the same way for both triangles on it, so nothing cracks', () => {
    const out = splitBody(roof(), { round: 1 });
    const ridgeMids = Array.from({ length: 24 }, (_, i) => pointAt(out, i)).filter((p) => Math.abs(p[0] - 0.5) < 1e-5 && Math.abs(p[2]) < 1e-5);
    expect(ridgeMids).toHaveLength(6);
    for (const p of ridgeMids) expect(near(p, ridgeMids[0])).toBe(true);
    // The ridge's ends have normals straight up (the two slopes averaged), so its middle stays on it; the slopes' edges bow out.
    expect(ridgeMids[0][1]).toBeCloseTo(1, 5);
    const slope = Array.from({ length: 24 }, (_, i) => pointAt(out, i)).find((p) => Math.abs(p[0]) < 1e-5 && Math.abs(p[2] - 0.5) < 1e-5);
    expect(slope[1] + 0.4 * slope[2]).toBeGreaterThan(1 + 1e-3); // out past the flat slope y + 0.4z = 1
  });

  it('keeps a crease sharp: nothing rounded where the faces meet at a right angle', () => {
    const flat = splitBody(roof({ drop: 1 }), { round: 0 });
    const out = splitBody(roof({ drop: 1 }), { round: 1 });
    for (let i = 0; i < 24; i++) expect(near(pointAt(out, i), pointAt(flat, i))).toBe(true);
  });

  it('leaves an edge flat when a triangle beside it is not rounded (her hair)', () => {
    const flat = splitBody(roof(), { round: 0 });
    const out = splitBody(roof(), { round: 1, rounded: (t) => t === 0 });
    // The second triangle's own edges stay straight, and so does the ridge it shares.
    for (let i = 12; i < 24; i++) expect(near(pointAt(out, i), pointAt(flat, i))).toBe(true);
  });

  it('keeps each new corner\'s UV inside its own triangle, so the paint does not move', () => {
    const out = splitBody(roof(), { round: 1 });
    for (let i = 0; i < 12; i++) expect(out.uvs[i * 2 + 1]).toBe(0);
    for (let i = 12; i < 24; i++) expect(out.uvs[i * 2 + 1]).toBe(1);
    expect(out.uvs[1 * 2]).toBeCloseTo(0.25, 5); // a to b's middle
  });

  it('blends the skin weights of an edge\'s ends, the four strongest kept and summing to 1', () => {
    const out = splitBody(roof(), { round: 0 });
    for (let i = 0; i < 24; i++) {
      const w = out.skinWeight.slice(i * 4, i * 4 + 4);
      expect(w.reduce((s, x) => s + x, 0)).toBeCloseTo(1, 5);
    }
    const ridge = Array.from({ length: 24 }, (_, i) => i).find((i) => near(pointAt(out, i), [0.5, 1, 0]));
    const pairs = [0, 1, 2, 3].map((j) => [out.skinIndex[ridge * 4 + j], out.skinWeight[ridge * 4 + j]]).filter(([, w]) => w > 0);
    expect(pairs.sort()).toEqual([[0, 0.5], [1, 0.5]]);
  });
});

describe('smoothBodyWanted', () => {
  it('is on unless ?body=flat asks for the model as shipped', () => {
    expect(smoothBodyWanted('?seed=3')).toBe(true);
    expect(smoothBodyWanted(undefined)).toBe(true);
    expect(smoothBodyWanted('?body=smooth')).toBe(true);
    expect(smoothBodyWanted('?seed=3&body=flat')).toBe(false);
  });
});
