import { describe, it, expect } from 'vitest';
import { availabilityOf, JOBS } from '../src/npc/availability.js';

const idle = (o = {}) => ({ state: 'idle', jobs: {}, holds: [], held: null, ...o });

describe('availability', () => {
  it('is free stood about with nothing on', () => {
    expect(availabilityOf(idle())).toEqual({ free: true, why: 'free', settled: true, held: null, canRemark: true });
  });

  it('is busy in any other state, saying what with', () => {
    expect(availabilityOf(idle({ state: 'driving' }))).toMatchObject({ free: false, why: 'driving', settled: false });
  });

  it('counts sat resting as settled (she can remark) but not free', () => {
    expect(availabilityOf(idle({ state: 'resting', restingSat: true }))).toMatchObject({ free: false, settled: true, canRemark: true });
    expect(availabilityOf(idle({ state: 'resting', restingSat: false })).settled).toBe(false);
  });

  it('is busy with a job, and the first job in the list is the one it names', () => {
    expect(availabilityOf(idle({ jobs: { warmingAt: {}, carrying: true } }))).toMatchObject({ free: false, why: 'carrying something' });
  });

  it('lets a soft job give way when you ask her, but not a hard one', () => {
    expect(availabilityOf(idle({ jobs: { warmingAt: {} } }), { asked: true }).free).toBe(true);
    expect(availabilityOf(idle({ jobs: { carrying: true } }), { asked: true }).free).toBe(false);
  });

  it("is held by a feature that has her, and by the farm's holds unless you're asking", () => {
    expect(availabilityOf(idle({ holds: [['tea', 'making tea']] }))).toMatchObject({ free: false, why: 'making tea' });
    expect(availabilityOf(idle({ held: 'you have a menu open' }))).toMatchObject({ free: false, why: 'you have a menu open', canRemark: false });
    expect(availabilityOf(idle({ held: 'you have a menu open' }), { asked: true }).free).toBe(true);
  });

  it("doesn't count the asking feature's own job against her", () => {
    expect(availabilityOf(idle({ jobs: { hayFell: true } }), { mine: 'hayFell' }).free).toBe(true);
    expect(availabilityOf(idle({ holds: [['tea', 'making tea']] }), { mine: 'tea' }).free).toBe(true);
    expect(availabilityOf(idle({ jobs: { hayFell: true, carrying: true } }), { mine: 'hayFell' }).free).toBe(false);
  });

  it('names every job', () => {
    for (const [flag, why] of JOBS) {
      expect(flag).toMatch(/^[a-z][a-zA-Z]+$/);
      expect(why.length).toBeGreaterThan(3);
    }
  });
});

describe('availability when pulled', () => {
  const state = (name, extra = {}) => ({ state: name, jobs: {}, holds: [], held: null, ...extra });

  it('lets a big ask break into walking, sitting, driving and resting, but not into getting off', () => {
    for (const name of ['walking', 'seated', 'mounting', 'driving', 'resting']) {
      expect(availabilityOf(state(name), { asked: true }).free).toBe(false);
      expect(availabilityOf(state(name), { asked: true, pull: true }).free).toBe(true);
    }
    expect(availabilityOf(state('dismounting'), { asked: true, pull: true })).toMatchObject({ free: false, why: 'getting off' });
    expect(availabilityOf(state('thrown'), { asked: true, pull: true }).free).toBe(false);
  });

  it('still respects what she is doing that a request does not break', () => {
    expect(availabilityOf(state('walking', { jobs: { carrying: true } }), { asked: true, pull: true })).toMatchObject({ free: false, why: 'carrying something' });
  });
});
