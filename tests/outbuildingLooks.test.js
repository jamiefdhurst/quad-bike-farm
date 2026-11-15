import { describe, it, expect, vi, beforeAll } from 'vitest';
import * as THREE from 'three';
import { headlessContext } from './helpers/worldModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';

// The Dutch barn and the field shed as the east fields' builder draws them. Jamie's walk of them (#670) found the barn's sheeting banded in
// thirds with the rust in a different place on each, the shed's walls two colours, and the shed's doorway fighting: each is a tile repeating
// where the wall is taller than the tile, or two faces on one plane, and neither shows in a unit test of their shape.

const damps = []; // the stone texture's 'rising damp' gradients, one per canvas that drew one
let scene;

beforeAll(async () => {
  vi.stubGlobal('document', {
    createElement: () => {
      const canvas = { width: 0, height: 0, style: {} };
      const ctx = new Proxy({ canvas }, { get: (t, k) => (k in t ? t[k] : k === 'createLinearGradient' ? (x0, y0, x1, y1) => (damps.push({ w: canvas.width, h: canvas.height, y0, y1 }), { addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => ({ addColorStop() {} })), set: (t, k, v) => ((t[k] = v), true) });
      canvas.getContext = () => ctx;
      return canvas;
    },
  });
  const { buildOutbuildings } = await import('../src/world/outbuildingProps.js');
  const c = headlessContext();
  const bale = { geo: new THREE.CylinderGeometry(0.7, 0.7, 1.2, 12), straw: new THREE.MeshStandardMaterial({ color: 0xc8a850 }) };
  buildOutbuildings({ ...c, bale });
  scene = c.scene;
});

const named = (name) => {
  let found = null;
  scene.traverse((o) => {
    if (o.name === name) found = o;
  });
  return found;
};
const vRange = (mesh) => {
  const uv = mesh.geometry.getAttribute('uv');
  let lo = Infinity;
  let hi = -Infinity;
  for (let i = 0; i < uv.count; i++) {
    lo = Math.min(lo, uv.getY(i));
    hi = Math.max(hi, uv.getY(i));
  }
  return [lo, hi];
};

describe("the Dutch barn's sheeting", () => {
  it('runs one tile of the corrugated texture up its back wall, so its rust band and streaks are not repeated part way up', () => {
    const [lo, hi] = vRange(named('dutch-barn-back-sheet'));
    expect(hi - lo).toBeLessThanOrEqual(1.001);
  });

  it('runs one tile up its east end too, to the crown of the curve', () => {
    const [lo, hi] = vRange(named('dutch-barn-end-sheet'));
    expect(lo).toBeGreaterThanOrEqual(-0.001);
    expect(hi).toBeLessThanOrEqual(1.001);
  });
});

describe('the field shed', () => {
  it("has no rising-damp gradient baked into its stone tile, which repeats up a wall taller than the tile and shows as a second, darker stone", () => {
    const stoneCanvases = damps.filter((d) => d.w === 512 && d.h === 512 && d.y0 === d.h * 0.6);
    expect(stoneCanvases).toEqual([]);
  });

  it('has no two faces on one plane at its doorway, which flicker as alpha fighting', () => {
    const s = LAYOUT.fieldShed;
    const near = (o) => {
      const b = new THREE.Box3().setFromObject(o);
      const c = b.getCenter(new THREE.Vector3());
      return Math.hypot(c.x - s.x, c.z - s.z) < 8;
    };
    const fights = coplanarOverlaps(scene, { gap: 0.003, minArea: 2e-5, textured: true, skip: (o) => !near(o) });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });
});
