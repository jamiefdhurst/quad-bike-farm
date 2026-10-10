import { describe, it, expect } from 'vitest';
import { sickness, sickEvidence, letGoStalls, KeepAlive, DEFAULT_KEEPALIVE_PARAMS as P } from '../src/npc/keepAlive.js';
import { AMY_KEEP_LINES, JESS_KEEP_LINES } from '../src/npc/keepAliveLines.js';

const well = { cranks: 0, fouling: 0, battery: 1, wear: 0.1, chokeCreeps: false, erratic: 0 };

describe('what makes a quad sick', () => {
  it('a healthy one is not', () => {
    expect(sickness(well).sick).toBe(false);
  });

  it('any one heavy cause does it: a hard start, heavy wear, a creeping choke', () => {
    expect(sickness({ ...well, cranks: 3 }).reasons).toEqual(['hardStart']);
    expect(sickness({ ...well, cranks: 3 }).sick).toBe(true);
    expect(sickness({ ...well, wear: 0.7 }).sick).toBe(true);
    expect(sickness({ ...well, chokeCreeps: true }).sick).toBe(true);
  });

  it('a light cause alone is not enough, but two are', () => {
    expect(sickness({ ...well, fouling: 0.5 }).sick).toBe(false);
    expect(sickness({ ...well, battery: 0.2 }).sick).toBe(false);
    const both = sickness({ ...well, fouling: 0.5, battery: 0.2 });
    expect(both.sick).toBe(true);
    expect(both.reasons).toEqual(['fouled', 'weakBattery']);
  });

  it('is capped at 1', () => {
    expect(sickness({ cranks: 5, fouling: 1, battery: 0, wear: 1, chokeCreeps: true, erratic: 1 }).score).toBe(1);
  });

  it('reads a quad', () => {
    const quad = { startTrouble: 2, engine: { fouling: 0.1, battery: 0.9, wear: 0.2, erratic: 0 }, quirks: { has: (k) => k === 'chokeCreeps' } };
    expect(sickEvidence(quad)).toMatchObject({ cranks: 2, chokeCreeps: true, battery: 0.9 });
  });
});

describe('the hand on the throttle', () => {
  const ctx = (o = {}) => ({ id: 'jess', running: true, sick: true, score: 0.8, unattended: true, rpm: 1500, idleRpm: 1500, youDistance: 20, ...o });
  const steps = (ka, seconds, c) => {
    const events = [];
    for (let t = 0; t < seconds; t += 0.1) events.push(...ka.update(0.1, typeof c === 'function' ? c() : c));
    return events;
  };

  it('sits down once and holds a throttle above idle when the revs are short of the fast idle', () => {
    const ka = new KeepAlive({ random: () => 0.99 });
    const ev = steps(ka, 1, ctx());
    expect(ev.filter((e) => e.type === 'sit')).toHaveLength(1);
    expect(ka.holding).toBe(true);
    const low = ka.throttle;
    ka.update(0.1, ctx({ rpm: 1500 * P.fastIdle + 200 }));
    expect(ka.throttle).toBeLessThan(low);
    expect(ka.throttle).toBeGreaterThanOrEqual(P.holdBase);
  });

  it('catches it when it falters, and not again straight away', () => {
    const ka = new KeepAlive({ random: () => 0.99 });
    steps(ka, 1, ctx());
    const ev = steps(ka, 1, ctx({ rpm: 900 }));
    expect(ev.filter((e) => e.type === 'catch')).toHaveLength(1);
    expect(ka.throttle).toBe(1);
  });

  it('Jess owns up after a while; Amy only if you are near, and then only once', () => {
    const jess = new KeepAlive({ random: () => 0.99 });
    expect(steps(jess, P.truthAfterJess - 5, ctx()).some((e) => e.type === 'truth')).toBe(false);
    expect(steps(jess, 10, ctx()).filter((e) => e.type === 'truth')).toHaveLength(1);
    expect(steps(jess, 10, ctx()).some((e) => e.type === 'truth')).toBe(false);

    const far = new KeepAlive({ random: () => 0.99 });
    expect(steps(far, P.truthAfterAmy + 10, ctx({ id: 'amy', youDistance: 30 })).some((e) => e.type === 'truth')).toBe(false);
    const near = new KeepAlive({ random: () => 0.99 });
    steps(near, P.truthAfterAmy + 5, ctx({ id: 'amy', youDistance: 30 }));
    expect(steps(near, 1, ctx({ id: 'amy', youDistance: 2 })).filter((e) => e.type === 'truth')).toHaveLength(1);
  });

  it('lets go when you take it, and a sick one she has held for a while may die', () => {
    const ka = new KeepAlive({ random: () => 0.1 });
    steps(ka, 10, ctx());
    const ev = ka.update(0.1, ctx({ unattended: false }));
    expect(ev).toEqual([{ type: 'letGo', heldFor: expect.any(Number), stalls: true }]);
    expect(ka.holding).toBe(false);
    expect(ka.throttle).toBe(0);

    const lucky = new KeepAlive({ random: () => 0.99 });
    steps(lucky, 10, ctx());
    expect(lucky.update(0.1, ctx({ unattended: false }))[0].stalls).toBe(false);
  });

  it('a hold shorter than letGoAfter never costs the quad', () => {
    expect(letGoStalls(1, P.letGoAfter - 1, () => 0, P)).toBe(false);
    expect(letGoStalls(1, P.letGoAfter + 1, () => 0, P)).toBe(true);
    expect(letGoStalls(0, 100, () => 0, P)).toBe(false);
  });

  it('says so if it dies under her', () => {
    const ka = new KeepAlive({ random: () => 0.99 });
    steps(ka, 2, ctx());
    expect(ka.update(0.1, ctx({ running: false })).map((e) => e.type)).toEqual(['died']);
    expect(ka.holding).toBe(false);
  });

  it('gives up after a long sit, mostly without switching it off, then cools off before going again', () => {
    const ka = new KeepAlive({ random: () => 0.5 });
    let up;
    for (let t = 0; t < P.giveUpAfter + 5 && !up; t += 0.1) up = ka.update(0.1, ctx()).find((e) => e.type === 'giveUp'); // she gets off here
    expect(up).toBeTruthy();
    expect(up.keyOff).toBe(false);
    expect(ka.holding).toBe(false);
    const go = { sick: true, running: true, unattended: true, distance: 5 };
    expect(ka.wouldGo(go)).toBe(false);
    ka.cool(P.cooldown + 1);
    expect(ka.wouldGo(go)).toBe(true);
    expect(ka.wouldGo({ ...go, sick: false })).toBe(false);
    expect(ka.wouldGo({ ...go, distance: P.goRange + 1 })).toBe(false);
  });

  it('does nothing for a healthy quad', () => {
    const ka = new KeepAlive();
    expect(steps(ka, 5, ctx({ sick: false }))).toEqual([]);
    expect(ka.holding).toBe(false);
  });
});

describe('her lines', () => {
  it('both girls have every one, and neither calls you he, she or they', () => {
    for (const key of Object.keys(AMY_KEEP_LINES)) {
      expect(JESS_KEEP_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_KEEP_LINES[key].lines.length).toBeGreaterThan(0);
    }
    const all = [...Object.values(AMY_KEEP_LINES).flatMap((l) => l.lines), ...Object.values(JESS_KEEP_LINES).flat()].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
