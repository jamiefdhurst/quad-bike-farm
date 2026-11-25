import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createFields } from '../src/world/fields.js';
import { createRiver } from '../src/world/river.js';
import { riversidePlaces } from '../src/world/riverPlaces.js';
import { Track } from '../src/world/track.js';
import { farmMapFeatures } from '../src/hud/farmMap.js';
import { createHost } from '../src/console/gameHost.js';

// The river's crossing on the new farm (#999): one anchor (brook.js `crossing`), its x `layout.hill.river.crossing.x`, that everything at the crossing
// stands from, and the crossing itself: gravel up both landings, ruts, loose stones and a muddy landing either side.

const track = new Track(LAYOUT.trackPoints);
const heights = createTerrainHeight(LAYOUT, track);
const brook = heights.brook;
const fields = createFields(LAYOUT);
const river = createRiver(LAYOUT, brook);
const anchor = brook.crossing();

/** `tp me to river` as the console works it out, from a stand-in game with the real layout's hill and the real brook. */
function tpRiver() {
  const square = (x, z) => [[x, z], [x + 40, z], [x + 40, z + 40], [x, z + 40]];
  const fs = [{ name: 'top', kind: 'arable', points: square(0, -200) }];
  const layout = { spawn: { player: { x: 1, z: 2 } }, woods: { gate: { x: 10, z: 11 }, leadIn: [[0, 0], [0, 30]], circuit: { points: [[12, 13]] } }, fields: fs, hill: LAYOUT.hill };
  const g = {
    units: [],
    companions: [],
    world: { heightAt: () => 0, layout, heights: { brook }, fields: { polygons: { top: fs[0].points } } },
    trafficHost: { places: { rig: { stand: { x: 0, z: 0 } } } },
    villageHost: {},
  };
  return createHost(g).places().river;
}

describe('the crossing\'s one anchor (#999)', () => {
  it('is the layout\'s crossing x, on the river\'s line', () => {
    expect(anchor.x).toBe(LAYOUT.hill.river.crossing.x);
    expect(anchor.z).toBeCloseTo(brook.zAt(anchor.x), 6);
  });

  it('is the one x the river\'s places, the map, `tp me to river` and the frame budget\'s spot agree on', () => {
    const map = farmMapFeatures(LAYOUT, fields, track).labels.find((l) => l.text === 'River crossing');
    const xs = { river: river.places().crossing.x, map: map.x, tp: tpRiver().x, budget: LAYOUT.budgetSpots.river.x, posts: river.posts().reduce((s, p) => s + p.x, 0) / river.posts().length };
    for (const [who, x] of Object.entries(xs)) expect(x, who).toBeCloseTo(anchor.x, 6);
  });

  it('puts the map\'s label and `tp me to river` on the south landing and the budget\'s spot on the north, out of the water', () => {
    const map = farmMapFeatures(LAYOUT, fields, track).labels.find((l) => l.text === 'River crossing');
    expect(map.z).toBeGreaterThan(anchor.z + anchor.half);
    expect(tpRiver().z).toBeGreaterThan(anchor.z + anchor.half);
    expect(LAYOUT.budgetSpots.river.z).toBeLessThan(anchor.z - anchor.half);
    for (const p of [map, tpRiver(), LAYOUT.budgetSpots.river]) expect(brook.waterAt(p.x, p.z)).toBe(0);
  });
});

describe('the crossing (#999)', () => {
  const places = riversidePlaces(LAYOUT, brook);
  const reach = LAYOUT.hill.river.banks.landing;
  const surface = heights.heightAt(anchor.x, anchor.z) + brook.waterDepthAt(anchor.x);

  it('cuts both banks down to a landing a quad rides up: no step over 0.25 m in half a metre from field to field', () => {
    for (const dx of [-3, 0, 3]) {
      const x = anchor.x + dx;
      let last = null;
      for (let z = brook.zAt(x) - brook.halfAt(x) - reach; z <= brook.zAt(x) + brook.halfAt(x) + reach; z += 0.5) {
        const h = heights.heightAt(x, z);
        if (last !== null) expect(Math.abs(h - last), `${x}, ${z}`).toBeLessThan(0.25);
        last = h;
      }
    }
  });

  it('comes out of the water at its edge just above it, where the cut bank of the bend beside it stands 0.6 m and more', () => {
    const edge = (x, side) => heights.heightAt(x, brook.zAt(x) + side * (brook.halfAt(x) + 0.5)) - (heights.heightAt(x, brook.zAt(x)) + brook.waterDepthAt(x));
    for (const side of [-1, 1]) expect(edge(anchor.x, side)).toBeLessThan(0.35);
    const bend = brook.bends().find((b) => b.x > anchor.x);
    expect(edge(bend.x, bend.out)).toBeGreaterThan(0.6);
  });

  it('has a muddy landing drawn on both banks (`mudAt`, which the ground paints)', () => {
    for (const side of [-1, 1]) expect(brook.mudAt(anchor.x, anchor.z + side * (anchor.half + 1.5))).toBeGreaterThan(0.5);
    expect(brook.mudAt(anchor.x + 20, anchor.z)).toBe(0);
  });

  it('has two ruts a quad\'s width apart, through the water and up both landings to the field', () => {
    expect(places.ruts).toHaveLength(2);
    const [a, b] = places.ruts;
    expect(Math.abs(a.x - b.x)).toBeGreaterThan(0.9);
    expect(Math.abs(a.x - b.x)).toBeLessThan(1.4);
    for (const r of places.ruts) {
      expect(Math.abs(r.x - anchor.x)).toBeLessThan(anchor.reach);
      expect(r.from).toBeLessThan(anchor.z - anchor.half - reach + 0.5);
      expect(r.to).toBeGreaterThan(anchor.z + anchor.half + reach - 0.5);
    }
  });

  it('has loose stones on its bed and its landings, some in the water and some out', () => {
    expect(places.stones.length).toBeGreaterThan(60);
    for (const s of places.stones) expect(Math.abs(s.x - anchor.x)).toBeLessThan(anchor.reach);
    expect(places.stones.some((s) => s.water)).toBe(true);
    expect(places.stones.some((s) => !s.water)).toBe(true);
  });

  it('is still a wade: the water over it stands under what an engine takes in, the surface level across', () => {
    expect(brook.waterDepthAt(anchor.x)).toBeCloseTo(LAYOUT.hill.river.crossing.water, 2);
    expect(surface).toBeLessThan(heights.heightAt(anchor.x, anchor.z - anchor.half - reach));
  });
});
