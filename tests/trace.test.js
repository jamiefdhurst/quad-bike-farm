import { describe, it, expect } from 'vitest';
import { Trace } from '../src/debug/trace.js';

const read = (n) => () => ({ rpm: n, speed: n, slip: 0, throttle: 1 });

describe('Trace', () => {
  it('takes samples at its rate, not every frame', () => {
    const t = new Trace(10, 20);
    for (let i = 0; i < 60; i++) t.tick(1 / 60, read(1));
    expect(t.samples.length).toBeGreaterThanOrEqual(19);
    expect(t.samples.length).toBeLessThanOrEqual(20);
  });

  it('keeps only the last ten seconds', () => {
    const t = new Trace(10, 20);
    for (let i = 0; i < 20 * 30; i++) t.tick(0.05, read(i));
    expect(t.samples.length).toBe(200);
    expect(t.samples.at(-1).rpm).toBe(20 * 30 - 1);
  });

  it('does not fill in for a long frame', () => {
    const t = new Trace(10, 20);
    t.tick(5, read(1));
    expect(t.samples.length).toBe(1);
  });

  it('scales revs to the engine top and the rest to the window, with a floor', () => {
    const t = new Trace(10, 20);
    t.tick(0.05, () => ({ rpm: 3000, speed: 10, slip: 0.1, throttle: 0.5 }));
    const by = Object.fromEntries(t.lines({ rpm: 6000 }).map((l) => [l.key, l]));
    expect(by.rpm.values[0]).toBeCloseTo(0.5);
    expect(by.speed.values[0]).toBe(1);
    expect(by.slip.values[0]).toBeCloseTo(0.05); // a little slip stays little: scaled to at least 2 m/s
    expect(by.throttle.values[0]).toBe(0.5);
  });

  it('clear empties it', () => {
    const t = new Trace();
    t.tick(1, read(1));
    t.clear();
    expect(t.samples).toEqual([]);
  });
});
