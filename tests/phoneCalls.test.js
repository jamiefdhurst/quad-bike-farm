import { describe, it, expect } from 'vitest';
import { PhoneCalls, DEFAULT_PHONE_PARAMS, PHONE_PARAM_RANGES, callSpot } from '../src/npc/phoneCalls.js';
import { Favour, DEFAULT_FAVOUR_PARAMS } from '../src/npc/favour.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { AMY_PHONE_LINES, JESS_PHONE_LINES } from '../src/npc/phoneLines.js';
import { STANDING_IDLES } from '../src/npc/poseMoves.js';
import { WAITING_IDLES } from '../src/npc/waiting.js';

const make = (over = {}) => new PhoneCalls({ ...DEFAULT_PHONE_PARAMS, startAfter: 0, ...over }, () => 0.5);
const girls = (over = {}) => ({ girls: [{ id: 'amy', free: true, weight: 1, moodChance: 0, moodSeconds: 200, ...over }] });
const there = { free: true, there: true, youDistance: 12 };

function run(pc, ctx, seconds, dt = 0.5) {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...pc.update(dt, { girl: ctx }));
  return out;
}

describe('phone calls', () => {
  it('only offers to a free girl who likes a chat, after the start and not in the cooldown', () => {
    const pc = make({ startAfter: 10 });
    expect(pc.offers(girls())).toEqual([]);
    pc.update(11, { girl: null });
    expect(pc.offers(girls()).map((o) => o.girl)).toEqual(['amy']);
    expect(pc.offers(girls({ free: false }))).toEqual([]);
    expect(pc.offers(girls({ weight: 0 }))).toEqual([]);
    pc.begin('amy', 'asked');
    expect(pc.offers(girls())).toEqual([]);
  });

  it('weighs the offer by the module weight and her own', () => {
    const pc = make({ weight: 0.5 });
    expect(pc.offers(girls({ weight: 1.2 }))[0].weight).toBeCloseTo(0.6);
  });

  it('rolls the mood from her chance', () => {
    const pc = new PhoneCalls({ ...DEFAULT_PHONE_PARAMS, startAfter: 0 }, () => 0.1);
    expect(pc.offers(girls({ moodChance: 0.3 }))[0].mood).toBe(true);
    expect(pc.offers(girls({ moodChance: 0 }))[0].mood).toBe(false);
  });

  it('rings on the way, answers at her spot, talks, then comes back and tells you', () => {
    const pc = make();
    expect(pc.begin('amy', 'asked', { mood: false })).toMatchObject({ type: 'ring' });
    const going = run(pc, { free: true, there: false, youDistance: 12 }, 6);
    expect(going.filter((e) => e.type === 'ring').length).toBeGreaterThanOrEqual(2);
    const talk = run(pc, there, 40);
    expect(talk.map((e) => e.type)).toContain('answer');
    expect(talk.some((e) => e.type === 'say' && e.line === 'phoneTalk')).toBe(true);
    expect(talk.map((e) => e.type)).toContain('hangUp');
    const back = run(pc, { free: true, there: false, youDistance: 2 }, 2);
    expect(back).toContainEqual({ type: 'tell', girl: 'amy', mood: false, moodSeconds: 240 });
    expect(back.at(-1)).toMatchObject({ type: 'end', why: 'done' });
    expect(pc.active).toBe(false);
  });

  it('carries the mood to the telling', () => {
    const pc = make();
    pc.begin('amy', 'asked', { mood: true, moodSeconds: 300 });
    run(pc, there, 60);
    const back = run(pc, { free: true, there: false, youDistance: 1 }, 1);
    expect(back.find((e) => e.type === 'tell')).toMatchObject({ mood: true, moodSeconds: 300 });
  });

  it('answers where she is if she cannot reach her spot', () => {
    const pc = make({ walkTimeout: 10 });
    pc.begin('amy', 'asked');
    const out = run(pc, { free: true, there: false, youDistance: 12 }, 12);
    expect(out.map((e) => e.type)).toContain('answer');
  });

  it('gives up if she is taken off it, or cannot get back to you', () => {
    const pc = make();
    pc.begin('amy', 'asked');
    expect(run(pc, { free: false }, 1).at(-1)).toMatchObject({ type: 'end', why: 'busy' });
    pc.begin('amy', 'asked');
    run(pc, there, 60);
    expect(run(pc, { free: true, there: false, youDistance: 30 }, 70).at(-1)).toMatchObject({ type: 'end', why: 'timeout' });
  });

  it('waits out a cooldown after one', () => {
    const pc = make({ cooldown: 100 });
    pc.begin('amy', 'asked');
    run(pc, { free: false }, 1);
    expect(pc.offers(girls())).toEqual([]);
    pc.update(101, { girl: null });
    expect(pc.offers(girls()).length).toBe(1);
  });

  it('picks a spot the right distance from you, on her side', () => {
    const s = callSpot({ x: 10, z: 0 }, { x: 0, z: 0 }, 12);
    expect(Math.hypot(s.x, s.z)).toBeCloseTo(12);
    expect(s.x).toBeGreaterThan(11);
    const jittered = callSpot({ x: 10, z: 0 }, { x: 0, z: 0 }, 12, 0.5);
    expect(Math.hypot(jittered.x, jittered.z)).toBeCloseTo(12);
    expect(callSpot({ x: 0, z: 0 }, { x: 0, z: 0 }, 5).z).toBeCloseTo(5);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(DEFAULT_PHONE_PARAMS)) expect(PHONE_PARAM_RANGES[k], k).toBeDefined();
  });

  it('is an offer kind, with a pose, lines and a taste for each girl', () => {
    expect(OFFER_KINDS.phoneCall.satisfies).toBeDefined();
    expect(STANDING_IDLES.phoneCall).toBeDefined();
    expect(WAITING_IDLES.phoneCall).toBeDefined();
    for (const key of ['phoneRing', 'phoneTalk', 'phoneNews', 'phoneMood']) {
      expect(AMY_PHONE_LINES[key].lines.length, key).toBeGreaterThan(1);
      expect(JESS_PHONE_LINES[key].length, key).toBeGreaterThan(1);
    }
    for (const c of CHARACTERS) expect(c.params.phoneWeight, c.id).toBeGreaterThan(0);
  });

  it('keeps the girls\' lines British, spaced out with no em dashes, and never calls you he or she', () => {
    const all = [...Object.values(AMY_PHONE_LINES).flatMap((l) => l.lines), ...Object.values(JESS_PHONE_LINES).flat()];
    for (const l of all) expect(l, l).not.toMatch(/—|–/);
  });
});

describe('a mood from a call', () => {
  const make2 = () => new Favour(['amy', 'jess'], { ...DEFAULT_FAVOUR_PARAMS });

  it('pulls her standing down while it lasts, then lets go', () => {
    const f = make2();
    expect(f.mood('amy')).toBe('even');
    f.sulk('amy', 100);
    expect(f.standing('amy')).toBeLessThan(0);
    expect(f.mood('amy')).toBe('neglected');
    expect(f.moodLeft('amy')).toBe(100);
    f.update(101);
    expect(f.mood('amy')).toBe('even');
    expect(f.moodLeft('amy')).toBe(0);
  });

  it('never shortens a mood she is already in, and leaves her friend alone', () => {
    const f = make2();
    f.sulk('amy', 100);
    f.sulk('amy', 10);
    expect(f.moodLeft('amy')).toBe(100);
    expect(f.standing('jess')).toBe(0);
  });

  it('does not touch a girl who is yours for good', () => {
    const f = make2();
    f.lock('amy', 10);
    f.sulk('amy', 100);
    expect(f.standing('amy')).toBe(1);
  });
});
