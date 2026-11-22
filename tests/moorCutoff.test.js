import { describe, it, expect, vi, beforeAll } from 'vitest';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';
import { DrawDistance } from '../src/world/tiledInstances.js';
import { distanceToTile } from '../src/world/tiles.js';
import { DEFAULT_GRAPHICS_PARAMS } from '../src/core/graphics.js';

// The Moor's heather, bracken, tussocks and rocks are tiled instances drawn out to `roughDistance` only (#821): the biggest open area on the map.
const two = LAYOUT;
const NAMES = ['moor heather', 'moor bracken', 'moor tussocks', 'moor rocks'];
let tiles;
let params;
let draw;

beforeAll(async () => {
  vi.stubGlobal('document', { createElement: () => fakeCanvas() });
  const { buildMoorProps } = await import('../src/world/moorProps.js');
  const heights = createTerrainHeight(two, new Track(two.trackPoints));
  params = { ...DEFAULT_GRAPHICS_PARAMS };
  draw = new DrawDistance(params);
  const stubCollider = { createCollider: () => ({}) };
  const c = { ...headlessContext(), layout: two, heights, drawDistance: draw, fixedBox: () => {}, physics: stubCollider, RAPIER: { ColliderDesc: new Proxy({}, { get: () => () => ({ setTranslation: () => ({}), setRotation: () => ({}) }) }) } };
  buildMoorProps(c);
  tiles = Object.fromEntries(NAMES.map((n) => [n, draw.groups.find((g) => g.group.name === n)?.group]));
});

describe('the Moor\'s plants and rocks are cut off by distance (#821)', () => {
  it('registers each with the draw distance on `roughDistance`', () => {
    for (const n of NAMES) {
      expect(tiles[n], n).toBeTruthy();
      expect(draw.groups.find((g) => g.group === tiles[n]).key).toBe('roughDistance');
      expect(tiles[n].children.length).toBeGreaterThan(1);
    }
  });

  it('draws only the tiles within the distance of where you stand, and all of them with the distance at 0', () => {
    for (const n of NAMES) {
      const meshes = tiles[n].children;
      const t0 = meshes[Math.floor(meshes.length / 2)].userData.tile; // stand in the middle of one of its tiles
      const at = { x: (t0.minX + t0.maxX) / 2, z: (t0.minZ + t0.maxZ) / 2 };
      draw.update(at);
      const shown = meshes.filter((m) => m.visible).length;
      expect(shown, n).toBeGreaterThan(0);
      expect(shown, n).toBeLessThan(meshes.length);
      for (const m of meshes) {
        const t = m.userData.tile;
        if (distanceToTile(t, at.x, at.z) > params.roughDistance) expect(m.visible).toBe(false);
      }
    }
    params.roughDistance = 0;
    draw.update({ x: 0, z: 0 });
    for (const n of NAMES) expect(tiles[n].children.every((m) => m.visible)).toBe(true);
    params.roughDistance = DEFAULT_GRAPHICS_PARAMS.roughDistance;
  });
});
