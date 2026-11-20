import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { barnShape, dividerPosts } from '../src/world/barn.js';
import { buildBarnTrim, pipeXs } from '../src/world/barnTrim.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The barn's roof and second-span trim (#817): gutters and downpipes on both outer eaves, the valley's drop, a hood over the second door, pads and braces at the posts.
const L = { ...LAYOUT, ...LAYOUT.barnLocal }; // today's barn, with its two spans
const shape = barnShape(L);

describe('the barn\'s trim', () => {
  let group;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    group = buildBarnTrim({ shape, floorY: 0, eaveZ: 2.95, eaveY: 3.9, posts: dividerPosts(L), random: () => 0.5 });
  });
  it('is a handful of merged meshes standing on the floor and no higher than the ridge', () => {
    let meshes = 0;
    group.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeGreaterThan(4);
    expect(meshes).toBeLessThan(14);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(shape.ridge + 0.4);
  });
  it('has a downpipe at each span\'s outer eave, standing clear of the corner post and inside the wall\'s length', () => {
    for (const x of pipeXs(shape.outer)) {
      expect(x).toBeGreaterThan(shape.outer.minX + 0.5);
      expect(x).toBeLessThan(shape.outer.maxX - 0.5);
    }
  });
  it('reaches beyond the second span\'s outer wall for its gutter, not into the yard of the first', () => {
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.z).toBeLessThan(shape.outer.minZ);
    expect(box.max.z).toBeGreaterThan(shape.annex.outer.maxZ);
  });
  it('has no two faces on one plane', () => {
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});

// The one-building barn's roof trim (#818): a gutter along each long eave, a downpipe at each end of each, and barge boards on both gables.
describe('the one-building barn\'s trim', async () => {
  const { layoutNew } = await import('../src/world/layoutNew.js');
  const { RAW_LAYOUT } = await import('../src/world/layout.js');
  const { buildWideTrim } = await import('../src/world/barnTrim.js');
  const { roofOf } = await import('../src/world/barnWide.js');
  const two = layoutNew(LAYOUT, RAW_LAYOUT);
  const wide = barnShape({ ...two, ...two.barnLocal });
  const roof = roofOf(wide);
  let group;
  beforeAll(() => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    group = buildWideTrim({ shape: wide, floorY: 0, roof, random: () => 0.5 });
  });
  it('has a roof of 18 m of span at about 21 degrees, eaves 5 m up', () => {
    expect(wide.wide).toBe(true);
    expect(roof.half * 2).toBeCloseTo(18, 6);
    expect(roof.slope * (180 / Math.PI)).toBeGreaterThan(18);
    expect(roof.slope * (180 / Math.PI)).toBeLessThan(25);
    expect(roof.eaveY).toBeLessThan(wide.wallHeight);
  });
  it('is a handful of merged meshes standing on the floor and no higher than the ridge', () => {
    let meshes = 0;
    group.traverse((o) => { if (o.isMesh) meshes++; });
    expect(meshes).toBeGreaterThanOrEqual(3);
    expect(meshes).toBeLessThan(10);
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.y).toBeGreaterThanOrEqual(-0.01);
    expect(box.max.y).toBeLessThan(wide.ridge + 0.4);
  });
  it('hangs its gutters beyond both long walls, and its barge boards beyond both gables', () => {
    const box = new THREE.Box3().setFromObject(group);
    expect(box.min.x).toBeLessThan(wide.outer.minX - 0.3);
    expect(box.max.x).toBeGreaterThan(wide.outer.maxX + 0.3);
    expect(box.min.z).toBeLessThan(wide.outer.minZ);
    expect(box.max.z).toBeGreaterThan(wide.outer.maxZ);
  });
  it('has no two faces on one plane', () => {
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${'xyz'[f.axis]}${f.dir > 0 ? '+' : '-'} at ${f.at.map((v) => v.toFixed(2))} area ${f.area.toFixed(4)}`)).toEqual([]);
  });
});
