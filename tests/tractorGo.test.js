import { describe, it, expect } from 'vitest';
import { TractorGo, DEFAULT_TRACTORGO_PARAMS as P } from '../src/npc/tractorGo.js';

const ctx = (over = {}) => ({ free: { amy: true, jess: true }, tractorFree: true, youOnTractor: false, ...over });
const make = (random = () => 0, over = {}) => new TractorGo({ ...P, ...over }, random);
/** Seconds go by; each one Jess takes a go if she's offered it (as a chooser that always says yes). */
function run(g, seconds, c = ctx()) {
  const events = [];
  for (let t = 0; t < seconds; t += 1) {
    events.push(...g.update(1, c));
    const offer = g.offers(c)[0];
    if (offer) {
      events.push(g.take(offer));
      g.started('jess');
    }
  }
  return events;
}

describe('Jess', () => {
  it('never takes it on its own: that is the chooser\'s', () => {
    const g = make();
    for (let t = 0; t < P.jessAfter + 50; t++) expect(g.update(1, ctx())).toEqual([]);
    expect(g.offers(ctx())).toEqual([{ key: 'bigGo', girl: 'jess', vehicle: 'tractor', weight: P.jessWeight }]);
  });

  it('leaves it alone at first, then takes it', () => {
    const g = make();
    expect(run(g, P.jessAfter - 5)).toEqual([]);
    expect(run(g, 20).map((e) => e.type)).toContain('jessGo');
  });

  it('waits her turn between goes', () => {
    const g = make();
    run(g, P.jessAfter + 5);
    g.started('jess');
    expect(run(g, P.jessEvery - 10)).toEqual([]);
    expect(run(g, 20).some((e) => e.type === 'jessGo')).toBe(true);
  });

  it('does not take it while you are on it, it is spoken for, or she is busy', () => {
    for (const c of [ctx({ youOnTractor: true }), ctx({ tractorFree: false }), ctx({ free: { amy: false, jess: false } })]) {
      expect(run(make(), P.jessAfter + 100, c)).toEqual([]);
    }
  });
});

describe('Amy', () => {
  it('refuses until her day, and takes it when asked after', () => {
    const g = make();
    expect(g.ask('jess')).toBe('ok');
    expect(g.ask('amy')).toBe('refuse');
    g.amyCan = true;
    expect(g.ask('amy')).toBe('ok');
  });

  it('has her day once enough time has gone and Jess has had a go, and only once', () => {
    const g = make(() => 1, { amyDayAfter: 100 });
    const jessBusy = ctx({ free: { amy: true, jess: false } });
    expect(run(g, 150, jessBusy)).toEqual([]); // Jess has had no go yet
    g.started('jess');
    run(g, 40, jessBusy); // not long enough since
    expect(g.amyCan).toBe(false);
    const events = run(g, 100, jessBusy);
    expect(events.filter((e) => e.type === 'amyDay')).toHaveLength(1);
    expect(g.amyCan).toBe(true);
    expect(run(g, 500, jessBusy).filter((e) => e.type === 'amyDay')).toEqual([]);
  });

  it('does not have her day with you on the tractor or her busy', () => {
    const g = make(() => 1, { amyDayAfter: 0, amyDayJessGoes: 0, amyDayGap: 0 });
    expect(run(g, 50, ctx({ youOnTractor: true }))).toEqual([]);
    expect(run(g, 50, ctx({ free: { amy: false, jess: true } }))).toEqual([]);
  });
});

describe('the UTV and the Tor or Crag', () => {
  const vc = (vehicles) => ({ free: { amy: true, jess: true }, vehicles, youOnTractor: false });

  it('Jess picks one of the free vehicles', () => {
    const picks = (random) => run(make(random), P.jessAfter + 20, vc(['tractor', 'utv', 'tor'])).find((e) => e.type === 'jessGo')?.vehicle;
    expect(picks(() => 0)).toBe('tractor');
    expect(picks(() => 0.5)).toBe('utv');
    expect(picks(() => 0.999)).toBe('tor');
  });

  it('only picks from the ones nobody is on', () => {
    const e = run(make(() => 0.9), P.jessAfter + 20, vc(['utv'])).find((x) => x.type === 'jessGo');
    expect(e.vehicle).toBe('utv');
  });

  it('does nothing when none are free', () => {
    expect(run(make(), P.jessAfter + 100, vc([]))).toEqual([]);
  });

  it('one day for Amy covers all three', () => {
    const g = make(() => 0, { amyDayAfter: 0, amyDayJessGoes: 0, amyDayGap: 0 });
    const e = run(g, 5, vc(['tor'])).find((x) => x.type === 'amyDay');
    expect(e.vehicle).toBe('tor');
    expect(g.ask('amy')).toBe('ok');
  });
});
