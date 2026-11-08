import { describe, it, expect } from 'vitest';
import { TidyUp, DEFAULT_TIDY_UP_PARAMS, TIDY_UP_PARAM_RANGES, KINDS } from '../src/npc/tidyUp.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { AMY_TIDY_UP_LINES, JESS_TIDY_UP_LINES } from '../src/npc/tidyUpLines.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, x: 10, z: 0, weight: 1, ...over },
  { id: 'jess', free: true, x: 12, z: 0, weight: 0 },
];
const gate = { id: 'gate:south', kind: 'gate', x: 0, z: 0 };
const can = { id: 'can:petrolCan', kind: 'can', x: 30, z: 0 };
const helmet = { id: 'helmet:jess', kind: 'helmet', x: 5, z: 0 };

/** Ready to go: past the start, with `things` out of place for `s` seconds. */
const ready = (things, s = 200) => {
  const m = new TidyUp();
  m.update(m.p.startAfter + 1, things);
  m.update(s, things);
  return m;
};

describe('TidyUp', () => {
  it('has a range for every tunable, an offer kind, a weight for each girl and a line for each thing', () => {
    expect(Object.keys(TIDY_UP_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_TIDY_UP_PARAMS).sort());
    expect(OFFER_KINDS.tidyUp).toBeTruthy();
    expect('tidyUpWeight' in DEFAULT_COMPANION_PARAMS).toBe(true);
    expect(Object.keys(AMY_TIDY_UP_LINES).sort()).toEqual(['tidyCan', 'tidyGate', 'tidyHelmet']);
    expect(Object.keys(JESS_TIDY_UP_LINES)).toEqual(['leaveItLying']);
    expect(KINDS).toEqual(['gate', 'can', 'helmet']);
  });

  it('is Amy who tidies: she is keen, Jess leaves things where she drops them', () => {
    const weight = (id) => CHARACTERS.find((c) => c.id === id).params.tidyUpWeight;
    expect(weight('amy')).toBeGreaterThan(0);
    expect(weight('jess')).toBe(0);
  });

  it('offers nothing at the start of a game, or with nothing out of place', () => {
    const m = new TidyUp();
    m.update(1, [gate]);
    expect(m.offers({ girls: girls() })).toEqual([]);
    expect(ready([]).offers({ girls: girls() })).toEqual([]);
  });

  it('leaves a thing alone until it has been left long enough, and starts the wait again if it is put right and left again', () => {
    const m = new TidyUp();
    m.update(m.p.startAfter + 1, [can]);
    m.update(m.p.canAfter - 5, [can]);
    expect(m.offers({ girls: girls() })).toEqual([]);
    m.update(10, [can]);
    expect(m.offers({ girls: girls() }).length).toBe(1);
    m.update(1, []); // you picked it up
    m.update(1, [can]);
    expect(m.offers({ girls: girls() })).toEqual([]);
  });

  it('offers a gate, a can and a helmet, each its own kind, the nearest to her first', () => {
    const m = ready([can, gate, helmet]);
    const o = m.offers({ girls: girls() });
    expect(o).toHaveLength(1); // one thing at a time for each girl
    expect(o[0]).toMatchObject({ key: 'tidyUp', girl: 'amy', kind: 'helmet', thing: 'helmet:jess' });
    expect(ready([gate]).offers({ girls: girls() })[0].kind).toBe('gate');
    expect(ready([can]).offers({ girls: girls() })[0].kind).toBe('can');
  });

  it('weighs the offer by her keenness and the kind, and offers nothing to Jess, to a busy girl or to one too far away', () => {
    const m = ready([gate]);
    expect(m.offers({ girls: girls() })[0].weight).toBeCloseTo(m.p.gateShare);
    expect(m.offers({ girls: girls().map((g) => ({ ...g, weight: 0 })) })).toEqual([]);
    expect(m.offers({ girls: girls({ free: false }) })).toEqual([]);
    expect(m.offers({ girls: girls({ x: 500 }) })).toEqual([]);
  });

  it('takes one job at a time, then rests', () => {
    const m = ready([gate, can]);
    const e = m.take(m.offers({ girls: girls() })[0]);
    expect(e).toEqual({ type: 'go', girl: 'amy', kind: 'gate', thing: 'gate:south' });
    expect(m.offers({ girls: girls() })).toEqual([]);
    m.finished();
    expect(m.offers({ girls: girls() })).toEqual([]);
    m.update(m.p.cooldown + 1, [can]);
    expect(m.offers({ girls: girls() })[0].kind).toBe('can');
  });

  it('forgets a job that has not finished in time, and a cancelled one costs no rest', () => {
    const m = ready([gate]);
    m.take(m.offers({ girls: girls() })[0]);
    m.update(m.p.jobTimeout + 1, [gate]);
    expect(m.job).toBe(null);
    expect(m.offers({ girls: girls() })).toEqual([]); // resting
    const n = ready([gate]);
    n.take(n.offers({ girls: girls() })[0]);
    n.cancel();
    expect(n.offers({ girls: girls() }).length).toBe(1);
  });

  it('can be forced for the debug panel, at once, for the nearest thing of a kind', () => {
    const m = new TidyUp();
    expect(m.force({ girls: girls() }, 'amy')).toBe(null);
    m.update(1, [gate, can]);
    expect(m.force({ girls: girls() }, 'amy', 'can')).toMatchObject({ kind: 'can', thing: 'can:petrolCan' });
    expect(m.force({ girls: girls() }, 'amy')).toBe(null); // already on it
  });

  it('says a can is out of place only beyond the home radius', () => {
    const m = new TidyUp();
    expect(m.canOutOfPlace({ x: 3, z: 0 }, { x: 0, z: 0 })).toBe(false);
    expect(m.canOutOfPlace({ x: m.p.canHome + 1, z: 0 }, { x: 0, z: 0 })).toBe(true);
  });
});
