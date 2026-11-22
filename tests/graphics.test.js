import { describe, it, expect } from 'vitest';
import { registerTuning } from '../src/core/tuning.js';
import { buildGameTree } from '../src/console/gameTree.js';
import { resolve } from '../src/console/shell.js';
import { TUNE_CATEGORIES } from '../src/debug/tuneCategories.js';
import { DEFAULT_GRAPHICS_PARAMS, GRAPHICS_PARAM_RANGES, pixelRatioFor, nextFrameAt } from '../src/core/graphics.js';

/** Frames drawn in a second of screen ticks at `hz` (with a little jitter) under a cap. */
function drawn(hz, maxFps) {
  let due = null;
  let n = 0;
  for (let i = 0; i < hz; i++) {
    const now = 10 + i / hz + (i % 3 === 0 ? 0.0005 : -0.0005);
    const next = nextFrameAt(now, due, maxFps);
    if (next === null) continue;
    due = next;
    n++;
  }
  return n;
}

describe('graphics', () => {
  it('has a range for every setting', () => {
    expect(Object.keys(GRAPHICS_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_GRAPHICS_PARAMS).sort());
  });

  it('draws at the render scale on a Retina screen, and never above what the screen has', () => {
    expect(pixelRatioFor(2, { renderScale: 1.5 })).toBe(1.5);
    expect(pixelRatioFor(1, { renderScale: 1.5 })).toBe(1);
    expect(pixelRatioFor(undefined, { renderScale: 2 })).toBe(1);
  });

  it('holds a 60 fps cap whatever the screen rate', () => {
    expect(drawn(120, 60)).toBe(60);
    expect(drawn(60, 60)).toBe(60);
    expect(Math.abs(drawn(144, 60) - 60)).toBeLessThanOrEqual(1);
    expect(Math.abs(drawn(1000, 60) - 60)).toBeLessThanOrEqual(1);
  });

  it('draws every tick with no cap, and every tick of a screen slower than the cap', () => {
    expect(drawn(120, 0)).toBe(120);
    expect(drawn(50, 60)).toBe(50);
  });

  it('starts the schedule again after falling behind, rather than rushing to catch up', () => {
    const due = nextFrameAt(5, 1, 60); // a long stall
    expect(due).toBeCloseTo(5 + 1 / 60);
    expect(nextFrameAt(5.005, due, 60)).toBe(null);
  });
});

describe('the view distance setting (#820)', () => {
  it('is on the Tune tab under Graphics and in the console as tune.graphics.viewDistance, from 300 to 3000 m', () => {
    const params = { ...DEFAULT_GRAPHICS_PARAMS };
    registerTuning('Graphics', params, GRAPHICS_PARAM_RANGES);
    const { node, error } = resolve(buildGameTree({ units: [], companions: [], weather: {} }, {}), 'tune.graphics.viewDistance');
    expect(error).toBeUndefined();
    expect(node.get()).toBe(1500);
    expect([node.min, node.max]).toEqual([300, 3000]);
    node.set(3000);
    expect(params.viewDistance).toBe(3000);
    expect(TUNE_CATEGORIES['World, weather and sound']).toContain('Graphics');
  });
});
