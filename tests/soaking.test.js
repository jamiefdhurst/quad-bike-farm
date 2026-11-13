import { describe, it, expect } from 'vitest';
import { DEFAULT_SOAK_PARAMS as P, SOAK_PARAM_RANGES, createSoak, updateSoak, soakNoticing, soakRemarked, dryOff, underCover } from '../src/npc/soaking.js';
import { Needs } from '../src/npc/needs.js';
import { DEFAULT_COMPANION_PARAMS as CP } from '../src/npc/companionParams.js';
import { waitingChoices } from '../src/npc/waiting.js';

const open = { rain: 0, coat: false, jumper: false, covered: false, warmed: false, chill: 0.8, hosed: 0 };
const run = (s, seconds, ctx) => {
  for (let t = 0; t < seconds; t += 0.5) updateSoak(s, 0.5, { ...open, ...ctx }, P);
  return s;
};

describe('getting soaked and cold', () => {
  it('has a range for every param', () => {
    expect(Object.keys(SOAK_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('soaks more the longer and harder it rains, and stays within 0..1', () => {
    const light = run(createSoak(), 30, { rain: 0.4 }).soak;
    const hard = run(createSoak(), 30, { rain: 1 }).soak;
    expect(hard).toBeGreaterThan(light);
    expect(light).toBeGreaterThan(0.05);
    const long = run(createSoak(), 600, { rain: 1 });
    expect(long.soak).toBeLessThanOrEqual(1);
    expect(long.hair).toBeLessThanOrEqual(1);
  });

  it('takes about a minute and a half of hard rain to be wet through', () => {
    expect(run(createSoak(), 90, { rain: 1 }).soak).toBeGreaterThan(0.6);
  });

  it('a drizzle, or being under a roof, soaks nothing; a wax jacket nearly nothing', () => {
    expect(run(createSoak(), 120, { rain: P.rainAbove }).soak).toBe(0);
    expect(run(createSoak(), 120, { rain: 0, covered: true }).soak).toBe(0);
    expect(run(createSoak(), 60, { rain: 1, coat: true }).soak).toBeLessThan(run(createSoak(), 60, { rain: 1 }).soak * 0.15);
  });

  it('the hair wets faster than the rest and dries last', () => {
    const s = run(createSoak(), 60, { rain: 1 });
    expect(s.hair).toBeGreaterThan(s.soak);
    const before = { soak: s.soak, hair: s.hair };
    run(s, 12, { warmed: true });
    expect(s.soak).toBeLessThan(before.soak);
    expect(before.hair - s.hair).toBeLessThan(before.soak - s.soak);
    expect(s.hair).toBeGreaterThanOrEqual(s.soak);
  });

  it('dries slowly in the open, quicker under cover and quickest by a fire or heater', () => {
    const after = (ctx) => run(Object.assign(createSoak(), { soak: 0.9, hair: 0.9 }), 60, ctx).soak;
    expect(after({})).toBeLessThan(0.9);
    expect(after({ covered: true })).toBeLessThan(after({}));
    expect(after({ covered: true, warmed: true })).toBeLessThan(after({ covered: true }));
  });

  it('does not dry while it is still raining on her', () => {
    const s = Object.assign(createSoak(), { soak: 0.5, hair: 0.5 });
    run(s, 10, { rain: 0.5, warmed: true });
    expect(s.soak).toBeGreaterThan(0.5);
  });

  it('the hose soaks her through', () => {
    expect(run(createSoak(), 5, { hosed: 1 }).soak).toBeGreaterThan(0.9);
  });

  it('gets cold only once soaked, colder on a cold day, less in a jumper or by a fire', () => {
    expect(run(createSoak(), 10, { rain: 1, chill: 1 }).cold).toBe(0);
    const soaked = () => Object.assign(createSoak(), { soak: 1, hair: 1 });
    const cold = updateSoak(soaked(), 0, { ...open, chill: 1 }, P).cold;
    expect(cold).toBeCloseTo(1);
    expect(updateSoak(soaked(), 0, { ...open, chill: 0 }, P).cold).toBeCloseTo(P.coldFloor);
    expect(updateSoak(soaked(), 0, { ...open, chill: 1, jumper: true }, P).cold).toBeLessThan(cold);
    expect(updateSoak(soaked(), 0, { ...open, chill: 1, warmed: true }, P).cold).toBeLessThan(0.2);
  });

  it('she says so once, then not again until she has dried and the gap has passed', () => {
    const s = Object.assign(createSoak(), { soak: 0.9, hair: 0.9 });
    updateSoak(s, 1, open, P);
    expect(soakNoticing(s, P)).toBe('cold');
    soakRemarked(s, 'cold');
    expect(soakNoticing(s, P)).toBeNull();
    updateSoak(s, P.remarkGap + 1, { ...open, rain: 1 }, P);
    expect(soakNoticing(s, P)).toBeNull(); // still the same soaking
    dryOff(s);
    expect(s).toMatchObject({ soak: 0, hair: 0, cold: 0 });
    s.soak = 0.5;
    expect(soakNoticing(s, P)).toBe('wet');
  });
});

describe('what being soaked does to her', () => {
  const still = { chill: 0, wet: false, warmed: false, alone: false, together: false, thrill: 0, active: false, sitting: false, idle: false, purposeRate: 0, withFriend: false, youNear: false, youWithFriend: false };

  it('keeps her wanting somewhere warm on a mild day, and a fire eases it', () => {
    const n = new Needs();
    for (let t = 0; t < 20; t += 0.5) n.update(0.5, { ...still, cold: 1 }, CP);
    expect(n.warmth).toBeGreaterThan(0.5);
    for (let t = 0; t < 20; t += 0.5) n.update(0.5, { ...still, warmed: true }, CP);
    expect(n.warmth).toBeLessThan(0.3);
  });

  it('has her stand shivering when she is cold from the rain, and not otherwise', () => {
    const quiet = { wheel: null, seat: null, chill: 0, sun: 0.3, clouding: 0, wet: false };
    const names = (ctx) => waitingChoices(['folded'], { ...quiet, ...ctx }).map((c) => c.name);
    expect(names({ shiver: 0 })).not.toContain('shiver');
    expect(names({ shiver: 0.8 })).toContain('shiver');
    const w = (shiver) => waitingChoices(['folded'], { ...quiet, shiver }).find((c) => c.name === 'shiver').weight;
    expect(w(1)).toBeGreaterThan(w(0.3));
  });
});

describe('out of the rain aboard a vehicle with a cab (found testing #512)', () => {
  it('keeps her dry in the Tor and the Crag, the UTV and the cars, but not on a quad or the tractor', () => {
    for (const id of ['tor', 'crag', 'yak', 'finch', 'griffin', 'vauclair']) expect(underCover({ aboardSpec: id }), id).toBe(true);
    for (const id of ['farm300', 'tz65', 'hartley']) expect(underCover({ aboardSpec: id }), id).toBe(false);
  });

  it('is still cover in the barn, the hut or a cab she sheltered in, and none on foot', () => {
    expect(underCover({ inBarn: true })).toBe(true);
    expect(underCover({ inHut: true })).toBe(true);
    expect(underCover({ inCab: true })).toBe(true);
    expect(underCover({})).toBe(false);
  });
});
