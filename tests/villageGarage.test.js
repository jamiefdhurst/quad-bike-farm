import { describe, it, expect, vi } from 'vitest';
import * as THREE from 'three';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { villageShape, motBayRect, forecourtMarkings, villageMudBounds } from '../src/world/village.js';
import { roadNetwork } from '../src/world/roads.js';
import { SET_PIECE_NAMES } from '../src/world/farDetail.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { Track } from '../src/world/track.js';

// What the recheck of #688 found (#1031): the garage's canopy panels, the forecourt's markings, the new farm's mud grid and the bridge's cost.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const overlap = (a, b) => a.minX < b.maxX && a.maxX > b.minX && a.minZ < b.maxZ && a.maxZ > b.minZ;
const box = (m) => ({ minX: m.x - m.w / 2, maxX: m.x + m.w / 2, minZ: m.z - m.d / 2, maxZ: m.z + m.d / 2 });

describe('what is painted on the forecourt', () => {
  for (const [name, layout] of [['today\'s farm', LAYOUT], ['the new farm', two]]) {
    it(`has nothing in the MOT bay and every drain beyond the pumps, away from the garage, on ${name}`, () => {
      const g = villageShape(layout).garage;
      const bay = motBayRect(g);
      const marks = forecourtMarkings(layout.village.garage, layout.village.garage.pumps);
      expect(marks.lines.length).toBeGreaterThan(0);
      for (const m of [...marks.lines, ...marks.drains]) expect(overlap(box(m), bay), `${m.x} ${m.z}`).toBe(false);
      const away = Math.cos(g.yaw) > 0 ? 1 : -1;
      for (const d of marks.drains) expect((d.z - layout.village.garage.pumps.z) * away).toBeGreaterThan(3);
    });
  }
});

describe('the canopy\'s lit panels', () => {
  async function canopy() {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildVillage } = await import('../src/world/villageProps.js');
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    const built = buildVillage({ scene: new THREE.Scene(), layout: LAYOUT, heights, fixedBox: () => {}, random: () => 0.5, laneTexture: () => fakeCanvas() });
    return built.group;
  }

  it('are what you see looking up from under it, not the navy band\'s underside', async () => {
    const root = await canopy();
    root.updateMatrixWorld(true);
    const heights = createTerrainHeight(LAYOUT, new Track(LAYOUT.trackPoints));
    const { xs, z } = LAYOUT.village.garage.pumps;
    const meshes = [];
    root.traverse((o) => o.isMesh && meshes.push(o));
    const ray = new THREE.Raycaster();
    for (const [x, dz] of xs.flatMap((px) => [[px, 1.6], [px, -1.6]])) { // beside each pump, under one of the long strips (up from a pump itself hits its own head)
      ray.set(new THREE.Vector3(x, heights.heightAt(x, z + dz) + 1.5, z + dz), new THREE.Vector3(0, 1, 0));
      const hit = ray.intersectObjects(meshes, false)[0];
      expect(hit, `pump at ${x}`).toBeTruthy();
      expect(hit.object.material.emissive.getHex(), `pump at ${x}`).not.toBe(0); // a lit panel (the fascia and the roof are not)
    }
  });
});

describe('the new farm\'s village costs', () => {
  it('has the bridge named as a set piece, in a mesh a material', async () => {
    expect(SET_PIECE_NAMES).toContain('laneBridge');
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildBrookCulvert } = await import('../src/world/brookProps.js');
    const scene = new THREE.Scene();
    buildBrookCulvert({ layout: two, scene, heights: createTerrainHeight(two, new Track(two.trackPoints)), fixedBox: () => {}, random: () => 0.5 });
    const meshes = [];
    scene.getObjectByName('laneBridge').traverse((o) => o.isMesh && meshes.push(o));
    expect(meshes.length).toBeLessThanOrEqual(new Set(meshes.map((m) => m.material)).size);
  });
});

describe('the village\'s road mud grids', () => {
  const cells = (b) => Math.ceil((b.maxX - b.minX) / 0.5) * Math.ceil((b.maxZ - b.minZ) / 0.5);

  it('are a few tens of thousands of cells on the new farm, not the whole 325 by 226 m, and cover the street, the car park and the forecourt', () => {
    const bounds = villageMudBounds(two, roadNetwork(two), 0.85);
    expect(bounds).toHaveLength(3);
    expect(bounds.reduce((n, b) => n + cells(b), 0)).toBeLessThan(40000);
    const S = villageShape(two);
    const covered = (x, z) => bounds.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
    for (const p of S.road.filter((_, i) => i % 5 === 0)) expect(covered(p.x, p.z)).toBe(true);
    expect(covered(S.carPark.minX + 2, S.carPark.minZ + 2)).toBe(true);
    expect(covered(S.forecourt.minX + 2, S.forecourt.minZ + 2)).toBe(true);
  });

  it('are the village\'s area west of the lane, as they were, on today\'s farm', () => {
    const bounds = villageMudBounds(LAYOUT, roadNetwork(LAYOUT), 0.85);
    expect(bounds).toEqual([{ minX: LAYOUT.village.area.minX, maxX: LAYOUT.publicLane.x - LAYOUT.publicLane.halfWidth - 1, minZ: LAYOUT.village.area.minZ, maxZ: LAYOUT.village.area.maxZ }]);
  });
});
