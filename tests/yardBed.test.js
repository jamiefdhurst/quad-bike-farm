import { describe, it, expect } from 'vitest';
import { LAYOUT, RAW_LAYOUT } from '../src/world/layout.js';
import { layoutNew } from '../src/world/layoutNew.js';
import { yardHeard, yardBed, YARD_FADE } from '../src/world/yardBed.js';
import { DEFAULT_SOUND_PARAMS, SOUND_PARAM_RANGES } from '../src/audio/audioParams.js';

// The yard's sound bed (#817): chosen inside the yard and not outside, silent in the barn, louder in wind, a tap that drips faster in rain.
const two = layoutNew(LAYOUT, RAW_LAYOUT);
const slab = two.farmstead.slab;
const mid = { x: (slab.minX + slab.maxX) / 2, z: (slab.minZ + slab.maxZ) / 2 };

describe('the yard bed', () => {
  it('is full on the concrete and gone well outside it', () => {
    expect(yardHeard(two, mid.x, mid.z)).toBe(1);
    expect(yardHeard(two, slab.minX + 1, slab.minZ + 1)).toBe(1);
    expect(yardHeard(two, slab.maxX + YARD_FADE, mid.z)).toBe(0);
    expect(yardHeard(two, slab.minX - 100, mid.z)).toBe(0);
    expect(yardHeard(two, mid.x, slab.maxZ + 200)).toBe(0);
  });
  it('fades over the metres beyond the slab, getting quieter the further out you go', () => {
    const at = (d) => yardHeard(two, slab.maxX + d, mid.z);
    expect(at(2)).toBeLessThan(1);
    expect(at(2)).toBeGreaterThan(at(8));
    expect(at(8)).toBeGreaterThan(at(13));
  });
  it('is silent inside the barn, where its own sounds are heard, and halves as you go in', () => {
    expect(yardHeard(two, mid.x, mid.z, 1)).toBe(0);
    expect(yardHeard(two, mid.x, mid.z, 0.5)).toBeCloseTo(0.5);
  });
  it('is not played on today\'s farm, which has no yard of its own', () => {
    expect(yardHeard(LAYOUT, 0, 0)).toBe(0);
  });
  it('rattles more in the wind and drips faster in rain, and does neither out of earshot', () => {
    expect(yardBed(1, 1, 0).tin).toBeGreaterThan(yardBed(1, 0.1, 0).tin);
    expect(yardBed(1, 0.5, 1).tin).toBeGreaterThan(yardBed(1, 0.5, 0).tin);
    expect(yardBed(1, 0, 1).dripEvery).toBeLessThan(yardBed(1, 0, 0).dripEvery);
    expect(yardBed(0, 1, 1).tin).toBe(0);
    expect(yardBed(0, 1, 1).dripEvery).toBe(Infinity);
  });
  it('has a volume that can be tuned', () => {
    expect(DEFAULT_SOUND_PARAMS.yardVolume).toBeGreaterThan(0);
    expect(SOUND_PARAM_RANGES.yardVolume).toEqual([0, 0.5, 0.005]);
  });
});
