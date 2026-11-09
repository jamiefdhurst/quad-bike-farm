import { describe, it, expect } from 'vitest';
import { GroundWear, DEFAULT_WEAR_PARAMS } from '../src/world/groundWear.js';
import { WearTiles, TILE_CELLS, SLOT } from '../src/world/wearTiles.js';

// Today's farm, then a ground of 1,420 by 1,040 m round it (the size the map is growing to).
const FARM = { minX: -150, maxX: 150, minZ: -200, maxZ: 250 };
const GROUND = { minX: -710, maxX: 710, minZ: -520, maxZ: 520 };
const make = (o = {}) => new WearTiles({ bounds: FARM, ground: GROUND, ...o });
const pass = (g, x, z, wet = 0, n = 1) => {
  for (let k = 0; k < n; k++) for (let w = 0; w < 4; w++) g.trample(x, z, 2, { wet });
};
const texel = (g, x, z, ch) => {
  // What the ground shader reads: the table finds the slot, then the atlas texel under (x, z).
  const tp = [(x - g.originX) / g.tileSize, (z - g.originZ) / g.tileSize];
  const ti = tp.map(Math.floor);
  const o = ((ti[1] * g.dimX + ti[0]) * 4); // a row for each z, a texel for each tile along x
  if (!g.index[o]) return 0;
  const sx = (g.index[o] - 1) * SLOT;
  const sy = (g.index[o + 1] - 1) * SLOT;
  const lx = Math.floor((tp[0] - ti[0]) * TILE_CELLS) + 2;
  const lz = Math.floor((tp[1] - ti[1]) * TILE_CELLS) + 2;
  return g.atlas[((sy + lz) * g.atlasSize + sx + lx) * 4 + ch];
};

