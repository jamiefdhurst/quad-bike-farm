import { describe, it, expect } from 'vitest';
import { Mist, Rainbow, mistTarget, antisolar, rainbowRows, DEFAULT_MIST_PARAMS as M, DEFAULT_RAINBOW_PARAMS as R } from '../src/world/mist.js';

const morning = (o = {}) => ({ hour: 8, sunrise: 7.25, temperature: 6, wet: 0.5, wind: 0.6, rain: 0, snow: 0, ...o });
const run = (thing, ctx, seconds) => {
  for (let t = 0; t < seconds; t += 1) thing.update(1, ctx);
  return thing;
};

describe('mist in the hollow', () => {
  it('lies on a cool, still morning and burns off as the day goes on', () => {
    const early = mistTarget(morning(), 1);
    expect(early).toBeGreaterThan(0.4);
    expect(mistTarget(morning({ hour: 9.5 }), 1)).toBeLessThan(early);
    expect(mistTarget(morning({ hour: 12 }), 1)).toBe(0);
  });

  it('burns off sooner on a warm day, and does not form in warm air at all', () => {
    expect(mistTarget(morning({ hour: 9.5, temperature: 20 }), 1)).toBeLessThan(mistTarget(morning({ hour: 9.5, temperature: 5 }), 1));
    expect(mistTarget(morning({ temperature: 20 }), 1)).toBeLessThan(mistTarget(morning(), 1) / 2);
  });

  it('is cleared by wind, rain and snow, and a game with no dew has none', () => {
    expect(mistTarget(morning({ wind: 1.5 }), 1)).toBe(0);
    expect(mistTarget(morning({ rain: 0.5 }), 1)).toBe(0);
    expect(mistTarget(morning({ snow: 0.5 }), 1)).toBe(0);
    expect(mistTarget(morning(), 0)).toBe(0);
  });

  it('forms over a minute or two and clears slowly', () => {
    const m = new Mist(1);
    run(m, morning(), 30);
    expect(m.level).toBeGreaterThan(0);
    expect(m.level).toBeLessThan(m.target);
    run(m, morning(), 120);
    expect(m.level).toBeCloseTo(m.target, 3);
    run(m, morning({ hour: 13 }), 30);
    expect(m.level).toBeGreaterThan(0);
    run(m, morning({ hour: 13 }), 200);
    expect(m.visible).toBe(false);
  });

  it('can be held at a level', () => {
    const m = new Mist(0);
    m.forced = 0.8;
    run(m, morning({ hour: 14 }), 200);
    expect(m.level).toBeCloseTo(0.8, 3);
  });

  it('draws a dew in some games and not others, from the stream it is given', () => {
    expect(Mist.drawDew(() => 0.99)).toBe(0);
    expect(Mist.drawDew(() => 0.1)).toBeGreaterThanOrEqual(0.5);
    expect(M.chance).toBeGreaterThan(0);
  });
});

describe('rainbows', () => {
  const sunny = { rain: 0, sunElevation: 0.25, sunshine: 1 };

  it('needs a shower that has passed with the sun out', () => {
    const r = new Rainbow();
    run(r, { ...sunny, rain: 0 }, 60);
    expect(r.visible).toBe(false); // it never rained
    run(r, { ...sunny, rain: 0.6 }, 30);
    expect(r.visible).toBe(false); // still raining
    run(r, sunny, 30);
    expect(r.visible).toBe(true);
  });

  it('fades away some time after, and not under a dull sky or with the sun high', () => {
    const r = new Rainbow();
    run(r, { ...sunny, rain: 0.6 }, 10);
    run(r, sunny, 20);
    expect(r.strength).toBeGreaterThan(0.5);
    run(r, sunny, R.window + R.fadeOut);
    expect(r.visible).toBe(false);
    const dull = new Rainbow();
    run(dull, { ...sunny, rain: 0.6 }, 10);
    run(dull, { ...sunny, sunshine: 0.2 }, 60);
    expect(dull.visible).toBe(false);
    const high = new Rainbow();
    run(high, { ...sunny, rain: 0.6 }, 10);
    run(high, { ...sunny, sunElevation: 0.9 }, 60);
    expect(high.visible).toBe(false);
  });
});

describe('the arc', () => {
  const sun = { x: 0.6, y: 0.3, z: 0.74 };
  it('is a circle 40 to 43.5 degrees round the point opposite the sun', () => {
    const axis = antisolar(sun);
    expect(axis).toEqual({ x: -0.6, y: -0.3, z: -0.74 });
    const len = Math.hypot(axis.x, axis.y, axis.z);
    const rows = rainbowRows(axis, 40, 4, 40, 43.5).filter(Boolean);
    expect(rows.length).toBeGreaterThan(5);
    for (const row of rows) {
      const inner = Math.acos((row[0].x * axis.x + row[0].y * axis.y + row[0].z * axis.z) / len);
      const outer = Math.acos((row[4].x * axis.x + row[4].y * axis.y + row[4].z * axis.z) / len);
      expect((inner * 180) / Math.PI).toBeCloseTo(40, 3);
      expect((outer * 180) / Math.PI).toBeCloseTo(43.5, 3);
      for (const d of row) expect(d.y).toBeGreaterThan(0);
    }
  });

  it('leaves out the part under the horizon, so a lower sun gives a taller bow', () => {
    const count = (elev) => rainbowRows(antisolar({ x: Math.cos(elev), y: Math.sin(elev), z: 0 }), 60, 4, 40, 43.5).filter(Boolean).length;
    expect(count(0.05)).toBeGreaterThan(count(0.5));
    expect(count(1.2)).toBe(0);
  });
});
