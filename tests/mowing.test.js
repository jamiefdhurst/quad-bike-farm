import { describe, it, expect } from 'vitest';
import { MowBlade, MowGrid, DEFAULT_MOW_PARAMS as P, MOW_PARAM_RANGES, lawnPlots } from '../src/world/mowing.js';
import { LAYOUT } from '../src/world/layout.js';
import { createSurfaceSampler } from '../src/audio/rideEvents.js';
import { availableJobs, FARM_JOBS } from '../src/world/farmJobs.js';

const lawn = { id: 'test', rect: { minX: 0, maxX: 10, minZ: 0, maxZ: 10 } };
const run = (blade, seconds, s) => {
  let out;
  for (let t = 0; t < seconds; t += 0.1) out = blade.update(0.1, s);
  return out;
};
const onGrass = { running: true, speed: 2, hard: false, grass: 1 };

describe('the blade', () => {
  it('only goes forward with the engine running, and stops when the engine does', () => {
    const b = new MowBlade({ ...P });
    expect(b.toggle(false)).toBe(false);
    expect(b.toggle(true)).toBe(true);
    b.update(0.1, { ...onGrass, running: false });
    expect(b.engaged).toBe(false);
  });

  it('takes a moment to come up to speed, and does not cut before it has', () => {
    const b = new MowBlade({ ...P });
    b.toggle(true);
    expect(b.update(0.1, onGrass).cutting).toBe(false);
    expect(run(b, 2, onGrass).cutting).toBe(true);
  });

  it('cuts only while the mower goes forward on grass', () => {
    const b = new MowBlade({ ...P });
    b.toggle(true);
    run(b, 2, onGrass);
    expect(b.update(0.1, { ...onGrass, speed: -1 }).cutting).toBe(false);
    expect(b.update(0.1, { ...onGrass, speed: 0.1 }).cutting).toBe(false);
    expect(b.update(0.1, { ...onGrass, hard: true }).cutting).toBe(false);
  });

  it('loads the engine and slows the drive more in long grass than short, and not at all with the lever back', () => {
    const b = new MowBlade({ ...P });
    expect(b.update(0.1, onGrass).load).toBe(0);
    b.toggle(true);
    const long = run(b, 2, { ...onGrass, grass: 1 });
    const short = run(b, 0.1, { ...onGrass, grass: 0.1 });
    expect(long.load).toBeGreaterThan(short.load);
    expect(long.drive).toBeLessThan(short.drive);
    expect(short.load).toBeGreaterThan(P.idleLoad * 0.9); // just turning the blade is a load too
    expect(long.drive).toBeGreaterThan(1 - P.maxDrag - 1e-9);
  });

  it('throws grit and goes dull on a hard surface, and sharpens again', () => {
    const b = new MowBlade({ ...P });
    b.toggle(true);
    run(b, 2, onGrass);
    let grit = 0;
    for (let t = 0; t < 5; t += 0.1) grit += b.update(0.1, { ...onGrass, hard: true }).events.length;
    expect(grit).toBeGreaterThanOrEqual(Math.floor(P.gritRate * 5) - 1);
    expect(b.dull).toBeGreaterThan(0.1);
    const dull = run(b, 0.1, onGrass);
    expect(dull.width).toBeLessThan(P.deckWidth);
    b.sharpen();
    expect(run(b, 0.1, onGrass).width).toBeCloseTo(P.deckWidth);
  });

  it('throws nothing on grass', () => {
    const b = new MowBlade({ ...P });
    b.toggle(true);
    let grit = 0;
    for (let t = 0; t < 5; t += 0.1) grit += b.update(0.1, onGrass).events.length;
    expect(grit).toBe(0);
    expect(b.dull).toBe(0);
  });
});

