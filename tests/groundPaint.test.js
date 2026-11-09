import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { roadNetwork } from '../src/world/roads.js';
import { createFields } from '../src/world/fields.js';
import { tarmacMask } from '../src/world/roadWet.js';
import { PaintSet, PAINT_PAD, PAINT_PX, paintWindow, overviewScale } from '../src/world/groundPaint.js';
import { cutTiles, groundBounds, DEFAULT_GROUND_PARAMS } from '../src/world/groundTiles.js';

// The ground #681 grows the map to, not centred on the origin.
const BIG = { ...LAYOUT, ground: { minX: -590, maxX: 830, minZ: -435, maxZ: 605 } };

const clock = () => {
  const c = { t: 0, now: () => c.t };
  return c;
};

/** A paint set over a 4 by 4 grid of tiles (64 m), whose jobs take `slices` steps of `ms` each and whose hand-over takes `finishMs`. */
function setup({ slices = 3, ms = 1, finishMs = 0, params = {} } = {}) {
  const { tiles } = cutTiles({ minX: 0, maxX: 256, minZ: 0, maxZ: 256 });
  const c = clock();
  const log = { begun: [], finished: [], dropped: [] };
  const set = new PaintSet(tiles, { ...DEFAULT_GROUND_PARAMS, paintNear: 100, hysteresis: 0.25, ...params }, {
    now: c.now,
    begin(tile) {
      log.begun.push(tile.id);
      let n = 0;
      return { step: () => ((c.t += ms), ++n >= slices) };
    },
    finish(tile) {
      c.t += finishMs;
      log.finished.push(tile.id);
    },
    drop(tile) {
      log.dropped.push(tile.id);
    },
  });
  return { set, tiles, c, log };
}

describe('painting the ground a tile at a time', () => {
  it('paints the tile you are on first, then the nearest, and not those beyond paintNear', () => {
    const { set, tiles, log } = setup({ params: { paintMs: 1000 } });
    for (let i = 0; i < 40; i++) set.update(32, 32);
    expect(log.finished[0]).toBe(tiles.find((t) => t.tx === 0 && t.tz === 0).id);
    // Within 100 m of (32, 32): tiles whose nearest point is that close.
    const near = tiles.filter((t) => Math.hypot(Math.max(t.minX - 32, 0, 32 - t.maxX), Math.max(t.minZ - 32, 0, 32 - t.maxZ)) <= 100);
    expect(new Set(log.finished)).toEqual(new Set(near.map((t) => t.id)));
    expect(log.finished.length).toBe(near.length);
    expect(near.length).toBeLessThan(tiles.length);
  });

  it('spends no more than its budget a frame on slices, and finishes at most one tile a frame', () => {
    const { set, c, log } = setup({ slices: 10, ms: 1, params: { paintMs: 3 } });
    const frames = [];
    for (let f = 0; f < 6; f++) {
      const t0 = c.t;
      const before = log.finished.length;
      set.update(32, 32);
      frames.push([c.t - t0, log.finished.length - before]);
    }
    // 10 one-millisecond steps a tile, 3 ms a frame: a tile takes four frames, none costs more than the budget.
    expect(frames.every(([ms]) => ms <= 3)).toBe(true);
    expect(frames.map(([, n]) => n)).toEqual([0, 0, 0, 1, 0, 0]);
  });

  it('never starts the hand-over once the budget is spent, so a slow upload lands in a frame of its own', () => {
    const { set, c } = setup({ slices: 1, ms: 5, finishMs: 4, params: { paintMs: 3 } });
    set.update(32, 32); // the one step takes 5 ms, over the budget: it is done and handed over in this frame
    expect(set.stats().paints).toBe(1);
    const t0 = c.t;
    set.update(32, 32);
    expect(c.t - t0).toBe(9); // the next tile's step (5) and its hand-over (4) in one frame, never two hand-overs
    expect(set.stats().paints).toBe(2);
  });

  it('lets go of tiles once you are paintNear plus the hysteresis away, not before', () => {
    const { set, tiles, log } = setup({ params: { paintMs: 1000, paintNear: 100, hysteresis: 0.25 } });
    for (let i = 0; i < 40; i++) set.update(32, 32);
    const first = tiles.find((t) => t.tx === 0 && t.tz === 0);
    // The tile's edge is 110 m away: past 100, within 125.
    set.update(64 + 110, 32);
    expect(log.dropped).not.toContain(first.id);
    set.update(64 + 200, 32);
    expect(log.dropped).toContain(first.id);
    expect(set.painted.has(first.id)).toBe(false);
  });

  it('paints every tile within the prime radius at once, and the same again only after it is let go', () => {
    const { set, log } = setup({ params: { paintPrime: 70, paintNear: 100 } });
    const n = set.prime(32, 32);
    expect(n).toBeGreaterThan(0);
    expect(log.finished.length).toBe(n);
    expect(set.prime(32, 32)).toBe(0);
  });

  it('gives each tile a window of its own that reaches PAINT_PAD beyond it, whole pixels at PAINT_PX a metre', () => {
    const { tiles } = cutTiles(groundBounds(BIG));
    for (const t of tiles) {
      const w = paintWindow(t);
      expect(t.minX - w.minX).toBeCloseTo(PAINT_PAD);
      expect(w.maxZ - t.maxZ).toBeCloseTo(PAINT_PAD);
      expect(Number.isInteger(Math.round((w.maxX - w.minX) * PAINT_PX * 1e6) / 1e6)).toBe(true);
    }
  });

  it('paints the overview at about a pixel a metre, less on a ground too wide for a canvas', () => {
    expect(overviewScale({ minX: -210, maxX: 210, minZ: -210, maxZ: 210 })).toBe(1);
    expect(overviewScale(groundBounds(BIG))).toBe(1);
    expect(overviewScale({ minX: 0, maxX: 8192, minZ: 0, maxZ: 100 })).toBe(0.5);
  });
});

