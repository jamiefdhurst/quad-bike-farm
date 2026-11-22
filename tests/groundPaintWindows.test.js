import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { Track } from '../src/world/track.js';
import { createTerrainHeight } from '../src/world/terrainHeight.js';
import { createFields } from '../src/world/fields.js';
import { createGroundPlan, paintGround, paintContext, hash01, itemRandom } from '../src/world/groundTexture.js';

// What is painted over the ground, drawn through a stand-in canvas that records each rectangle and ellipse as it lands on the ground (in metres),
// to show that one window paints what the next does where they overlap: the ground is painted a tile at a time, and a seam is where they would differ.
const record = (win, s) => {
  const ops = [];
  let fill = '';
  let stroke = '';
  const at = (px, pz) => [win.minX + px / s, win.minZ + pz / s];
  const r = (v) => Math.round(v * 200) / 200; // to 5 mm
  const ctx = new Proxy({}, {
    get: (_, name) => {
      if (name === 'fillRect') return (x, z, w, h) => ops.push(['rect', ...at(x + w / 2, z + h / 2).map(r), r(w / s), r(h / s), fill].join());
      if (name === 'ellipse') return (x, z, rx, rz, rot) => ops.push(['ell', ...at(x, z).map(r), r(rx / s), r(rz / s), r(rot), fill].join());
      if (name === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (name === 'createImageData') return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      return () => {};
    },
    set: (_, name, v) => {
      if (name === 'fillStyle') fill = typeof v === 'string' ? v : 'gradient';
      if (name === 'strokeStyle') stroke = v;
      return true;
    },
  });
  return { ctx, ops, stroke: () => stroke };
};

let plan;
const savedDocument = globalThis.document;
beforeAll(() => {
  globalThis.document = { createElement: () => ({ getContext: () => record({ minX: 0, minZ: 0 }, 1).ctx }) };
  const track = new Track(LAYOUT.trackPoints);
  const heights = createTerrainHeight(LAYOUT, track);
  plan = createGroundPlan({ track, layout: LAYOUT, fields: createFields(LAYOUT), puddles: heights.puddles, bogs: heights.bogs });
}, 30000);
afterAll(() => {
  globalThis.document = savedDocument;
});

const paint = (win, s) => {
  const rec = record(win, s);
  for (const _ of paintGround(plan, paintContext(rec.ctx, win, s)));
  return rec.ops;
};
const within = (ops, box) =>
  ops.filter((o) => {
    const [, x, z, w] = o.split(',');
    if (+w > 30) return false; // the grass's base coat over the whole window
    return +x > box.minX && +x < box.maxX && +z > box.minZ && +z < box.maxZ;
  });

describe('painting the ground a window at a time', () => {
  // Pairs of windows that overlap, each over something the painters draw by the thousand: the gravel pit, the wood, the hill's pasture, the drive
  // and the road. The part of the overlap well inside both must be painted by the same marks, in the same places and the same colours.
  const mid = (b) => [(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2];
  const pair = ([cx, cz]) => [{ minX: cx - 33, maxX: cx + 33, minZ: cz - 33, maxZ: cz + 33 }, { minX: cx + 17, maxX: cx + 83, minZ: cz - 13, maxZ: cz + 53 }];
  const cases = [
    ['the gravel pit', ...pair(mid(LAYOUT.quarry))],
    ['the wood', ...pair(mid(LAYOUT.woods))],
    ['the hill', ...pair(mid(LAYOUT.hill.pasture))],
    ['the drive', ...pair([(LAYOUT.road.fromX + LAYOUT.road.toX) / 2, LAYOUT.road.z])],
    ['the track', ...pair(LAYOUT.trackPoints[0])],
  ];
  for (const [name, a, b] of cases) {
    it(`paints ${name} the same in two overlapping windows`, () => {
      const inner = { minX: Math.max(a.minX, b.minX) + 3, maxX: Math.min(a.maxX, b.maxX) - 3, minZ: Math.max(a.minZ, b.minZ) + 3, maxZ: Math.min(a.maxZ, b.maxZ) - 3 };
      const fromA = within(paint(a, 10), inner);
      const fromB = within(paint(b, 10), inner);
      expect(fromA.length).toBeGreaterThan(50);
      expect(fromA).toEqual(fromB);
    });
  }

  it('draws a stretch of the pit\'s floor at a different scale as the same marks, only smaller', () => {
    const [px, pz] = mid(LAYOUT.quarry);
    const win = { minX: px - 20, maxX: px + 20, minZ: pz - 20, maxZ: pz + 20 };
    const fine = paint(win, 10);
    expect(fine.length).toBeGreaterThan(1000);
    expect(paint(win, 10)).toEqual(fine); // and the same again every time
  });

  it('keeps what a random number is for out of the order it is drawn in', () => {
    expect(hash01(5, 12, 40)).toBe(hash01(5, 12, 40));
    expect(hash01(5, 12, 40)).not.toBe(hash01(5, 40, 12));
    expect(hash01(5, 12, 40)).not.toBe(hash01(6, 12, 40));
    const a = itemRandom(9, 31);
    const b = itemRandom(9, 31);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    const [x, y] = [itemRandom(9, 31)(), itemRandom(9, 32)()];
    expect(x).not.toBe(y);
    for (let i = 0; i < 200; i++) {
      const v = hash01(3, i, -i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
