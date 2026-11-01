import { describe, it, expect } from 'vitest';
import { dealArrival, liftSeats, carsAway, keepAway, Arrival, DEFAULT_ARRIVAL_PARAMS, ARRIVAL_PARAM_RANGES } from '../src/farm/arrival.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { P309_SPEC } from '../src/vehicle/quadSpecs.js';

const rnd = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);
const GIRLS = ['amy', 'jess'];

describe('dealing the morning', () => {
  it('gives one girl a lift about a day in four and both about a day in eight, and otherwise you come alone', () => {
    const random = rnd(7);
    const count = { 0: 0, 1: 0, 2: 0 };
    const N = 4000;
    for (let i = 0; i < N; i++) count[dealArrival(random, GIRLS).lift.length]++;
    expect(count[1] / N).toBeGreaterThan(0.22);
    expect(count[1] / N).toBeLessThan(0.28);
    expect(count[2] / N).toBeGreaterThan(0.1);
    expect(count[2] / N).toBeLessThan(0.15);
  });

  it('gives each girl not in your car a sit of up to a minute in her own, and each in yours a wait after you, the second after the first', () => {
    const random = rnd(3);
    for (let i = 0; i < 200; i++) {
      const d = dealArrival(random, GIRLS);
      for (const g of GIRLS) expect(d.lift.includes(g) !== g in d.sit).toBe(true); // in your car or sat in hers, never both
      for (const at of Object.values(d.sit)) {
        expect(at).toBeGreaterThanOrEqual(DEFAULT_ARRIVAL_PARAMS.sitMin);
        expect(at).toBeLessThanOrEqual(60);
      }
      if (d.lift.length === 2) expect(d.follow[d.lift[1]]).toBeGreaterThan(d.follow[d.lift[0]]);
    }
  });

  it('copes with no girls, or one', () => {
    expect(dealArrival(rnd(1), [])).toEqual({ lift: [], sit: {}, follow: {} });
    for (let i = 1; i < 50; i++) expect(dealArrival(rnd(i), ['jess']).lift.length).toBeLessThanOrEqual(1);
  });

  it('seats the first girl in the front beside you and the second behind her', () => {
    expect(liftSeats(['jess', 'amy'])).toEqual({ jess: 'left', amy: 'rearLeft' });
    expect(liftSeats(['amy'])).toEqual({ amy: 'left' });
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_ARRIVAL_PARAMS)) expect(ARRIVAL_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('a girl\'s car on a day she came with you', () => {
  const carOf = (g) => ({ amy: 'fiesta', jess: 'corsa' })[g];

  it('stays at home', () => {
    expect(carsAway({ lift: ['jess'] }, carOf)).toEqual(['corsa']);
    expect(carsAway({ lift: [] }, carOf)).toEqual([]);
  });

  it('keeps what the farm remembered about it in tonight\'s save, untouched', () => {
    const saved = { corsa: { wear: 0.4, fuel: 3 }, fiesta: { wear: 0.1 } };
    const today = { fiesta: { wear: 0.12 }, p309: { wear: 0.2 } };
    expect(keepAway(today, saved, ['corsa'])).toEqual({ fiesta: { wear: 0.12 }, p309: { wear: 0.2 }, corsa: { wear: 0.4, fuel: 3 } });
    expect(keepAway(today, null, ['corsa'])).toEqual(today); // a new farm has nothing to keep
    expect(keepAway(today, saved, ['fiesta']).fiesta).toEqual({ wear: 0.12 }); // one that is here today is today's
  });
});

describe('the morning playing out', () => {
  const deal = { lift: ['jess'], sit: { amy: 20 }, follow: { jess: 2 } };
  const seatedAll = new Set(['amy', 'jess']);

  it('lets a girl out of her own car when her time is up, and a girl you gave a lift out only after you are out', () => {
    const a = new Arrival(deal);
    const all = [];
    let t = 0;
    for (; t < 30; t += 0.5) all.push(...a.update(0.5, { youIn: true, seated: seatedAll }).map((e) => ({ ...e, t })));
    expect(all).toEqual([{ type: 'out', girl: 'amy', from: 'own', t: 19.5 }]);
    for (let s = 0; s < 2; s += 0.5) expect(a.update(0.5, { youIn: false, seated: new Set(['jess']) })).toEqual([]); // you've just got out: she waits two seconds
    expect(a.update(0.5, { youIn: false, seated: new Set(['jess']) })).toEqual([{ type: 'out', girl: 'jess', from: 'lift' }]);
    expect(a.done).toBe(true);
  });

  it('forgets a girl who was moved off her seat some other way, and lets one out at once when asked', () => {
    const a = new Arrival(deal);
    expect(a.update(1, { youIn: true, seated: new Set(['jess']) })).toEqual([]); // Amy's been called away
    a.getOutNow('jess');
    expect(a.update(1, { youIn: true, seated: new Set(['jess']) })).toEqual([{ type: 'out', girl: 'jess', from: 'lift' }]);
    expect(a.done).toBe(true);
  });

  it('says where everyone is in a line', () => {
    const a = new Arrival(deal);
    a.update(5, { youIn: true, seated: seatedAll });
    expect(a.describe({ amy: 'Amy', jess: 'Jess' })).toBe('came with you: Jess; Amy in her car, out in 15 s; Jess waiting for you to get out');
  });
});

describe('the car you arrive in', () => {
  it('is already running, warm, at its idle, and keeps running on its own', () => {
    const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...P309_SPEC.engine }, { random: rnd(5) });
    e.runWarm();
    expect(e.isRunning).toBe(true);
    expect(e.ignitionOn).toBe(true);
    for (let t = 0; t < 5; t += 1 / 60) e.update(1 / 60, { fuel: 1 });
    expect(e.isRunning).toBe(true);
    expect(Math.abs(e.rpm - P309_SPEC.engine.idleRpmWarm)).toBeLessThan(150);
    expect(e.temperature).toBeGreaterThan(0.8);
  });
});
