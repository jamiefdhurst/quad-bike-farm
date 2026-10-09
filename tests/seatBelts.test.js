import { describe, it, expect } from 'vitest';
import { SeatBelts, BELT_SEATS, beltLampMode, beltLampLit, DEFAULT_SEAT_BELT_PARAMS as P } from '../src/vehicle/seatBelts.js';
import { BELTS } from '../src/vehicle/utvModel.js';

const nobody = { driver: null, mid: null, left: null };
let clock = 0; // the dash clock the lamp flashes by, running on across calls
const run = (belts, seconds, who, keyOn = true, step = 0.1) => {
  let bings = 0;
  for (let t = 0; t < seconds; t += step) {
    clock += step;
    if (belts.update(step, who, keyOn, clock)) bings++;
  }
  return bings;
};

describe('SeatBelts', () => {
  it('has nobody belted to start with', () => {
    expect(new SeatBelts().worn()).toEqual({ driver: false, mid: false, left: false });
  });

  it('buckles a girl up a moment after she sits down, and lets go when she gets out', () => {
    const b = new SeatBelts();
    run(b, P.girlSeconds - 0.5, { ...nobody, mid: 'girl' });
    expect(b.worn().mid).toBe(false);
    run(b, 1, { ...nobody, mid: 'girl' });
    expect(b.worn().mid).toBe(true);
    run(b, 0.1, nobody);
    expect(b.worn().mid).toBe(false);
  });

  it('never buckles you by itself, only on the key, and only when you are sitting there', () => {
    const b = new SeatBelts();
    run(b, 20, { ...nobody, driver: 'you' }, false);
    expect(b.worn().driver).toBe(false);
    expect(b.toggle('left')).toBeNull();
    expect(b.toggle('driver')).toBe('on');
    expect(b.worn().driver).toBe(true);
    expect(b.toggle('driver')).toBe('off');
  });

  it('lets your belt go when you get out', () => {
    const b = new SeatBelts();
    b.update(0.1, { ...nobody, driver: 'you' }, true);
    b.toggle('driver');
    b.update(0.1, nobody, true);
    expect(b.worn().driver).toBe(false);
  });

  it('flags someone sitting unbelted, for the lamp', () => {
    const b = new SeatBelts();
    b.update(0.1, { ...nobody, driver: 'you' }, true, 0);
    expect(b.anyUnbelted).toBe(true);
    b.toggle('driver');
    expect(b.anyUnbelted).toBe(false);
  });

  it('counts an empty driver\'s seat as unbelted too, since someone is expected in it', () => {
    const b = new SeatBelts();
    expect(b.anyUnbelted).toBe(true);
    b.update(0.1, { ...nobody, mid: 'girl' }, true, 0);
    expect(b.anyUnbelted).toBe(true);
  });
});

describe('the bing', () => {
  it('starts after the delay and repeats while you sit unbelted with the key on', () => {
    const b = new SeatBelts();
    const you = { ...nobody, driver: 'you' };
    expect(run(b, P.nagDelay - 0.3, you)).toBe(0);
    const bings = run(b, P.bingEvery * 3, you);
    expect(bings).toBeGreaterThanOrEqual(3);
    expect(bings).toBeLessThanOrEqual(4);
  });

  it('stops once you buckle up, and never sounds with the key off', () => {
    const b = new SeatBelts();
    const you = { ...nobody, driver: 'you' };
    run(b, 5, you);
    b.toggle('driver');
    expect(run(b, 20, you)).toBe(0);
    const c = new SeatBelts();
    expect(run(c, 20, you, false)).toBe(0);
    expect(run(c, 20, nobody, false)).toBe(0);
  });

  it('sounds with the key on and nobody in the driver\'s seat, after the delay, and stops when a girl takes it and buckles up', () => {
    const b = new SeatBelts();
    expect(run(b, P.nagDelay - 0.3, nobody)).toBe(0);
    expect(run(b, P.bingEvery * 3, nobody)).toBeGreaterThanOrEqual(3);
    expect(run(b, P.girlSeconds + 0.5, { ...nobody, driver: 'girl' }) <= 1).toBe(true); // at most the one already due
    expect(run(b, 20, { ...nobody, driver: 'girl' })).toBe(0);
  });

  it('sounds as the lamp lights, and no faster than the interval', () => {
    const b = new SeatBelts();
    const you = { ...nobody, driver: 'you' };
    run(b, P.nagDelay, you);
    const times = [];
    for (let t = 0; t < 12; t += 0.05) {
      clock += 0.05;
      if (b.update(0.05, you, true, clock)) times.push(clock);
    }
    expect(times.length).toBeGreaterThanOrEqual(5);
    for (const at of times) expect(beltLampLit('flash', at - 0.05 / 2 + 0.0001) || beltLampLit('flash', at)).toBe(true); // the lamp is lit at each
    for (let i = 1; i < times.length; i++) expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(P.bingEvery - 0.15);
  });

  it('is not set off by a girl who has not yet buckled up', () => {
    expect(run(new SeatBelts(), 30, { ...nobody, driver: 'girl' }) <= 0).toBe(true);
  });
});

describe('the seat belt lamp', () => {
  it('flashes while someone sits unbelted with the key on, and is out otherwise', () => {
    expect(beltLampMode(true, true)).toBe('flash');
    expect(beltLampMode(true, false)).toBe('off');
    expect(beltLampMode(false, true)).toBe('off');
  });

  it('flashes on and off at the flash rate', () => {
    const period = 1 / P.flashRate;
    expect(beltLampLit('flash', 0)).toBe(true);
    expect(beltLampLit('flash', period * 0.6)).toBe(false);
    expect(beltLampLit('flash', period * 1.1)).toBe(true);
    expect(beltLampLit('off', 0)).toBe(false);
    expect(beltLampLit('on', 5)).toBe(true);
  });
});

describe('where the belts are', () => {
  it('has the driver anchored on the right and the passengers on the left, with the buckles on the far side', () => {
    expect([...BELT_SEATS].sort()).toEqual(Object.keys(BELTS).sort());
    expect(BELTS.driver.anchor).toBeLessThan(BELTS.driver.buckle); // +x is the driver's left, so the right is negative
    expect(BELTS.mid.anchor).toBeGreaterThan(BELTS.mid.buckle);
    expect(BELTS.left.anchor).toBeGreaterThan(BELTS.left.buckle);
  });

  it('puts two buckles between the driver and the middle seat and one between the middle and the left', () => {
    const seatX = { driver: -0.34, mid: 0, left: 0.34 };
    const between = (a, b) => Object.values(BELTS).filter((x) => x.buckle > seatX[a] && x.buckle < seatX[b]).length;
    expect(between('driver', 'mid')).toBe(2);
    expect(between('mid', 'left')).toBe(1);
  });
});
