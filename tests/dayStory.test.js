import { describe, it, expect } from 'vitest';
import { DayEvents, writeStory, keepStory, validStories } from '../src/farm/dayStory.js';
import { dayRecap } from '../src/farm/dayRecap.js';
import { DEFAULT_FARM_PARAMS } from '../src/farm/farmSave.js';

const p = DEFAULT_FARM_PARAMS;
const first = () => 0;

describe("the day's story", () => {
  it('says a quiet day was quiet', () => {
    const s = writeStory([], {}, p, first);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatch(/quiet/i);
  });

  it('names who raced, who fell out and which quad broke', () => {
    const ev = new DayEvents();
    ev.add('race', { winner: 'jess', loser: 'amy' });
    ev.add('fellOut', { cause: 'race', fault: 'amy' });
    ev.add('seized', { quad: 'Farm 300' });
    const text = writeStory(ev.list, {}, p, first).join(' ');
    expect(text).toContain('Jess beat Amy');
    expect(text).toContain('Amy and Jess fell out over a race');
    expect(text).toContain('Farm 300 seized');
  });

  it('tells it in the order it happened, whichever matters most', () => {
    const ev = [{ kind: 'race', winner: 'amy', loser: 'jess' }, { kind: 'seized', quad: 'Bayou' }];
    const s = writeStory(ev, {}, p, first);
    expect(s[0]).toMatch(/Amy beat Jess/);
    expect(s[1]).toMatch(/Bayou/);
  });

  it('keeps to the most notable few and drops the rest', () => {
    const ev = [{ kind: 'madeUp' }, { kind: 'race', winner: 'amy', loser: 'jess' }, { kind: 'fellOut', cause: 'digs' }, { kind: 'seized', quad: 'A' }, { kind: 'show', place: 1 }, { kind: 'stranded', girl: 'jess', how: 'bog', quad: 'B' }];
    const s = writeStory(ev, {}, { ...p, storySentences: 3 }, first);
    expect(s).toHaveLength(3);
    expect(s.join(' ')).not.toMatch(/made it up|friends again|made up/);
  });

  it('fills spare room with the day\'s totals', () => {
    const s = writeStory([{ kind: 'seized', quad: 'A' }], { jobs: 2, bogs: 1, metres: 2300 }, p, first);
    expect(s.join(' ')).toMatch(/2 jobs came off/);
    expect(s.join(' ')).toMatch(/stuck once/);
    expect(s.join(' ')).toMatch(/2\.3 km/);
  });

  it('is deterministic for a given random', () => {
    const ev = [{ kind: 'race', winner: 'amy', loser: 'jess' }];
    expect(writeStory(ev, {}, p, () => 0.99)).toEqual(writeStory(ev, {}, p, () => 0.99));
  });

  it('keeps the last stories, one per day', () => {
    let k = [];
    for (let d = 1; d <= 12; d++) k = keepStory(k, d, [`day ${d}.`], p);
    expect(k).toHaveLength(p.storiesKept);
    expect(k[0].day).toBe(3);
    k = keepStory(k, 12, ['again.'], p);
    expect(k.at(-1).text).toBe('again.');
    expect(k).toHaveLength(p.storiesKept);
  });

  it('copes with a save that lacks or has damaged stories', () => {
    expect(validStories(undefined)).toEqual([]);
    expect(validStories([{ day: 2, text: 'ok' }, { day: 'x' }, null])).toEqual([{ day: 2, text: 'ok' }]);
  });

  it('goes on the recap card', () => {
    expect(dayRecap({ day: 3, story: ['One.', 'Two.'] }, p).story).toBe('One. Two.');
    expect(dayRecap({ day: 3 }, p).story).toBe('');
  });
});

describe('the stories in the save', () => {
  it('rides along in a save that still validates', async () => {
    const { validSave } = await import('../src/farm/farmSave.js');
    expect(validSave({ version: 1, day: 3, farmSeed: 7, stories: [{ day: 2, text: 'x' }] })).toBe(true);
    expect(validSave({ version: 1, day: 3, farmSeed: 7 })).toBe(true);
  });
});