describe('the lawns', () => {
  it('cut a strip the width of the deck as the mower drives along', () => {
    const g = new MowGrid([lawn], { ...P });
    // Driving along +z (heading 0) down the middle of x = 5.
    for (let z = 1; z <= 9; z += 0.25) g.cut(5, z, 0, 1, 3);
    expect(g.longness(5, 5, 3)).toBe(0);
    expect(g.longness(5.4, 5, 3)).toBe(0);
    expect(g.longness(6, 5, 3)).toBe(1); // beside it, uncut
    expect(g.longness(3, 5, 3)).toBe(1);
    expect(g.share(3)).toBeGreaterThan(0.05);
    expect(g.share(3)).toBeLessThan(0.15);
  });

  it('remember which way the mower was going, so the stripes alternate', () => {
    const g = new MowGrid([lawn], { ...P });
    g.cut(2, 5, 0, 1, 3);
    g.cut(7, 5, Math.PI, 1, 3);
    const l = g.lawns[0];
    const at = (x, z) => l.dir[Math.floor(z / P.cell) * l.cols + Math.floor(x / P.cell)];
    expect(at(2, 5)).toBe(1);
    expect(at(7, 5)).toBe(2);
  });

  it('cut at an angle and still leave no gap along the way', () => {
    const g = new MowGrid([lawn], { ...P });
    const h = Math.PI / 4;
    for (let d = 0; d <= 8; d += 0.2) g.cut(1 + Math.sin(h) * d, 1 + Math.cos(h) * d, h, 1, 3);
    for (let d = 0.5; d <= 7.5; d += 0.5) expect(g.longness(1 + Math.sin(h) * d, 1 + Math.cos(h) * d, 3)).toBe(0);
  });

  it('grow back over the days, the stripe fading as they go', () => {
    const g = new MowGrid([lawn], { ...P, regrowDays: 4 });
    g.cut(5, 5, 0, 1, 10);
    const l = g.lawns[0];
    const i = Math.floor(5 / P.cell) * l.cols + Math.floor(5 / P.cell);
    expect(g.stripe(l, i, 10)).toBe(1);
    expect(g.stripe(l, i, 12)).toBeCloseTo(0.5);
    expect(g.stripe(l, i, 14)).toBe(0);
    expect(g.longness(5, 5, 12)).toBeCloseTo(0.5);
    expect(g.share(12)).toBe(0); // only what was cut today counts for the job
  });

  it('are done when enough of them was cut today, and not before', () => {
    const g = new MowGrid([lawn], { ...P });
    expect(g.done(5)).toBe(false);
    g.cutAll(4);
    expect(g.done(5)).toBe(false);
    g.cutAll(5);
    expect(g.done(5)).toBe(true);
    g.clear();
    expect(g.share(5)).toBe(0);
  });

  it('are kept in the save until they have grown back, and a changed lawn is forgotten', () => {
    const a = new MowGrid([lawn], { ...P, regrowDays: 5 });
    a.cut(5, 5, 0, 1, 10);
    a.cut(2, 2, Math.PI, 1, 8);
    const save = JSON.parse(JSON.stringify(a.toJSON()));
    const b = new MowGrid([lawn], { ...P, regrowDays: 5 });
    b.restore(save, 11);
    expect(b.longness(5, 5, 11)).toBeCloseTo(0.2);
    expect(b.longness(2, 2, 11)).toBeCloseTo(0.6); // cut on day 8: kept until it has grown out, on day 13
    const c = new MowGrid([lawn], { ...P, regrowDays: 5 });
    c.restore(save, 8 + 5);
    expect(c.longness(2, 2, 13)).toBe(1);
    expect(c.lawns[0].day.some((d) => d === 8)).toBe(false);
    const d = new MowGrid([{ id: 'test', rect: { minX: 0, maxX: 20, minZ: 0, maxZ: 10 } }], { ...P });
    d.restore(save, 11);
    expect(d.share(10)).toBe(0);
    d.restore(null, 11);
    d.restore({ test: { cols: 'x' } }, 11);
    expect(d.share(11)).toBe(0);
  });

  it('keep the day and the stripe direction through a save', () => {
    const a = new MowGrid([lawn], { ...P });
    a.cut(2, 5, Math.PI, 1, 3);
    const b = new MowGrid([lawn], { ...P });
    b.restore(JSON.parse(JSON.stringify(a.toJSON())), 3);
    expect(b.lawns[0].dir[Math.floor(5 / P.cell) * b.lawns[0].cols + Math.floor(2 / P.cell)]).toBe(2);
  });

  it('read the grass under the deck from three points across it', () => {
    const g = new MowGrid([lawn], { ...P });
    expect(g.longnessUnder(5, 5, 0, 3)).toBe(1);
    for (let z = 0; z < 10; z += 0.25) g.cut(5.6, z, 0, 1, 3); // a strip over only part of the deck's width
    expect(g.longnessUnder(5, 5, 0, 3)).toBeGreaterThan(0.2);
    expect(g.longnessUnder(5, 5, 0, 3)).toBeLessThan(0.9);
  });

  it('have a range for every setting', () => {
    for (const k of Object.keys(P)) expect(MOW_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('the farm', () => {
  const plots = lawnPlots(LAYOUT);

  it('has the yard and the paddock to mow, and puts the job on the board only where there is a lawn', () => {
    expect(plots.map((p) => p.id).sort()).toEqual(['paddock', 'yard']);
    expect(availableJobs(LAYOUT)).toContain('mow');
    expect(availableJobs({})).not.toContain('mow');
    expect(FARM_JOBS.mow.chalk).toMatch(/mower/);
  });

  it('keeps the lawns on grass, off the barn, the paddock rails and the bare ground of the yard', () => {
    const surface = createSurfaceSampler({ layout: LAYOUT, mudAt: () => 0, tarmacAt: () => 0, heights: {} });
    for (const { id, rect } of plots) {
      for (const x of [rect.minX, rect.maxX, (rect.minX + rect.maxX) / 2]) {
        for (const z of [rect.minZ, rect.maxZ, (rect.minZ + rect.maxZ) / 2]) {
          expect(surface(x, z).grass, `${id} at ${x}, ${z}`).toBeGreaterThan(0.5);
        }
      }
    }
    const b = LAYOUT.barn;
    for (const { rect } of plots) {
      const clear = rect.maxX < b.x - b.halfX - 1 || rect.minX > b.x + b.halfX + 1 || rect.maxZ < b.z - b.halfZ - 1 || rect.minZ > b.z + b.halfZ + 1;
      expect(clear).toBe(true);
    }
    const pd = LAYOUT.paddock;
    const inside = plots.find((p) => p.id === 'paddock').rect;
    expect(inside.minX).toBeGreaterThan(pd.x - pd.half);
    expect(inside.maxX).toBeLessThan(pd.x + pd.half);
    expect(inside.minZ).toBeGreaterThan(pd.z - pd.half);
    expect(inside.maxZ).toBeLessThan(pd.z + pd.half);
  });

  it('can be done in a few minutes at mowing speed', () => {
    const cells = new MowGrid(plots, { ...P }).cells;
    const area = cells * P.cell * P.cell;
    const seconds = area / (P.deckWidth * 2.2);
    expect(seconds).toBeGreaterThan(90);
    expect(seconds).toBeLessThan(600);
  });
});
