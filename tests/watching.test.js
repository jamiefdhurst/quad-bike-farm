import { describe, it, expect } from 'vitest';
import { Watching, WATCH_THINGS, DEFAULT_WATCH_PARAMS as P } from '../src/npc/watching.js';
import { Skills, SKILLS, SHOWN_SKILLS, DRIVING_SKILLS, DEFAULT_SKILL_PARAMS } from '../src/npc/skills.js';
import { PushStart } from '../src/npc/pushStart.js';
import { grindsGear, NoviceShifter, AutoShifter } from '../src/vehicle/autoShifter.js';
import { meanSkill } from '../src/npc/lPlates.js';

const watch = (w, seconds, looking) => {
  for (let t = 0; t < seconds; t += 0.1) w.update(0.1, looking);
};

describe('Watching', () => {
  it('every thing you can show teaches a skill that exists', () => {
    for (const t of Object.values(WATCH_THINGS)) expect(SHOWN_SKILLS).toContain(t.skill);
    expect(SKILLS).toEqual(expect.arrayContaining([...DRIVING_SKILLS, ...SHOWN_SKILLS]));
  });
  it('she saw it if she was looking for most of the stretch before you did it', () => {
    const w = new Watching();
    w.begin('jess', 'bumpStart');
    watch(w, 10, () => true);
    const [r] = w.shown('bumpStart');
    expect(r).toMatchObject({ id: 'jess', skill: 'bumpStart', saw: true });
  });
  it('she missed it if her eye was elsewhere', () => {
    const w = new Watching();
    w.begin('jess', 'bumpStart');
    watch(w, 10, () => false);
    expect(w.shown('bumpStart')[0].saw).toBe(false);
  });
  it('only the last stretch counts: looking away early is forgiven, looking away just before is not', () => {
    const early = new Watching();
    early.begin('amy', 'doubleDeclutch');
    watch(early, 5, () => false);
    watch(early, P.showSeconds + 1, () => true);
    expect(early.shown('doubleDeclutch')[0].saw).toBe(true);
    const late = new Watching();
    late.begin('amy', 'doubleDeclutch');
    watch(late, 10, () => true);
    watch(late, P.showSeconds * 0.6, () => false);
    expect(late.shown('doubleDeclutch')[0].saw).toBe(false);
  });
  it('doing something else teaches nothing, and each session ends once it is shown', () => {
    const w = new Watching();
    w.begin('jess', 'bumpStart');
    watch(w, 3, () => true);
    expect(w.shown('doubleDeclutch')).toEqual([]);
    expect(w.shown('bumpStart')).toHaveLength(1);
    expect(w.shown('bumpStart')).toEqual([]);
    expect(w.thing('jess')).toBe(null);
  });
  it('she gives up if you never do it', () => {
    const w = new Watching();
    w.begin('jess', 'bumpStart');
    const events = [];
    for (let t = 0; t < P.watchSeconds + 2; t += 0.5) events.push(...w.update(0.5, () => true));
    expect(events).toEqual([{ id: 'jess', type: 'gaveUp' }]);
    expect(w.thing('jess')).toBe(null);
  });
  it('refuses a thing it does not know', () => {
    expect(new Watching().begin('amy', 'wheelie')).toBe(false);
  });
});

describe('what watching teaches', () => {
  it('a skill jumps when she saw it, and not when she missed it', () => {
    const s = new Skills(['jess']);
    const before = s.level('jess', 'bumpStart');
    expect(s.watch('jess', 'bumpStart', false)).toBe('missed');
    expect(s.level('jess', 'bumpStart')).toBe(before);
    expect(s.watch('jess', 'bumpStart', true)).toBe('learnt');
    expect(s.level('jess', 'bumpStart')).toBeCloseTo(before + DEFAULT_SKILL_PARAMS.watchGain);
  });
  it('can be shown again straight away: it is not nagging', () => {
    const s = new Skills(['jess']);
    s.watch('jess', 'bumpStart', true);
    expect(s.watch('jess', 'bumpStart', true)).toBe('learnt');
  });
  it('Jess starts knowing neither, Amy already double-declutches', () => {
    const s = new Skills(['amy', 'jess']);
    expect(s.level('jess', 'bumpStart')).toBe(0);
    expect(s.level('jess', 'doubleDeclutch')).toBe(0);
    expect(s.level('amy', 'doubleDeclutch')).toBeGreaterThan(0.9);
  });
  it('how good a driver she is overall ignores the two she is shown', () => {
    expect(meanSkill({ starting: 0.5, choke: 0.5, cornering: 0.5, mud: 0.5, bumpStart: 0, doubleDeclutch: 0 })).toBe(0.5);
  });
});

describe('what the skills change', () => {
  const q = () => ({ forwardSpeed: 0, engine: { isRunning: false, ignitionOn: false, setIgnition() {} } });
  it('a girl who can bump-start pushes harder and for longer', () => {
    const novice = new PushStart(q(), 'jess', 260, { skill: 0 });
    const expert = new PushStart(q(), 'jess', 260, { skill: 1 });
    expect(expert.thrust).toBeGreaterThan(novice.thrust);
    expect(new PushStart(q(), 'jess', 260).effort).toBe(1); // 0.5 is as she always was
    const tires = (p) => {
      let t = 0;
      while (!p.done && t < 100) (p.update(0.1), (t += 0.1));
      return t;
    };
    expect(tires(expert)).toBeGreaterThan(tires(novice));
  });
  const box = { crashGears: 2, crashSpeed: 1 };
  it('with a double-declutch skill she grinds that often', () => {
    const girl = (level) => Object.assign(new AutoShifter(), { declutchLevel: () => level });
    expect(grindsGear(girl(0), box, 2, 3, () => 0.99)).toBe(true);
    expect(grindsGear(girl(1), box, 2, 3, () => 0.0)).toBe(false);
    expect(grindsGear(girl(0.5), box, 2, 3, () => 0.4)).toBe(true);
    expect(grindsGear(girl(0.5), box, 2, 3, () => 0.6)).toBe(false);
    expect(grindsGear(girl(0), box, 3, 6, () => 0)).toBe(false); // third has synchromesh
  });
  it('Jess grinds less as she learns it', () => {
    const jess = Object.assign(new NoviceShifter(), { declutchLevel: () => 0.9 });
    expect(grindsGear(jess, box, 2, 3, () => 0.5)).toBe(false);
  });
});
