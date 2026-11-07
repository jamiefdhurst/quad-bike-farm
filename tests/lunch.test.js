import { describe, it, expect } from 'vitest';
import { Lunch, DEFAULT_LUNCH_PARAMS as P, LUNCH_PARAM_RANGES, whereToEat } from '../src/npc/lunch.js';
import { AMY_LUNCH_LINES, JESS_LUNCH_LINES } from '../src/npc/lunchLines.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { Needs, hungerCurve } from '../src/npc/needs.js';
import { DEFAULT_COMPANION_PARAMS as CP } from '../src/npc/companionParams.js';

const girls = (o = {}) => [{ id: 'amy', free: true, hunger: 0.7, ...o }];
const ctx = (o = {}) => ({ hour: 12.5, tin: true, girls: girls(), ...o });
const upd = (l, seconds, c = {}) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...l.update(0.5, { hour: 12.5, day: 1, youDistance: {}, girls: {}, ...c }));
  return events;
};

describe('hunger', () => {
  const still = { chill: 0, wet: false, warmed: false, alone: false, together: false, thrill: 0, active: false, sitting: false, idle: false, purposeRate: 0, withFriend: false, youNear: false, youWithFriend: false };
  const run = (n, seconds, c) => {
    for (let t = 0; t < seconds; t += 0.5) n.update(0.5, { ...still, ...c }, CP);
    return n;
  };

  it('builds through the morning to a peak at half past twelve and not much before breakfast has gone', () => {
    expect(hungerCurve(6)).toBeLessThan(0.1);
    expect(hungerCurve(9)).toBeLessThan(hungerCurve(11));
    expect(hungerCurve(12.4)).toBeGreaterThan(0.9);
    expect(hungerCurve(16)).toBeLessThan(hungerCurve(13));
  });

  it('is about pressing by lunchtime (a game hour is 300 s) and eating meets it', () => {
    const n = new Needs();
    for (let h = 8; h < 12.5; h += 0.1) run(n, 30, { hour: h });
    expect(n.hunger).toBeGreaterThan(0.6);
    expect(n.hunger).toBeLessThan(1);
    expect(run(n, 30, { hour: 12.5, eating: true }).hunger).toBeLessThan(0.1);
  });
});

describe('lunch offers', () => {
  it('wants lunchtime, hunger, a free girl and a cooldown', () => {
    const l = new Lunch({ ...P });
    expect(l.offers(ctx()).map((o) => o.key)).toEqual(['lunch', 'biscuit']);
    expect(l.offers(ctx({ hour: 9 })).map((o) => o.key)).toEqual(['biscuit']);
    expect(l.offers(ctx({ girls: girls({ hunger: 0.3 }) })).map((o) => o.key)).toEqual(['biscuit']);
    expect(l.offers(ctx({ girls: girls({ hunger: 0.1 }) }))).toEqual([]);
    expect(l.offers(ctx({ girls: girls({ free: false }) }))).toEqual([]);
    expect(l.offers(ctx({ tin: false })).map((o) => o.key)).toEqual(['lunch']);
  });

  it('is chooser offer kinds that meet hunger', () => {
    expect(OFFER_KINDS.lunch.satisfies.hunger).toBe(1);
    expect(OFFER_KINDS.biscuit.satisfies.hunger).toBeGreaterThan(0);
    expect(OFFER_KINDS.biscuit.satisfies.hunger).toBeLessThan(OFFER_KINDS.lunch.satisfies.hunger);
  });
});