describe('the tarmac map on a full-size ground', () => {
  // A winding road of about 3 km across #681's ground, added to the farm's own.
  const points = Array.from({ length: 41 }, (_, i) => {
    const x = -560 + i * 33;
    return [x, 120 + 300 * Math.sin(x / 80)];
  });
  const layout = { ...BIG, roads: [...LAYOUT.roads, { id: 'back', name: 'Back Lane', surface: 'tarmac', halfWidth: 3, pavement: 0, points, markings: { centre: 'none' }, verge: 1, hedged: false, draw: 'mesh' }] };
  const net = roadNetwork(layout);
  const length = net.road('back').length;

  it('is a road of about 3 km', () => {
    expect(length).toBeGreaterThan(2800);
    expect(length).toBeLessThan(3600);
  });

  it('asks tarmacAt fewer than a million times for the whole ground, the tiles\' maps and the overview\'s, where a map of it all is 6 million', () => {
    let asked = 0;
    const tarmacAt = (x, z) => (asked++, net.tarmacAt(x, z));
    const boxes = net.hardBoxes('tarmac');
    const bounds = groundBounds(layout);
    const { tiles } = cutTiles(bounds);
    for (const t of tiles) tarmacMask(tarmacAt, paintWindow(t), 0.5, boxes);
    tarmacMask(tarmacAt, bounds, 2, boxes);
    const dense = ((bounds.maxX - bounds.minX) / 0.5) * ((bounds.maxZ - bounds.minZ) / 0.5);
    expect(dense).toBeGreaterThan(5.9e6);
    expect(asked).toBeLessThan(1e6);
    expect(asked).toBeGreaterThan(50000);
  });

  it('still marks every bit of road, where the tiles and the overview are asked', () => {
    const boxes = net.hardBoxes('tarmac');
    const bounds = groundBounds(layout);
    const { tiles } = cutTiles(bounds);
    const masks = new Map();
    const maskOf = (t) => (masks.has(t.id) ? masks.get(t.id) : (masks.set(t.id, tarmacMask(net.tarmacAt, paintWindow(t), 0.5, boxes)), masks.get(t.id)));
    const overview = tarmacMask(net.tarmacAt, bounds, 2, boxes);
    const road = net.road('back');
    for (let s = 0; s < road.length; s += 7) {
      const p = net.pointAt('back', s);
      for (const off of [-2.5, 0, 2.5]) {
        const x = p.x - p.tz * off;
        const z = p.z + p.tx * off;
        if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) continue;
        const want = net.tarmacAt(x, z);
        if (want < 0.5) continue;
        const t = tiles.find((q) => x >= q.minX && x < q.maxX && z >= q.minZ && z < q.maxZ);
        const m = maskOf(t);
        expect(m, `no map for the tile at ${x}, ${z}`).not.toBeNull();
        const at = (mk) => mk.data[Math.floor((z - mk.minZ) / mk.cell) * mk.nx + Math.floor((x - mk.minX) / mk.cell)];
        expect(at(m)).toBeGreaterThan(100);
        if (Math.abs(off) < 2) expect(at(overview)).toBeGreaterThan(100); // two metres a texel, so not right at the edge
      }
    }
  });

  it('gives a tile with no road near it no map at all', () => {
    const boxes = net.hardBoxes('tarmac');
    const far = { minX: 700, maxX: 760, minZ: 500, maxZ: 560 };
    expect(tarmacMask(net.tarmacAt, far, 0.5, boxes)).toBeNull();
  });

  it('is the same fields\' own boxes on today\'s farm: the farm road, the lane and the village are inside them', () => {
    const fields = createFields(LAYOUT);
    const boxes = fields.tarmacBoxes();
    const inBox = (x, z) => boxes.some((b) => x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ);
    let found = 0;
    for (let x = -210; x < 210; x += 1) {
      for (let z = -210; z < 210; z += 1) {
        if (fields.tarmacAt(x, z) > 0) {
          found++;
          if (!inBox(x, z)) throw new Error(`tarmac at ${x}, ${z} is outside every box`);
        }
      }
    }
    expect(found).toBeGreaterThan(500);
  });
});
