import { describe, it, expect } from 'vitest';
import { Earlier } from '../src/npc/earlier.js';
import { Banter } from '../src/npc/banter.js';
import { BANTER } from '../src/npc/banterLines.js';
import { DayEvents } from '../src/farm/dayStory.js';

const AFTER = { earlierAfter: 100 };

describe('the girls calling back to earlier in the day', () => {
  it('waits until something is old enough, then names it', () => {
    const log = new DayEvents();
    const e = new Earlier(AFTER);
    log.add('race', { winner: 'jess', loser: 'amy' });
    expect(e.triggers(0, log.list, true)).toEqual([]);
    expect(e.triggers(50, log.list, true)).toEqual([]);
    expect(e.triggers(60, log.list, true)).toEqual([{ when: 'earlier', roles: { event: 'race', winner: 'jess', loser: 'amy' } }]);
  });

  it('says nothing unless they are stood about, and ignores kinds it has no lines for', () => {
    const log = new DayEvents();
    const e = new Earlier(AFTER);
    log.add('madeUp');
    log.add('fellOut', { cause: 'race' });
    expect(e.triggers(0, log.list, false)).toEqual([]);
    expect(e.triggers(200, log.list, false)).toEqual([]);
    expect(e.triggers(1, log.list, true)[0].roles.event).toBe('fellOut');
  });

  it('brings each thing up once, then the next', () => {
    const log = new DayEvents();
    const e = new Earlier(AFTER);
    log.add('seized', { quad: 'Bruin' });
    log.add('failedTest', { fails: 1 });
    e.triggers(0, log.list, true);
    e.triggers(200, log.list, true);
    e.spoke({ when: 'earlier' });
    expect(e.triggers(1, log.list, true)[0].roles.event).toBe('failedTest');
    e.spoke({ when: 'idle' });
    expect(e.triggers(1, log.list, true)[0].roles.event).toBe('failedTest');
    e.spoke({ when: 'earlier' });
    expect(e.triggers(1, log.list, true)).toEqual([]);
  });

  it('has lines for every event it can raise, so the banter always finds one', () => {
    const cases = [
      ['race', { winner: 'amy', loser: 'jess' }], ['race', { winner: 'jess', loser: 'amy' }], ['youRaced', { place: 1 }], ['youRaced', { place: 3 }],
      ['stranded', { girl: 'amy', how: 'tip' }], ['stranded', { girl: 'amy', how: 'bog' }], ['stranded', { girl: 'jess', how: 'tip' }],
      ['stranded', { girl: 'jess', how: 'bog' }], ['seized', {}], ['fellOut', {}], ['passedTest', {}], ['failedTest', {}],
    ];
    for (const [kind, data] of cases) {
      const log = new DayEvents();
      log.add(kind, data);
      const e = new Earlier(AFTER);
      e.triggers(0, log.list, true);
      const [t] = e.triggers(200, log.list, true);
      expect(new Banter(BANTER).candidates(t).length, `${kind} ${JSON.stringify(data)}`).toBeGreaterThan(0);
    }
  });

  it('never has the girls speak of you as he, she or they', () => {
    for (const x of BANTER.filter((b) => b.when === 'earlier')) for (const [, text] of x.lines) expect(text).not.toMatch(/\b(he|him|his|they|them)\b|\bshe's\b/i);
  });
});
