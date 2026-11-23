import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { paintConcrete, paintSlabWear } from '../src/world/concretePaint.js';
import { slabTileAt } from '../src/world/neighbourFarmProps.js';
import { createRandom } from '../src/core/random.js';

// No canvas in node, so a recording context stands in: the drawing is the list of calls with their arguments (and the fill and stroke styles set), which two
// draws agree on only if they would paint the same pixels.
function recorder() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => (log.push(`${String(k)}(${a.map((v) => (typeof v === 'number' ? v.toFixed(4) : v)).join(',')})`), undefined)),
    set: (t, k, v) => ((t[k] = v), log.push(`${String(k)}=${v}`), true),
  });
  return { ctx, log };
}
const draw = (seed, metres = 16) => {
  const { ctx, log } = recorder();
  paintConcrete(ctx, 1024, metres, createRandom(seed));
  return log.join('|');
};

describe('the concrete texture (#912)', () => {
  it('draws the same with the same seed and differently with another', () => {
    expect(draw(5)).toBe(draw(5));
    expect(draw(5)).not.toBe(draw(6));
  });
  it('leaves a 4 m tile (it repeats every few metres) without the one-off marks, and a 16 m one with them', () => {
    const calls = (m) => { const { ctx, log } = recorder(); paintConcrete(ctx, 1024, m, createRandom(5)); return log.filter((l) => l.startsWith('rotate(')).length; };
    expect(calls(4)).toBe(0); // the tread blocks are the only rotated draws
    expect(calls(16)).toBeGreaterThan(0);
    expect(draw(5, 4)).not.toMatch(/rgba\(34,48,30|rgba\(20,30,18/); // no slime on a tile: it is the slab's low corner's, painted once
    expect(draw(5, 16)).not.toMatch(/rgba\(34,48,30|rgba\(20,30,18/);
  });
  it('paints the slime and damp once, at the corner it is told', () => {
    const { ctx, log } = recorder();
    paintSlabWear(ctx, 14, 40, 30, [[2, 10], [20, 12], [35, 9]], createRandom(1), [7.5, 27.8]);
    expect(log.join('|')).toMatch(/rgba\(34,48,30/);
  });
  it('is drawn for a 4 m tile as well as a 16 m one', () => {
    expect(draw(5, 4).length).toBeGreaterThan(1000);
    expect(draw(5, 4)).not.toBe(draw(5, 16));
  });
  it('calls no ellipse or arc: its stains are ragged paths', () => {
    expect(draw(5)).not.toMatch(/ellipse|arc\(/);
    for (const f of ['src/world/concretePaint.js']) expect(readFileSync(f, 'utf8').replace(/\/\/.*$/gm, '')).not.toMatch(/\.(ellipse|arc)\(|createRadialGradient/);
    const props = readFileSync('src/world/neighbourFarmProps.js', 'utf8');
    const fn = props.slice(props.indexOf('export function concreteTexture'), props.indexOf('/** Barn straw bales'));
    expect(fn).not.toMatch(/ellipse|arc\(/);
  });
  it('paints the polished path and the rough rim deterministically', () => {
    const wear = (seed) => {
      const { ctx, log } = recorder();
      paintSlabWear(ctx, 14, 40, 30, [[2, 10], [20, 12], [35, 9]], createRandom(seed));
      return log.join('|');
    };
    expect(wear(1)).toBe(wear(1));
    expect(wear(1)).not.toBe(wear(2));
    expect(wear(1)).not.toMatch(/ellipse|arc\(/);
  });
  it('deals the slab\'s 16 m cells so that no neighbour, across or down, shares a tile', () => {
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      expect(slabTileAt(i, j)).not.toBe(slabTileAt(i + 1, j));
      expect(slabTileAt(i, j)).not.toBe(slabTileAt(i, j + 1));
    }
  });
});
