// How fast faults come and go, in game time (#250). A farm runs over many days, so a fault is something you notice, live with for
// days and get round to fixing (about a week of constant running to its worst, #1168). The clock runs `clockRate` game seconds to a real one, so a change to either can't quietly put
// the pace back to the old one-session numbers.
import { describe, it, expect } from 'vitest';
import { Faults, DEFAULT_FAULT_PARAMS as P } from '../src/vehicle/faults.js';
import { SHED_KINDS } from '../src/vehicle/shedFaults.js';
import { DEFAULT_DAYLIGHT_PARAMS } from '../src/world/daylight.js';

const GAME_HOUR = 3600 / DEFAULT_DAYLIGHT_PARAMS.clockRate; // real seconds
const START = 0.15; // where a fault starts (Faults.begin)
const DAY = 8 * GAME_HOUR; // a day of play: about 40 real minutes from a morning start

// How much of a day's running each kind of use is, so that a fault which grows only in some of it takes proportionally less of it.
const RUNNING = 1;
const RIDING = 0.6;
const HARD = 0.3; // hard riding
const SLIPPING = 0.15; // slipping the clutch
const KINDS = {
  carb: RUNNING, cable: RUNNING, leak: RUNNING, mounts: RUNNING, exhaustBlow: RUNNING, terminals: RUNNING, valves: RUNNING,
  carbGum: RUNNING, tapClog: RUNNING, exhaustHole: RUNNING, gasket: RUNNING, valveCore: RUNNING,
  chain: RIDING, tyreLeak: RIDING, tyreUneven: RIDING, chainGrit: RIDING, brakeMud: RIDING, caliper: RIDING, bearing: RIDING,
  belt: HARD, clutch: SLIPPING,
};

// These start in some kinds of use but grow whenever the clock runs (`grow(kind, true, ...)` in faults.js), parked or not.
const GROWS_ALWAYS = ['tyreLeak'];

describe('how long a fault takes to get to its worst (#250)', () => {
  for (const [kind, share] of Object.entries(KINDS)) {
    it(`${kind}: about a week of its kind of use, from first noticed to its worst`, () => {
      const hours = (P[`${kind}Seconds`] * (1 - START)) / GAME_HOUR; // of that use, at the usual rate (worsens 1)
      const grows = GROWS_ALWAYS.includes(kind) ? RUNNING : share;
      expect(hours).toBeGreaterThanOrEqual(48 * grows - 0.5);
      expect(hours).toBeLessThanOrEqual(72 * grows + 0.5);
    });
  }

  it('a slow puncture takes about a day of play to go flat, not two minutes', () => {
    const hours = (P.punctureSeconds * (1 - START)) / GAME_HOUR;
    expect(hours).toBeGreaterThanOrEqual(8);
    expect(hours).toBeLessThanOrEqual(12);
  });

  it('a cold morning\'s soft tyres take about the same, as the cold lasts a morning', () => {
    const hours = (P.tyreColdSeconds * (1 - START)) / GAME_HOUR;
    expect(hours).toBeGreaterThanOrEqual(3);
    expect(hours).toBeLessThanOrEqual(4);
  });

  it('every kind of fault that grows with use is in the table above, so a new one has to choose its pace', () => {
    const growing = Object.keys(P).filter((k) => k.endsWith('Seconds') && !k.startsWith('chainLube')).map((k) => k.replace(/Seconds$/, ''));
    for (const k of growing) expect(k in KINDS || k === 'puncture' || k === 'tyreCold', k).toBe(true);
  });

  it('a quad dealt quick still worsens up to proneSpread times as fast, so some are worse than others', () => {
    expect(P.proneSpread).toBe(2.5);
    const f = new Faults({ ...P }, () => 1); // the top of every draw
    f.roll(() => 1);
    expect(f.worsens.carb).toBeCloseTo(2.5);
    f.begin('carb');
    const quickEnough = ((P.carbSeconds * (1 - START)) / 2.5) * 1.1; // a little over 2.5 times as quick; at the usual rate it would not be there yet
    for (let t = 0; t < quickEnough; t += 1) f.update(1, { running: true, speed: 0, throttle: 0 });
    expect(f.levels.carb).toBe(1);
  });

});

describe('how often faults start (#250)', () => {
  it('a quad running a whole day expects well under one new fault, across every kind it can get', () => {
    let expected = 0;
    for (const [kind, share] of Object.entries(KINDS)) expected += (DAY * share) / P[`${kind}Every`];
    expected += (DAY * RIDING) / P.punctureEvery;
    expected += (DAY * 0.1) / P.tyreColdEvery; // a cold morning is a small part of the day
    expect(expected).toBeLessThan(0.6);
    expect(expected).toBeGreaterThan(0.2); // and not so rare that nothing ever goes wrong
  });

  it('the shed faults are no quicker to start than the rest', () => {
    for (const k of SHED_KINDS) expect(P[`${k}Every`], k).toBeGreaterThanOrEqual(DAY * 4);
  });
});
