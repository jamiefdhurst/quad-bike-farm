import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { barnShape, dividerPosts } from '../src/world/barn.js';
import { buildBarnTrim, pipeXs } from '../src/world/barnTrim.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { fakeCanvas } from './helpers/vehicleModels.js';

// The barn's roof and second-span trim (#817): gutters and downpipes on both outer eaves, the valley's drop, a hood over the second door, pads and braces at the posts.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const L = { ...two, ...two.barnLocal };
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
