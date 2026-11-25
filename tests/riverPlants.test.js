import { describe, it, expect, beforeAll, vi } from 'vitest';
import * as THREE from 'three';
import { LAYOUT } from '../src/world/layout.js';
import { pointInPolygon } from '../src/world/polygons.js';
import { riversidePlaces, RIVERSIDE_COUNTS } from '../src/world/riverPlaces.js';
import { ATLAS, drawPlantAtlas, reedModel, rushModel, sedgeModel, tussockModel, thistleModel, dockModel, cowpatModel } from '../src/world/riverPlants.js';
import { frondGeometry } from '../src/world/hillProps.js';
import { seeded } from '../src/world/propStreams.js';
import { fakeCanvas } from './helpers/vehicleModels.js';
import { headlessContext } from './helpers/worldModels.js';

// The wet edges' and the meadow's plants (#999): the reed is a model with its own texture, richer than the pond's fronds, and Brook Meadow has tussocks,
// thistles, docks and cowpats, drawn through `tiledInstances`.

const size = (geo) => {
  geo.computeBoundingBox();
  return geo.boundingBox.getSize(new THREE.Vector3());
};
const tris = (geo) => (geo.index ? geo.index.count : geo.attributes.position.count) / 3;
/** The share of a model's vertices whose u falls in atlas column `col`. */
const inColumn = (geo, col) => {
  const uv = geo.attributes.uv;
  let n = 0;
  for (let i = 0; i < uv.count; i++) if (uv.getX(i) >= ATLAS[col][0] && uv.getX(i) <= ATLAS[col][1]) n++;
  return n / uv.count;
};

describe('the reed (#999)', () => {
  const reed = reedModel(seeded(5), { height: 1.9, blades: 16, seeds: 0.6, dead: 3 });
  const pond = frondGeometry(seeded(5), 6, 1.3, 0.035, 0.12); // the pond's reeds (hillProps.js `buildPond`)

  it('is textured from its own atlas: its blades on the blade column, its plumes on the plume column', () => {
    expect(reed.attributes.uv).toBeDefined();
    expect(inColumn(reed, 'blade')).toBeGreaterThan(0.5);
    expect(inColumn(reed, 'plume')).toBeGreaterThan(0.05);
    expect(pond.attributes.uv).toBeUndefined(); // the pond's are plain colour
  });

  it('is a reed\'s size: its blades and plumes up to about 2 m, a clump a third of a metre across at its foot', () => {
    const s = size(reed);
    expect(s.y).toBeGreaterThan(1.5);
    expect(s.y).toBeLessThan(2.6);
    expect(Math.max(s.x, s.z)).toBeLessThan(2.2);
  });

  it('has more to it than the pond\'s reeds: more blades and leaves, plumes and dead stalks', () => {
    expect(tris(reed)).toBeGreaterThan(tris(pond) * 2);
  });

  it('draws its atlas: every column painted, the plume and the leaves cut out round their shapes', () => {
    const calls = [];
    const g = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(k); return k === 'createLinearGradient' ? { addColorStop() {} } : undefined; }), set: (t, k, v) => ((t[k] = v), true) });
    drawPlantAtlas(g, 256, 256);
    expect(calls.filter((c) => c === 'fillRect').length).toBeGreaterThan(400);
    expect(calls).toContain('ellipse');
  });
});

describe('the wet edges\' and the meadow\'s other plants (#999)', () => {
  const r = seeded(9);
  const cases = [
    ['rush', rushModel(r), [0.6, 1.3]],
    ['sedge', sedgeModel(r), [0.4, 1.2]],
    ['tussock', tussockModel(r), [0.25, 0.7]],
    ['thistle', thistleModel(r), [0.7, 1.3]],
    ['dock', dockModel(r), [0.6, 1.4]],
    ['cowpat', cowpatModel(r), [0.02, 0.08]],
  ];
  it.each(cases)('builds a %s its real height, textured or coloured', (name, geo, [lo, hi]) => {
    const s = size(geo);
    expect(s.y).toBeGreaterThan(lo);
    expect(s.y).toBeLessThan(hi);
    expect(geo.attributes.uv.count).toBe(geo.attributes.position.count);
    expect(geo.attributes.color.count).toBe(geo.attributes.position.count);
  });
});

describe('Brook Meadow\'s grazing (#999)', () => {
  let c;
  let places;
  beforeAll(async () => {
    vi.stubGlobal('document', { createElement: () => fakeCanvas() });
    const { buildRiverside } = await import('../src/world/riverProps.js');
    c = { ...headlessContext(), drawDistance: { add: (g) => g } };
    places = riversidePlaces(LAYOUT, c.heights.brook);
    buildRiverside(c);
  });

  it('has tussocks, thistles, docks and cowpats in Brook Meadow, none in the water', () => {
    const poly = LAYOUT.hill.riverside.points;
    for (const key of ['tussocks', 'thistles', 'docks', 'dung']) {
      expect(places[key].length, key).toBeGreaterThan(RIVERSIDE_COUNTS[key] * 0.8);
      for (const p of places[key]) {
        expect(pointInPolygon(poly, p.x, p.z), key).toBe(true);
        expect(c.heights.brook.waterAt(p.x, p.z), key).toBe(0);
      }
    }
  });

  it('draws each of them through `tiledInstances`: a group of instanced tiles, each with its tile\'s bounds', () => {
    for (const name of ['meadowTussocks', 'thistles', 'docks', 'cowpats', 'rushes', 'sedge', 'reeds-tall', 'crossingStones']) {
      const group = c.scene.children.find((o) => o.name === name);
      expect(group, name).toBeDefined();
      expect(group.children.length, name).toBeGreaterThan(0);
      for (const tile of group.children) {
        expect(tile.isInstancedMesh, name).toBe(true);
        expect(tile.userData.tile, name).toBeDefined();
      }
    }
  });

  it('builds the brook\'s stock fence as a set piece of its own', () => {
    const fence = c.scene.children.find((o) => o.name === 'brookFence');
    expect(fence).toBeDefined();
    expect(fence.userData.count.posts).toBeGreaterThan(50);
    expect(fence.userData.count.spans).toBeGreaterThan(60);
  });
});