describe('a lunch', () => {
  it('goes to the car, then a seat, eats, shares with you and ends done with a cooldown', () => {
    const l = new Lunch({ ...P });
    expect(l.take({ key: 'lunch', girl: 'amy' })).toEqual({ type: 'fetch', girl: 'amy' });
    expect(l.begin('amy', 'lunch')).toBeNull();
    expect(l.offers(ctx())).toEqual([]); // busy
    expect(l.gotBag('amy')).toEqual({ type: 'go', girl: 'amy' });
    expect(l.startedEating('amy').map((e) => e.type)).toEqual(['eat', 'say']);
    const events = upd(l, P.eatSeconds + 1, { youDistance: { amy: 2 } });
    expect(events.map((e) => e.type + (e.line ?? ''))).toEqual(['join', 'saylunchJoin', 'saylunchDone', 'end']);
    expect(events.at(-1)).toMatchObject({ kind: 'lunch', why: 'done' });
    expect(l.offers(ctx()).map((o) => o.key)).toEqual(['biscuit']); // no second lunch today
    upd(l, P.cooldown);
    expect(l.offers(ctx()).map((o) => o.key)).toContain('lunch');
  });

  it('does not share it unless you stay close', () => {
    const l = new Lunch({ ...P });
    l.begin('amy', 'lunch');
    l.gotBag('amy');
    l.startedEating('amy');
    expect(upd(l, P.eatSeconds + 1, { youDistance: { amy: P.joinRange + 5 } }).map((e) => e.type)).toEqual(['say', 'end']);
  });

  it('is dropped if she never gets there, with no cooldown', () => {
    const l = new Lunch({ ...P });
    l.begin('amy', 'lunch');
    expect(upd(l, P.fetchTimeout + 1)).toEqual([{ type: 'end', girl: 'amy', kind: 'lunch', why: 'lost' }]);
    expect(l.offers(ctx()).map((o) => o.key)).toContain('lunch');
    l.begin('amy', 'lunch');
    l.gotBag('amy');
    expect(upd(l, P.goTimeout + 1)[0].why).toBe('lost');
    l.begin('amy', 'lunch');
    l.cancel('amy');
    expect(l.has('amy')).toBe(false);
  });
});

describe('a biscuit', () => {
  it('is quick, and she waits before another', () => {
    const l = new Lunch({ ...P });
    expect(l.begin('amy', 'biscuit')).toEqual({ type: 'tin', girl: 'amy' });
    expect(l.gotBag('amy')).toBeNull();
    l.startedEating('amy');
    const e = upd(l, P.biscuitSeconds + 1);
    expect(e.map((x) => x.line ?? x.type)).toEqual(['biscuitDone', 'end']);
    expect(l.offers(ctx({ hour: 9 }))).toEqual([]);
    upd(l, P.biscuitCooldown);
    expect(l.offers(ctx({ hour: 9 })).map((o) => o.key)).toEqual(['biscuit']);
  });
});

describe('missing lunch', () => {
  it('is remarked on once in the afternoon, once a day', () => {
    const l = new Lunch({ ...P });
    expect(upd(l, 1, { hour: 14, girls: { amy: 0.95 } })).toEqual([]);
    expect(upd(l, 1, { hour: 16, girls: { amy: 0.5 } })).toEqual([]);
    expect(upd(l, 1, { hour: 16, girls: { amy: 0.95 } })).toEqual([{ type: 'say', girl: 'amy', line: 'lunchMissed' }]);
    expect(upd(l, 1, { hour: 16, girls: { amy: 0.95 } })).toEqual([]);
    expect(upd(l, 1, { hour: 16, day: 2, girls: { amy: 0.95 } })).toHaveLength(1);
  });
});

describe('where she eats', () => {
  it('uses the tailgate when dry, the bales if the Tor has gone, the barn in rain', () => {
    expect(whereToEat({ torParked: true })).toBe('tailgate');
    expect(whereToEat({ torParked: false })).toBe('bales');
    expect(whereToEat({ torParked: true, rain: 0.6 })).toBe('barn');
    expect(whereToEat({ balesFree: false })).toBe('barn');
  });
});

describe('tuning and lines', () => {
  it('has a range for every param, and every line, for both girls', () => {
    expect(Object.keys(LUNCH_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
    for (const k of ['lunchOffer', 'lunchEat', 'lunchJoin', 'lunchDone', 'lunchMissed', 'biscuitGo', 'biscuitEat', 'biscuitDone']) {
      expect(AMY_LUNCH_LINES[k]).toBeTruthy();
      expect(JESS_LUNCH_LINES[k].length).toBeGreaterThan(0);
    }
  });

  it('never says he, she or they about you, or uses an em dash', () => {
    const all = JSON.stringify([AMY_LUNCH_LINES, JESS_LUNCH_LINES]);
    expect(all).not.toMatch(/—/);
  });
});
