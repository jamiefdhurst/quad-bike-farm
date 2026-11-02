import { describe, it, expect } from 'vitest';
import { createScreenRain, updateScreenRain, addDrop, onGlass, wipeSector, screenCover, DEFAULT_SCREEN_RAIN_PARAMS as P } from '../src/effects/screenRain.js';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const seeded = (s = 1) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const glassOf = () => createScreenRain([rect(-0.7, -0.35, 0.7, 0.35)]);
const time = (g, seconds, s, random = seeded()) => { for (let t = 0; t < seconds; t += 1 / 60) updateScreenRain(g, 1 / 60, s, random, P); };

describe('rain on the windscreen', () => {
  it('lands only on the glass, never off a pane or on the post between two', () => {
    const g = createScreenRain([rect(-0.77, -0.3, -0.03, 0.3), rect(0.03, -0.3, 0.77, 0.3)]);
    time(g, 3, { rain: 1, speed: 0 });
    expect(g.drops.length).toBeGreaterThan(20);
    for (const d of g.drops) expect(Math.abs(d.x)).toBeGreaterThan(0.03);
    expect(onGlass(g, 0, 0)).toBe(false);
    expect(onGlass(g, 0.4, 0)).toBe(true);
  });

  it('nothing lands with no rain (under a roof the game passes none)', () => {
    const g = glassOf();
    time(g, 3, { rain: 0, speed: 10 });
    expect(g.drops.length).toBe(0);
  });

  it('beads: a drop landing on another joins it, so the volume adds', () => {
    const g = glassOf();
    addDrop(g, 0, 0, 0.002, P);
    const joined = addDrop(g, 0.001, 0, 0.002, P);
    expect(g.drops.length).toBe(1);
    expect(joined.r).toBeCloseTo(Math.cbrt(2 * 0.002 ** 3), 6);
  });

  it('a heavy drop runs down the glass, leaving a streak, and a small one sits', () => {
    const g = glassOf();
    const big = addDrop(g, 0, 0.2, P.runFrom * 1.1, P);
    const small = addDrop(g, 0.3, 0.2, P.dropMin, P);
    time(g, 0.5, { rain: 0.0, speed: 0 });
    expect(big.y).toBeLessThan(0.2 - 0.02);
    expect(big.trail).toBeGreaterThan(0.01);
    expect(small.y).toBe(0.2);
  });

  it('at speed the air pushes the drops up the screen and off its top', () => {
    const g = glassOf();
    const d = addDrop(g, 0, 0, P.dropMin, P);
    time(g, 0.5, { rain: 0, speed: 20 });
    expect(d.y).toBeGreaterThan(0.05);
    time(g, 5, { rain: 0, speed: 20 });
    expect(g.drops).not.toContain(d);
  });

  it('more lands driving into it than standing, and the drops dry once it stops', () => {
    const still = glassOf();
    const going = glassOf();
    time(still, 1, { rain: 0.5, speed: 0 });
    time(going, 1, { rain: 0.5, speed: 6 }); // (under airFrom, so they stay put)
    expect(going.drops.length).toBeGreaterThan(still.drops.length);
    expect(screenCover(going)).toBeGreaterThan(0);
    time(going, 80, { rain: 0, speed: 0 });
    expect(going.drops.length).toBe(0);
  });

  it('a blade clears the sector it passes over and nothing else', () => {
    const g = glassOf();
    const w = { px: 0, py: -0.35, rIn: 0.05, rOut: 0.5, park: 0, sweep: Math.PI / 2 };
    const swept = addDrop(g, 0.2, -0.15, 0.002, P); // about 45 degrees, 0.28 out
    const beyond = addDrop(g, -0.3, -0.1, 0.002, P); // round past the end of the sweep
    const far = addDrop(g, 0.6, 0.3, 0.002, P); // out past the blade's tip
    expect(wipeSector(g, w, 0, 0.3)).toBe(0); // not got there yet
    expect(wipeSector(g, w, 0.3, 0.6)).toBe(1);
    expect(g.drops).not.toContain(swept);
    wipeSector(g, w, 0.6, 1);
    wipeSector(g, w, 1, 0); // and back
    expect(g.drops).toContain(beyond);
    expect(g.drops).toContain(far);
  });

  it('keeps no more than its most', () => {
    const g = glassOf();
    time(g, 30, { rain: 1, speed: 6 }, seeded(7));
    expect(g.drops.length).toBeLessThanOrEqual(P.maxDrops);
  });
});
