import { describe, it, expect } from 'vitest';
import { TractorRunaway, DEFAULT_TRACTOR_RUNAWAY_PARAMS as P } from '../src/npc/tractorRunaway.js';
import { AMY_TRACTORRUNAWAY_LINES, JESS_TRACTORRUNAWAY_LINES } from '../src/npc/tractorRunawayLines.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, dist: 10, ...over.amy },
  { id: 'jess', free: true, dist: 14, ...over.jess },
];
const ctx = (over = {}) => ({ creeping: true, stalled: false, trailer: false, hedge: 100, girls: girls(), ...over });
const make = (random = () => 0.5, over = {}) => new TractorRunaway({ ...P, missChance: 0, ...over }, random);
function run(r, seconds, c) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...r.update(0.5, c));
  return events;
}

describe('remarking on it', () => {
  it('the nearest girl says so once it has been creeping a while, once', () => {
    const r = make();
    expect(run(r, P.noteDelay - 1, ctx())).toEqual([]);
    const events = run(r, 20, ctx());
    expect(events).toEqual([{ type: 'note', girl: 'amy', trailer: false }]);
  });

  it('knows about the trailer', () => {
    expect(run(make(), 10, ctx({ trailer: true }))[0].trailer).toBe(true);
  });

  it('nobody out of earshot or busy says anything', () => {
    expect(run(make(), 20, ctx({ girls: girls({ amy: { dist: 100 }, jess: { free: false } }) }))).toEqual([]);
  });

  it('says nothing when it is not creeping', () => {
    expect(run(make(), 20, ctx({ creeping: false }))).toEqual([]);
  });
});

describe('running after it', () => {
  it('the nearest free girl sets off when it is near enough to the hedge', () => {
    const r = make();
    expect(run(r, 2, ctx({ hedge: 100 })).filter((e) => e.type === 'chase')).toEqual([]);
    expect(run(r, 2, ctx({ hedge: 5 })).filter((e) => e.type === 'chase')).toEqual([{ type: 'chase', girl: 'amy' }]);
    expect(run(r, 5, ctx({ hedge: 3 })).filter((e) => e.type === 'chase')).toEqual([]);
  });

  it('a girl who is busy is skipped for the other one', () => {
    const e = run(make(), 2, ctx({ hedge: 5, girls: girls({ amy: { free: false } }) })).filter((x) => x.type === 'chase');
    expect(e).toEqual([{ type: 'chase', girl: 'jess' }]);
  });

  it('sometimes nobody is looking and nobody goes', () => {
    const r = make(() => 0, { missChance: 1 });
    expect(run(r, 5, ctx({ hedge: 1 })).filter((e) => e.type === 'chase')).toEqual([]);
  });
});

describe('the hedge', () => {
  it('is reported when it stalls with nobody having stopped it', () => {
    const r = make();
    run(r, 2, ctx());
    expect(r.update(0.5, ctx({ creeping: false, stalled: true }))).toEqual([{ type: 'hedge', girl: 'amy' }]);
  });

  it('is not reported when it just stops (somebody caught it)', () => {
    const r = make();
    run(r, 2, ctx());
    expect(r.update(0.5, ctx({ creeping: false }))).toEqual([]);
  });

  it('starts a fresh episode the next time it creeps', () => {
    const r = make();
    run(r, 10, ctx());
    r.update(0.5, ctx({ creeping: false }));
    expect(run(r, 10, ctx()).filter((e) => e.type === 'note')).toHaveLength(1);
  });
});

describe('lines', () => {
  const keys = ['tractorCreepNote', 'tractorCreepTrailer', 'tractorRunaway', 'tractorRunawayStopped', 'tractorHedge', 'tractorHedgeBlame'];
  it('both girls have every one, and never call you anything but you', () => {
    for (const k of keys) {
      expect(AMY_TRACTORRUNAWAY_LINES[k].lines.length).toBeGreaterThan(1);
      expect(JESS_TRACTORRUNAWAY_LINES[k].length).toBeGreaterThan(1);
    }
    const all = [...keys.flatMap((k) => AMY_TRACTORRUNAWAY_LINES[k].lines), ...keys.flatMap((k) => JESS_TRACTORRUNAWAY_LINES[k])].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b|—/i);
  });
});
