import { describe, it, expect } from 'vitest';
import { Skills, SKILLS, mistake, mistakeChance, successChance, band, COACHING, DEFAULT_SKILL_PARAMS } from '../src/npc/skills.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';

const level = (v) => ({ starting: v, choke: v, cornering: v, mud: v });
const quad = (over = {}) => ({
  position: { x: 0, z: 0 },
  yaw: 0,
  forwardSpeed: 0,
  choke: 0,
  fuel: { tap: 'on' },
  engine: { isRunning: true, ignitionOn: true, temperature: 1, setIgnition() {} },
  ...over,
});
const drive = (q, skill = level(0.5), random = () => 0.99) =>
  new HerDrive(q, { params: { ...DEFAULT_COMPANION_PARAMS }, probe: () => Infinity, isClear: () => true, random, skill });

describe('skill scaling', () => {
  it('leaves her usual mistakes at 0.5, none at 1, double at 0', () => {
    expect(mistake(0.5)).toBe(1);
    expect(mistake(1)).toBe(0);
    expect(mistake(0)).toBe(2);
  });
  it('scales a chance of going wrong and caps it at 1', () => {
    expect(mistakeChance(0.45, 0.5)).toBeCloseTo(0.45);
    expect(mistakeChance(0.45, 0.9)).toBeLessThan(0.1);
    expect(mistakeChance(0.8, 0)).toBe(1);
  });
  it('scales a chance of going right the other way', () => {
    expect(successChance(0.75, 0.5)).toBeCloseTo(0.75);
    expect(successChance(0.75, 1)).toBe(1);
    expect(successChance(0.75, 0)).toBeCloseTo(0.5);
  });
  it('bands her level for what she says', () => {
    expect(band(0.2)).toBe('novice');
    expect(band(0.5)).toBe('learning');
    expect(band(0.85)).toBe('learned');
  });
});

describe('Skills', () => {
  const make = () => new Skills(['amy', 'jess']);
  it('starts each girl with her own strengths and everyone else in the middle', () => {
    const s = make();
    expect(s.level('amy', 'cornering')).toBeGreaterThan(s.level('jess', 'cornering'));
    expect(s.level('jess', 'mud')).toBeGreaterThan(s.level('amy', 'mud'));
    expect(new Skills(['bob']).level('bob', 'mud')).toBe(0.5);
    expect(SKILLS.every((k) => k in s.levels.amy)).toBe(true);
  });
  it('teaches at the right moment', () => {
    const s = make();
    const before = s.level('amy', 'choke');
    expect(s.coach('amy', 'choke', true)).toBe('taught');
    expect(s.level('amy', 'choke')).toBeCloseTo(before + DEFAULT_SKILL_PARAMS.coachGain);
  });
  it('teaches nothing at the wrong moment', () => {
    const s = make();
    const before = s.level('amy', 'choke');
    expect(s.coach('amy', 'choke', false)).toBe('wrongTime');
    expect(s.level('amy', 'choke')).toBe(before);
  });
  it('counts the same advice again too soon as nagging, and allows it after the gap', () => {
    const s = make();
    s.coach('amy', 'mud', true);
    const after = s.level('amy', 'mud');
    expect(s.coach('amy', 'mud', true)).toBe('nagged');
    expect(s.level('amy', 'mud')).toBe(after);
    s.update(DEFAULT_SKILL_PARAMS.nagGap + 1);
    expect(s.coach('amy', 'mud', true)).toBe('taught');
  });
  it('keeps girls and skills separate', () => {
    const s = make();
    s.coach('amy', 'mud', true);
    expect(s.coach('jess', 'mud', true)).toBe('taught');
    expect(s.coach('amy', 'choke', true)).toBe('taught');
  });
  it('picks things up from practice, far more slowly, and not every few seconds', () => {
    const s = make();
    const before = s.level('amy', 'cornering');
    s.practice('amy', 'cornering');
    s.practice('amy', 'cornering');
    expect(s.level('amy', 'cornering')).toBeCloseTo(before + DEFAULT_SKILL_PARAMS.practiceGain);
    expect(DEFAULT_SKILL_PARAMS.practiceGain).toBeLessThan(DEFAULT_SKILL_PARAMS.coachGain / 5);
    s.update(DEFAULT_SKILL_PARAMS.practiceGap + 1);
    s.practice('amy', 'cornering');
    expect(s.level('amy', 'cornering')).toBeCloseTo(before + 2 * DEFAULT_SKILL_PARAMS.practiceGain);
  });
  it('never goes past 0 or 1', () => {
    const s = make();
    s.set('amy', 'mud', 5);
    expect(s.level('amy', 'mud')).toBe(1);
    s.set('amy', 'mud', -1);
    expect(s.level('amy', 'mud')).toBe(0);
  });
});

describe('her driving reads her skills', () => {
  it('forgets the choke more with less skill, and never with full skill', () => {
    const forgets = (v) => {
      let n = 0;
      for (let i = 0; i < 200; i++) n += drive(quad(), level(v), () => i / 200).forgetsChoke ? 1 : 0;
      return n;
    };
    expect(forgets(0.1)).toBeGreaterThan(forgets(0.5));
    expect(forgets(0.5)).toBeGreaterThan(forgets(0.9));
    expect(forgets(1)).toBe(0);
  });
  it('checks the tap and the choke more often at higher starting skill', () => {
    const lo = drive(quad({ engine: { isRunning: false, ignitionOn: false, temperature: 0, setIgnition() {} } }), level(0.1)).skilledStarting();
    const hi = drive(quad({ engine: { isRunning: false, ignitionOn: false, temperature: 0, setIgnition() {} } }), level(0.9)).skilledStarting();
    expect(hi.tapCheckChance).toBeGreaterThan(lo.tapCheckChance);
    expect(hi.coldChokeChance).toBeGreaterThan(lo.coldChokeChance);
    expect(hi.rememberChance).toBeGreaterThan(lo.rememberChance);
  });
  it('follows levels changed under her mid-drive (coaching)', () => {
    const skill = level(0.1);
    const d = drive(quad(), skill);
    skill.starting = 0.9;
    expect(d.skilledStarting().tapCheckChance).toBeGreaterThan(0.9);
  });
  it('offers advice only for what fits the moment', () => {
    const q = quad({ choke: 1 });
    q.engine.temperature = 0.2;
    const d = drive(q);
    d.phase = 'drive';
    expect(d.coachable()).not.toContain('chokeOff'); // still cold, the choke belongs on
    q.engine.temperature = 0.8;
    expect(d.coachable()).toContain('chokeOff');
    expect(d.coachable()).not.toContain('keepGoing');
    d.note('mud');
    expect(d.coachable()).toContain('keepGoing');
    d.clock += 30; // a wobble long since forgotten
    expect(d.coachable()).not.toContain('keepGoing');
  });
  it('offers starting advice while she cranks or after a stall, and none once she pulls up', () => {
    const d = drive(quad());
    d.phase = 'start';
    expect(d.coachable()).toContain('crankLess');
    d.phase = 'stop';
    expect(d.coachable()).toEqual([]);
    expect(Object.values(COACHING).every((c) => SKILLS.includes(c.skill))).toBe(true);
  });
});
