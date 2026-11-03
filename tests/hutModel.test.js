import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { coplanarOverlaps } from './helpers/coplanar.js';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { HUT_INSIDE } from '../src/world/hut.js';
import { CAPSULE_RADIUS } from '../src/player/player.js';

const build = async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildHut } = await import('../src/world/hutBuild.js');
  const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
  return buildHut({ layout: LAYOUT, scene: new THREE.Scene(), heights, fixedBox: () => {}, random: () => 0.5 });
};

describe("the shepherd's hut model", () => {
  it('has no two faces on one plane, which flicker as alpha fighting (every part of it is textured, so the check looks at textured ones too)', async () => {
    const { group } = await build();
    group.position.set(0, 0, 0);
    group.rotation.set(0, 0, 0);
    const fights = coplanarOverlaps(group, { gap: 0.003, minArea: 2e-5, textured: true });
    expect(fights.map((f) => `${f.a}/${f.b} at ${f.at.map((v) => v.toFixed(2))}`)).toEqual([]);
  });

  it('has a stovepipe that goes down into the collar on the stove, not stopping short of it', async () => {
    const { group } = await build();
    const box = (name) => new THREE.Box3().setFromObject(group.getObjectByName(name));
    const pipe = box('hutFlue');
    const collar = box('hutFlueCollar');
    expect(pipe.min.y).toBeLessThan(collar.max.y);
    expect(pipe.min.y).toBeGreaterThan(collar.min.y);
  });

  it('has a step deep enough to stand on, because a walking capsule cannot be autostepped onto a tread narrower than itself', () => {
    const [z0, z1] = HUT_INSIDE.stepZ;
    expect(z1 - z0).toBeGreaterThanOrEqual(CAPSULE_RADIUS * 2 + 0.2);
  });
});