describe('wear in tiles', () => {
  it('holds nothing until something has worn the ground, and gives it all back when it has grown over', () => {
    const g = make();
    expect(g.tiles.size).toBe(0);
    expect(g.wearAt(10, 10)).toBe(0);
    expect(g.stats().bytes).toBe(0);
    pass(g, 10, 10, 0, 3);
    expect(g.tiles.size).toBe(1);
    expect(g.wearAt(10, 10)).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) g.update(5, 0); // a long dry spell
    expect(g.wearAt(10, 10)).toBe(0);
    expect(g.tiles.size).toBe(1); // frost it thawed does not come back, so the tile stays
  });

  it('lets a tile go once it is clear and nothing was thawed', () => {
    const g = make({ params: { ...DEFAULT_WEAR_PARAMS, thawAt: 100 } }); // too much wear to thaw anything
    g.trample(10, 10, 0.2);
    expect(g.tiles.size).toBe(1);
    g.update(0.6, 0);
    for (let i = 0; i < 100; i++) g.update(10, 0);
    expect(g.tiles.size).toBe(0);
    expect(g.stats().slots).toBe(0);
  });

  it('wears, softens and bogs as a plain GroundWear does at the same spot', () => {
    const tiles = make();
    const plain = new GroundWear({ half: 400 });
    for (const [x, z] of [[20, -10], [31.9, 63.9], [64.2, 64.1], [-0.3, 0.2]]) {
      pass(tiles, x, z, 0.6, 30);
      pass(plain, x, z, 0.6, 30);
      for (const [px, pz] of [[x, z], [x + 1.3, z - 0.7], [x - 2.9, z + 3.1]]) {
        expect(tiles.wearAt(px, pz)).toBeCloseTo(plain.wearAt(px, pz), 5);
        expect(tiles.softAt(px, pz)).toBeCloseTo(plain.softAt(px, pz), 5);
        expect(tiles.bogAt(px, pz, 0.6)).toBeCloseTo(plain.bogAt(px, pz, 0.6), 5);
      }
    }
  });

  it('reads the same either side of a tile edge, and a track across it is one track', () => {
    const g = make();
    const edge = g.minX + 2 * g.tileSize; // a line between two tiles
    for (let z = -20; z < 20; z += 0.5) g.trample(edge - 6 + z * 0.3, z, 0.5);
    for (let x = edge - 6; x < edge + 6; x += 0.25) {
      expect(g.wearAt(x, 0)).toBeCloseTo(g.wearAt(x + 1e-9, 0), 6);
    }
    // A spot on the edge itself is worn from both sides' points.
    const one = make();
    one.trample(edge, 4, 2);
    const plain = new GroundWear({ half: 400 });
    plain.trample(edge, 4, 2);
    expect(one.tiles.size).toBe(2);
    for (const dx of [-2.5, -1, -0.01, 0, 0.01, 1, 2.5]) expect(one.wearAt(edge + dx, 4)).toBeCloseTo(plain.wearAt(edge + dx, 4), 5);
  });

  it('wears a patch at the far corner of a 1.4 km ground, coarsely, and the shader can see it', () => {
    const g = make();
    const x = GROUND.maxX - 20;
    const z = GROUND.maxZ - 20;
    pass(g, x, z, 0.5, 40);
    expect(g.wearAt(x, z)).toBeGreaterThan(0.9);
    expect(g.softAt(x, z)).toBeGreaterThan(0.9);
    expect(g.bogAt(x, z, 0.6)).toBeGreaterThan(0.9);
    expect(g.wearAt(x - 60, z)).toBe(0);
    expect(g.stats().far).toBe(g.tiles.size);
    expect(g.hazards(0.6).some((h) => Math.hypot(h.x - x, h.z - z) < 10)).toBe(true);
    g.update(0.6, 0.6);
    expect(g.packed).toBe(true);
    expect(texel(g, x, z, 0)).toBeGreaterThan(200); // soft
    expect(texel(g, x, z, 1)).toBeGreaterThan(150); // bog
    expect(texel(g, x - 60, z, 0)).toBe(0);
    // It is coarse: the 8 m grid spreads it over a wider patch than the fine grid would.
    expect(g.wearAt(x + 6, z)).toBeGreaterThan(0.1);
  });

  it('thaws frost under tyres anywhere on the ground, and not elsewhere', () => {
    const g = make();
    for (const [x, z] of [[5, 5], [GROUND.minX + 15, GROUND.minZ + 15], [GROUND.maxX - 30, GROUND.minZ + 40]]) {
      g.trample(x, z, 3);
      g.update(0.6, 0);
      expect(g.thawAt(x, z)).toBeGreaterThan(0.8);
      expect(texel(g, x, z, 2)).toBeGreaterThan(200);
      expect(g.thawAt(x + 50, z + 50)).toBe(0);
    }
  });

  it('never wears the ground that is exempt, or off the tiles', () => {
    const g = make({ exempt: (x) => x > 100 });
    pass(g, 120, 0);
    pass(g, GROUND.maxX + 50, 0);
    pass(g, 0, GROUND.minZ - 50);
    expect(g.tiles.size).toBe(0);
  });

  it('runs the green lane as GroundWear does: faster to wear, slower to recover, set and averaged by the panel', () => {
    const lane = (x) => (Math.abs(x - 40) < 3 ? 1 : 0);
    const g = make({ lane });
    expect(g.laneMean()).toBe(0);
    expect(g.laneAt(40, 7)).toBe(1);
    expect(g.laneAt(100, 7)).toBe(0);
    g.setLane(1);
    expect(g.laneMean()).toBeCloseTo(1, 5);
    expect(g.wearAt(40, 100)).toBeCloseTo(1, 5);
    g.setLane(0);
    for (let i = 0; i < 5; i++) g.update(1, 0);
    expect(g.laneMean()).toBe(0);
    expect(g.tiles.size).toBeLessThanOrEqual(g.stats().tiles);
    const slow = make({ lane });
    const field = make({ lane });
    pass(slow, 40, 10, 0, 8);
    pass(field, 60, 10, 0, 8);
    expect(slow.wearAt(40, 10)).toBeCloseTo(field.wearAt(60, 10) * DEFAULT_WEAR_PARAMS.laneWear, 4);
  });

  it('keeps the lane in a save and brings back a share of it; an old save of the lane still loads', () => {
    const lane = (x) => (Math.abs(x - 40) < 3 ? 1 : 0);
    const a = make({ lane });
    a.setLane(0.6);
    pass(a, -90, 20, 0, 20); // a field, which the lane-only save leaves out
    const saved = JSON.parse(JSON.stringify(a.toJSON({ lane: true })));
    const b = make({ lane });
    b.fromJSON(saved, 0.5);
    expect(b.laneMean()).toBeCloseTo(0.3, 2);
    expect(b.wearAt(-90, 20)).toBe(0);
    const c = make({ lane });
    c.fromJSON(JSON.parse(JSON.stringify(a.toJSON())), 1);
    expect(c.wearAt(-90, 20)).toBeCloseTo(a.wearAt(-90, 20), 2);
    // Index i = ix * nz + iz on the fine lattice, as the save kept it before the tiles.
    const ix = Math.floor((40 - a.minX) / a.cell);
    const iz = Math.floor((100 - a.minZ) / a.cell);
    const old = make({ lane });
    old.fromJSON([ix * a.nz + iz, 255, 5, 255, 'x', 1], 1);
    expect(old.wearAt(a.minX + (ix + 0.5) * a.cell, a.minZ + (iz + 0.5) * a.cell)).toBeCloseTo(1, 5);
    expect(old.tiles.size).toBeGreaterThan(0);
  });

  it('ignores a save that is not tiles', () => {
    const g = make();
    g.fromJSON(null);
    g.fromJSON({ tiles: 'no' });
    g.fromJSON({ tiles: [[0, 0], [1.5, 2, 3, 4], ['a', 'b', 1, 2], [9999, 9999, 0, 255], [0, 0, -4, 255], [0, 0, 1e9, 255], [0, 0, 5, NaN]] });
    g.fromJSON('x');
    expect(g.tiles.size).toBe(0);
  });

  it('saves a day of riding all over a 1.4 km ground in under 200 KB', () => {
    const g = make();
    // Four quads for twelve hours of game day (an hour of play), on roads of their own choosing: random legs at 10 m/s over the whole ground,
    // in the wet half the time, wear recovering as it goes. Every second of it is four wheels each.
    let seed = 7;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const quads = Array.from({ length: 4 }, () => ({ x: (rnd() - 0.5) * 1300, z: (rnd() - 0.5) * 900, a: rnd() * 6.28 }));
    for (let t = 0; t < 3600; t++) {
      const wet = t % 1800 < 900 ? 0.8 : 0;
      for (const q of quads) {
        if (rnd() < 0.05) q.a += (rnd() - 0.5) * 2;
        q.x = Math.max(GROUND.minX + 5, Math.min(GROUND.maxX - 5, q.x + Math.cos(q.a) * 10));
        q.z = Math.max(GROUND.minZ + 5, Math.min(GROUND.maxZ - 5, q.z + Math.sin(q.a) * 10));
        for (let w = 0; w < 4; w++) g.trample(q.x + (w % 2) * 1.1, q.z + (w >> 1) * 1.2, 10, { wet });
      }
      if (t % 5 === 4) g.update(5, wet);
    }
    const bytes = JSON.stringify(g.toJSON()).length;
    expect(g.tiles.size).toBeGreaterThan(20);
    expect(bytes).toBeLessThan(200 * 1024);
    expect(g.stats().slots).toBeLessThanOrEqual(g.slotCount);
    expect(g.slotCount).toBeGreaterThanOrEqual(g.dimX * g.dimZ); // every tile of this ground can be drawn
  });
});
