import { describe, it, expect } from 'vitest';
import { Needs, NEEDS } from '../src/npc/needs.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';

const still = { chill: 0, wet: false, warmed: false, alone: false, together: false, thrill: 0, active: false, sitting: false, idle: false, purposeRate: 0, withFriend: false, youNear: false, youWithFriend: false };
const run = (n, seconds, ctx, p = P) => {
  for (let t = 0; t < seconds; t += 0.5) n.update(0.5, { ...still, ...ctx }, p);
  return n;
};

describe('needs', () => {
  it('start met and stay between 0 and 1', () => {
    const n = new Needs();
    for (const k of NEEDS) expect(n[k]).toBe(0);
    run(n, 2000, { chill: 1, wet: true, alone: true, active: true, idle: true, purposeRate: 1 });
    for (const k of NEEDS) expect(n[k]).toBeLessThanOrEqual(1);
  });

  it('the cold builds outside, faster in the rain, and goes once she warms up', () => {
    const dry = run(new Needs(), 10, { chill: 1 }).warmth;
    const wet = run(new Needs(), 10, { chill: 1, wet: true }).warmth;
    expect(dry).toBeGreaterThan(0.2);
    expect(wet).toBeGreaterThan(dry);
    expect(run(new Needs({ warmth: 0.8 }), 10, { chill: 1, warmed: true }).warmth).toBeLessThan(0.8);
    expect(run(new Needs({ warmth: 0.5 }), 20, {}).warmth).toBeLessThan(0.5); // a mild day, it fades anyway
  });

  it('she gets lonely on her own and not with someone close', () => {
    expect(run(new Needs(), 100, { alone: true }).company).toBeGreaterThan(0.3);
    expect(run(new Needs({ company: 0.6 }), 10, { together: true }).company).toBeLessThan(0.6);
  });

  it('jealousy builds with her friend and you away, faster when you are with the friend, and goes when you come over', () => {
    const away = run(new Needs(), 60, { withFriend: true }).attention;
    const friend = run(new Needs(), 60, { withFriend: true, youWithFriend: true }).attention;
    expect(away).toBeGreaterThan(0.2);
    expect(friend).toBeGreaterThan(away * 2);
    expect(run(new Needs({ attention: 0.8 }), 10, { withFriend: true, youNear: true }).attention).toBeLessThan(0.4);
    expect(run(new Needs(), 300, { withFriend: false }).attention).toBe(0); // alone, nothing to be jealous of
    expect(run(new Needs({ attention: 0.6 }), 30, {}).attention).toBeGreaterThan(0.4); // fades slowly
  });

  it('being slighted bumps it and being talked to eases it', () => {
    const n = new Needs();
    n.slighted(0.3);
    expect(n.attention).toBeCloseTo(0.3);
    n.noticed(0.5);
    expect(n.attention).toBe(0);
  });

  it('excitement creeps up and going fast or a good shake meets it', () => {
    expect(run(new Needs(), 150, {}).excitement).toBeGreaterThan(0.25);
    expect(run(new Needs({ excitement: 0.6 }), 10, { thrill: 1 }).excitement).toBeLessThan(0.3);
  });

  it('she tires on the go and rests sitting down', () => {
    expect(run(new Needs(), 100, { active: true }).rest).toBeGreaterThan(0.3);
    expect(run(new Needs({ rest: 0.6 }), 10, { sitting: true }).rest).toBeLessThan(0.6);
  });

  it('wanting something to do builds at her pace while she stands about, and fades while she is busy', () => {
    expect(run(new Needs(), 30, { idle: true, purposeRate: 1 / 60 }).purpose).toBeCloseTo(0.5, 1);
    expect(run(new Needs({ purpose: 0.6 }), 4, {}).purpose).toBeLessThan(0.6);
  });

  it('names the most pressing, and getting what she chose meets it', () => {
    const n = new Needs({ warmth: 0.8, purpose: 0.5 });
    expect(n.top()).toEqual({ need: 'warmth', level: 0.8 });
    n.met({ warmth: 1 });
    expect(n.warmth).toBeLessThan(0.8);
    expect(n.purpose).toBe(0);
  });

  it('Jess gets restless sooner and Amy feels the cold sooner', () => {
    const of = (id) => ({ ...P, ...CHARACTERS.find((c) => c.id === id).params });
    expect(of('jess').needThrillRise).toBeGreaterThan(of('amy').needThrillRise);
    expect(of('amy').needColdRise).toBeGreaterThan(of('jess').needColdRise);
  });
});
