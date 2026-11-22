import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { createFields } from '../src/world/fields.js';
import { scatterStubble, stubbleShares } from '../src/world/stubbleScatter.js';
import { pointInPolygon, polygonArea, polygonBounds } from '../src/world/polygons.js';

// Stubble stands in each field's own outline, not the box round it (#813).
const two = LAYOUT;
const fields = createFields(two);

const seeded = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

/** The clumps a field gets, as props.js asks for them. */
function clumps(key, count, layout = two, f = fields) {
  const pts = [];
  const spec = layout.stubbleFields[key];
  scatterStubble({
    polygon: f.polygons[key],
    alongX: spec.rows !== 'z',
    count,
    random: seeded(key.length * 7 + count),
    accept: (x, z) => f.stubbleAt(x, z) >= 0.99 && f.hedgeDistance(x, z) >= 1.5,
    make: (x, z) => pts.push([x, z]),
  });
  return pts;
}

describe('stubble in a field\'s polygon', () => {
  it('has fields that are not their boxes, or the check below proves nothing', () => {
    const slanted = fields.stubbleFields.filter((k) => {
      const b = fields.areas[k];
      return (b.maxX - b.minX) * (b.maxZ - b.minZ) > polygonArea(fields.polygons[k]) * 1.02;
    });
    expect(slanted.length).toBeGreaterThanOrEqual(4);
  });
  for (const key of ['north', 'top', 'lanefield', 'longpiece', 'far', 'south']) {
    it(`keeps every clump in ${key}'s polygon, in the field's rows, and still fills it`, () => {
      const pts = clumps(key, 4000);
      expect(pts.length).toBeGreaterThan(3600);
      for (const [x, z] of pts) {
        expect(pointInPolygon(fields.polygons[key], x, z), `${key} ${x.toFixed(1)}, ${z.toFixed(1)}`).toBe(true);
        expect(fields.areaOf(x, z)).toBe(key);
      }
      // Rows are half a metre apart (a quarter in from the field's own edge), along the way the field was drilled.
      const b = polygonBounds(fields.polygons[key]);
      const alongX = two.stubbleFields[key].rows !== 'z';
      for (const [x, z] of pts.slice(0, 200)) {
        const k = ((alongX ? z - b.minZ : x - b.minX) - 0.25) / 0.5;
        expect(Math.abs(k - Math.round(k)), 'a row').toBeLessThan(0.07);
      }
      // Clumps reach all four sides of the field's box where the field itself does.
      const xs = pts.map((p) => p[0]);
      const zs = pts.map((p) => p[1]);
      expect(Math.min(...xs) - b.minX).toBeLessThan(0.1 * (b.maxX - b.minX));
      expect(b.maxX - Math.max(...xs)).toBeLessThan(0.1 * (b.maxX - b.minX));
      expect(Math.min(...zs) - b.minZ).toBeLessThan(0.1 * (b.maxZ - b.minZ));
      expect(b.maxZ - Math.max(...zs)).toBeLessThan(0.1 * (b.maxZ - b.minZ));
    });
  }
  it('shares the clumps out by area, not box', () => {
    const list = fields.stubbleFields.map((k) => ({ polygon: fields.polygons[k], density: two.stubbleFields[k].density }));
    const shares = stubbleShares(list, two.stubbleClumps);
    expect(shares.reduce((a, b) => a + b, 0)).toBeGreaterThan(two.stubbleClumps - 6);
    expect(shares.reduce((a, b) => a + b, 0)).toBeLessThan(two.stubbleClumps + 6);
    const weight = list.map((l) => polygonArea(l.polygon) * l.density);
    const sum = weight.reduce((a, b) => a + b, 0);
    shares.forEach((n, i) => expect(n / two.stubbleClumps).toBeCloseTo(weight[i] / sum, 3));
  });
  it('stands today\'s two rectangles as the whole box was scattered over, one random number for one', () => {
    // The old loop: rows over the box, the tries capped at three a clump, the rest decided by the field.
    const f1 = createFields(LAYOUT);
    for (const key of ['north', 'south']) {
      const r = f1.areas[key];
      const spec = LAYOUT.stubbleFields[key];
      const alongX = spec.rows !== 'z';
      const accept = (x, z) => f1.stubbleAt(x, z) >= 0.99 && f1.hedgeDistance(x, z) >= 1.5;
      const rand = seeded(5);
      const want = [];
      let tries = 0;
      while (want.length < 500 && tries++ < 1500) {
        const span = alongX ? r.maxZ - r.minZ : r.maxX - r.minX;
        const row = (alongX ? r.minZ : r.minX) + 0.25 + Math.floor(rand() * (span / 0.5)) * 0.5 + (rand() - 0.5) * 0.06;
        const along = alongX ? r.minX + rand() * (r.maxX - r.minX) : r.minZ + rand() * (r.maxZ - r.minZ);
        const x = alongX ? along : row;
        const z = alongX ? row : along;
        if (!accept(x, z)) continue;
        want.push([x, z]);
      }
      const got = [];
      scatterStubble({ polygon: f1.polygons[key], alongX, count: 500, random: seeded(5), accept, make: (x, z) => got.push([x, z]) });
      expect(got).toEqual(want);
    }
  });
});
