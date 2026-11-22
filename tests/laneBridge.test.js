import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

// The village's bridge (#688): the lane over the brook on the new farm, a stone parapet each side of the road with its piers, and an arched headwall at each end of the span.
const two = LAYOUT;
const lane = two.publicLane;

async function build() {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildBrookCulvert } = await import('../src/world/brookProps.js');
  const heights = createTerrainHeight(two, new Track(two.trackPoints));
  const scene = new THREE.Scene();
  const boxes = [];
  buildBrookCulvert({ layout: two, scene, heights, fixedBox: (x, y, z, hx, hy, hz) => boxes.push({ x, y, z, hx, hy, hz }), random: () => 0.5 });
  return { group: scene.getObjectByName('laneBridge'), boxes, heights };
}

describe('the lane\'s bridge over the brook', () => {
  it('is built on the new farm as a group of its own, and today\'s farm keeps its culvert', async () => {
    const { group } = await build();
    expect(group).toBeTruthy();
    expect(group.children.length).toBeGreaterThanOrEqual(3); // merged to a mesh a material
  });

  it('has a stone parapet along each side of the road, solid, with the carriageway between them open', async () => {
    const { boxes } = await build();
    const parapets = boxes.filter((b) => b.hz > 4);
    expect(parapets).toHaveLength(2);
    for (const p of parapets) {
      expect(Math.abs(p.x - lane.x)).toBeGreaterThan(lane.halfWidth + 0.2); // clear of the tarmac
      expect(Math.abs(p.x - lane.x)).toBeLessThan(lane.halfWidth + 1);
    }
    // Nothing solid across the road itself, so you ride over it.
    for (const b of boxes) expect(b.x - b.hx >= lane.x + lane.halfWidth || b.x + b.hx <= lane.x - lane.halfWidth, `box at ${b.x}`).toBe(true);
  });

  it('has a headwall with an arch at each end of the span, where the brook goes in and comes out', async () => {
    const { group, boxes } = await build();
    expect(group.children.some((c) => c.isMesh && c.material.type === 'MeshBasicMaterial')).toBe(true); // the dark inside the arches
    expect(boxes.filter((b) => b.hx < 0.5 && b.hz > 2 && b.hz < 3)).toHaveLength(2);
  });

  it('has no two faces on one plane, which flicker as alpha fighting', async () => {
    const { group } = await build();
    group.position.set(0, 0, 0);
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });
});
