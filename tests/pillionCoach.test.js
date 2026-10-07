import { describe, it, expect } from 'vitest';
import { PillionCoach, DEFAULT_PILLION_COACH_PARAMS as P, COACH_KNOWS } from '../src/npc/pillionCoach.js';
import { AMY_PILLION_COACH_LINES, JESS_PILLION_COACH_LINES } from '../src/npc/pillionCoachLines.js';
import { COACHING } from '../src/npc/skills.js';

const make = (params = {}, random = () => 0) => new PillionCoach({ ...P, firstGap: 0, ...params }, random);
const share = (coach, moments, driver = coach === 'amy' ? 'jess' : 'amy') => ({ coach, driver, moments });
const run = (c, s, seconds, dt = 0.1) => {
  const out = [];
  for (let t = 0; t < seconds; t += dt) out.push(...c.update(dt, s));
  return out;
};

describe('the girl on the back coaching', () => {
  it('waits a moment, then gives advice for what she is seeing', () => {
    const c = make();
    expect(c.update(0.1, share('amy', ['chokeOff']))).toEqual([]);
    const out = run(c, share('amy', ['chokeOff']), 3);
    expect(out).toEqual([{ coach: 'amy', driver: 'jess', key: 'chokeOff' }]);
  });

  it('only coaches what she knows: Amy leaves mud alone, Jess leaves corners alone', () => {
    expect(run(make(), share('amy', ['keepGoing']), 5)).toEqual([]);
    expect(run(make({ jessWrongChance: 0 }), share('jess', ['easyCorner']), 5)).toEqual([]);
    expect(run(make(), share('jess', ['keepGoing']), 3)[0].key).toBe('keepGoing');
  });

  it('says nothing for the first stretch of a ride, or when nothing is wrong', () => {
    expect(run(make({ firstGap: 10 }), share('amy', ['chokeOff']), 8)).toEqual([]);
    expect(run(make(), share('amy', []), 30)).toEqual([]);
  });

  it('leaves a gap between pieces of advice', () => {
    const out = run(make({ gap: 20 }), share('amy', ['chokeOff']), 15);
    expect(out).toHaveLength(1);
    expect(run(make({ gap: 20 }), share('amy', ['chokeOff']), 30).length).toBeGreaterThan(1);
  });

  it('Jess pipes up when nothing is wrong, and says it again straight away; Amy does neither', () => {
    const jess = make({ jessWrongChance: 1, jessRepeatChance: 1, repeatDelay: 2 });
    const out = run(jess, share('jess', []), 5);
    expect(out).toHaveLength(2);
    expect(out[0].key).toBe(out[1].key);
    expect(run(make({ jessWrongChance: 1 }), share('amy', []), 30)).toEqual([]);
    expect(run(make({ jessRepeatChance: 1 }), share('amy', ['chokeOff']), 3)).toHaveLength(1);
  });

  it('starts again when the pair changes or they stop sharing', () => {
    const c = make({ firstGap: 5 });
    run(c, share('amy', []), 6);
    c.update(0.1, null);
    expect(c.together).toBe(0);
    expect(run(c, share('amy', ['chokeOff']), 4)).toEqual([]);
  });

  it('has a line for every piece of advice, for both girls, and only for girls who coach it', () => {
    for (const key of Object.keys(COACHING)) {
      expect(AMY_PILLION_COACH_LINES[`coachGive_${key}`].lines.length).toBeGreaterThan(0);
      expect(JESS_PILLION_COACH_LINES[`coachGive_${key}`].length).toBeGreaterThan(0);
    }
    for (const keys of Object.values(COACH_KNOWS)) for (const k of keys) expect(COACHING[k]).toBeTruthy();
  });
});
