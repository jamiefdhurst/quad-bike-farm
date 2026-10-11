import { describe, it, expect } from 'vitest';
import { UtvBed, DEFAULT_UTV_BED_PARAMS as P } from '../src/vehicle/utvBed.js';

const run = (bed, seconds, ctx = { speed: 0, gateDown: false }, dt = 0.1) => {
  for (let t = 0; t < seconds; t += dt) bed.update(dt, ctx);
};

describe('the UTV bed', () => {
  it('rises over riseSeconds, holds, and comes down in lowerSeconds', () => {
    const bed = new UtvBed();
    expect(bed.stowed).toBe(true);
    expect(bed.toggle(0)).toBeNull();
    run(bed, P.riseSeconds / 2);
    expect(bed.tip).toBeCloseTo(0.5, 1);
    run(bed, P.riseSeconds);
    expect(bed.tip).toBe(1);
    expect(bed.toggle(0)).toBeNull(); // lever again: down
    run(bed, P.lowerSeconds / 2);
    expect(bed.tip).toBeCloseTo(0.5, 1);
    run(bed, P.lowerSeconds);
    expect(bed.tip).toBe(0);
  });

  it('will not go up while it is moving, and says why', () => {
    const bed = new UtvBed();
    expect(bed.toggle(P.maxTipSpeed + 0.5)).toMatch(/Stop first/);
    expect(bed.want).toBe(false);
    run(bed, 3, { speed: 0, gateDown: false });
    expect(bed.tip).toBe(0);
  });

  it('lets itself down if you drive off with it up', () => {
    const bed = new UtvBed();
    bed.toggle(0);
    run(bed, 4);
    const up = bed.tip;
    expect(up).toBeGreaterThan(0.4);
    run(bed, 1, { speed: P.autoLowerSpeed + 1, gateDown: false });
    expect(bed.want).toBe(false);
    expect(bed.tip).toBeLessThan(up);
  });

  it('pressed while it is coming down, it goes up again', () => {
    const bed = new UtvBed();
    bed.toggle(0);
    run(bed, 5);
    bed.toggle(0); // down
    run(bed, 1);
    const mid = bed.tip;
    bed.toggle(0); // and up again
    run(bed, 1);
    expect(bed.tip).toBeGreaterThan(mid);
  });

  it('drops the tailgate as the bed rises, and while someone sits on it, and shuts it again once the bed is down', () => {
    const bed = new UtvBed();
    run(bed, 3, { speed: 0, gateDown: true });
    expect(bed.gate).toBe(1);
    expect(bed.stowed).toBe(false);
    run(bed, 3);
    expect(bed.gate).toBe(0);
    expect(bed.stowed).toBe(true);
    bed.toggle(0);
    run(bed, 2);
    expect(bed.gate).toBeGreaterThan(0.9);
  });

  it('says anyone on the tailgate slides once the bed is high enough', () => {
    const bed = new UtvBed();
    bed.toggle(0);
    run(bed, P.riseSeconds * (P.slideAt - 0.05));
    expect(bed.sliding).toBe(false);
    run(bed, P.riseSeconds * 0.2);
    expect(bed.sliding).toBe(true);
  });
});

describe('a part-way lift', () => {
  it('holds at its cap until lowered', async () => {
    const { UtvBed } = await import('../src/vehicle/utvBed.js');
    const bed = new UtvBed();
    bed.toggle(0);
    bed.cap = 0.4;
    for (let i = 0; i < 300; i++) bed.update(0.1, { speed: 0 });
    expect(bed.tip).toBeCloseTo(0.4, 5);
    expect(bed.sliding).toBe(false);
    bed.toggle(0);
    for (let i = 0; i < 300; i++) bed.update(0.1, { speed: 0 });
    expect(bed.tip).toBe(0);
  });
});
