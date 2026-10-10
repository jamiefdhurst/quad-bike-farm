import { describe, it, expect } from 'vitest';
import { nextBoredWait, driftRestlessness, pickBoredChoice, driveAppetite } from '../src/npc/boredom.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const P = DEFAULT_COMPANION_PARAMS;

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

const percentile = (list, q) => [...list].sort((a, b) => a - b)[Math.floor(q * (list.length - 1))];

describe('her boredom', () => {
  it('waits a widely different time each go, mostly half a minute to a minute and a half', () => {
    const random = seeded();
    const waits = Array.from({ length: 2000 }, () => nextBoredWait(P, 1, random));
    expect(Math.min(...waits)).toBeGreaterThanOrEqual(P.boredWaitFloor);
    expect(Math.max(...waits)).toBeLessThanOrEqual(P.boredWaitCeiling);
    expect(percentile(waits, 0.05)).toBeLessThan(28);
    expect(percentile(waits, 0.95)).toBeGreaterThan(130);
    expect(percentile(waits, 0.25)).toBeGreaterThan(30);
    expect(percentile(waits, 0.75)).toBeLessThan(100);
  });

  it('gets bored sooner when restless', () => {
    const calm = Array.from({ length: 500 }, (_, i) => nextBoredWait(P, 0.6, seeded(i + 1)));
    const restless = Array.from({ length: 500 }, (_, i) => nextBoredWait(P, 1.8, seeded(i + 1)));
    expect(percentile(restless, 0.5)).toBeLessThan(percentile(calm, 0.5) / 2);
  });

  it('drifts in restlessness, within bounds', () => {
    const random = seeded(3);
    let r = 1;
    let lo = 1;
    let hi = 1;
    for (let i = 0; i < 20 * 60 * 10; i++) {
      r = driftRestlessness(r, 0.1, P, random);
      lo = Math.min(lo, r);
      hi = Math.max(hi, r);
    }
    expect(lo).toBeGreaterThanOrEqual(0.5);
    expect(hi).toBeLessThanOrEqual(2);
    expect(hi - lo).toBeGreaterThan(0.5);
  });

  it('picks driving far more often the more confident she is, and never something she cannot do', () => {
    const share = (confidence) => {
      const random = seeded(11);
      let drives = 0;
      for (let i = 0; i < 4000; i++) if (pickBoredChoice(P, { confidence, can: { mount: true, start: true, drive: true } }, random) === 'drive') drives++;
      return drives / 4000;
    };
    const careful = share(0);
    const middling = share(0.5);
    const bold = share(1);
    expect(careful).toBeLessThan(0.12);
    expect(middling).toBeGreaterThan(0.15);
    expect(bold).toBeGreaterThan(0.45);
    expect(driveAppetite(1)).toBeGreaterThan(driveAppetite(0.5) * 2.5);
    const random = seeded(5);
    for (let i = 0; i < 500; i++) expect(pickBoredChoice(P, { confidence: 1, can: { mount: false, start: false, drive: false } }, random)).toBe('wander');
  });

  it('does something different from one time to the next', () => {
    const random = seeded(9);
    const picks = Array.from({ length: 400 }, () => pickBoredChoice(P, { confidence: 0.5, can: { mount: true, start: true, drive: true } }, random));
    for (const choice of ['mount', 'start', 'drive', 'wander']) expect(picks.filter((c) => c === choice).length).toBeGreaterThan(30);
  });
});

describe('buzz-seeking', () => {
  it('a girl keen on the shake picks a rough quad when one is about, and never when there is none', () => {
    const p = { ...DEFAULT_COMPANION_PARAMS, boredBuzzChance: 5, boredMountChance: 0, boredStartChance: 0, boredDriveChance: 0, boredWhim: 0 };
    let buzz = 0;
    for (let i = 0; i < 200; i++) if (pickBoredChoice(p, { can: { buzz: true } }) === 'buzz') buzz++;
    expect(buzz).toBeGreaterThan(150);
    for (let i = 0; i < 200; i++) expect(pickBoredChoice(p, { can: { buzz: false } })).not.toBe('buzz');
  });

  it('Jess is keener than Amy, and the default is off', () => {
    expect(CHARACTERS.find((c) => c.id === 'jess').params.boredBuzzChance).toBeGreaterThan(CHARACTERS.find((c) => c.id === 'amy').params.boredBuzzChance);
    expect(DEFAULT_COMPANION_PARAMS.boredBuzzChance).toBe(0);
  });
});
