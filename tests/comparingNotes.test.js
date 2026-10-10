import { describe, it, expect } from 'vitest';
import { ComparingNotes, ranking, combinedRanking, DEFAULT_COMPARE_PARAMS as P } from '../src/npc/comparingNotes.js';
import { Logbook, formatEntry } from '../src/workshop/logbook.js';
import { AMY_RANK_LINES, JESS_RANK_LINES } from '../src/npc/rankLines.js';
import { QUAD_PHRASES } from '../src/npc/quadNames.js';

const girls = (a, j, o = {}) => [
  { id: 'amy', x: 0, z: 0, free: true, buzz: a, ...o.amy },
  { id: 'jess', x: 3, z: 0, free: true, buzz: j, ...o.jess },
];
const run = (c, seconds, ctx) => {
  const out = [];
  for (let t = 0; t < seconds; t++) out.push(...c.update(1, ctx));
  return out;
};
const eager = (random = () => 0.1) => new ComparingNotes({ ...P, chance: 1, startAfter: 0 }, random);

describe('rankings', () => {
  it('orders the quads by what has shaken her, leaving out those she felt nothing on', () => {
    expect(ranking({ red: 30, green: 80, blue: 0, orange: 55 })).toEqual(['green', 'orange', 'red']);
    expect(ranking({ red: 30, green: 80 }, (id) => id !== 'green')).toEqual(['red']);
  });
  it('the two together add up', () => {
    expect(combinedRanking({ red: 50, green: 10 }, { green: 80, blue: 20 })).toEqual(['green', 'red', 'blue']);
  });
});

describe('comparing notes', () => {
  const ctxOf = (a, j, o = {}) => ({ girls: girls(a, j, o.g), floorFree: true, only: () => true, ...o });

  it('waits for the game to get going, a ranking worth having, both of them free, and near each other', () => {
    const buzz = { red: 100, green: 40 };
    const slow = new ComparingNotes({ ...P, chance: 1 }, () => 0);
    expect(run(slow, P.startAfter - 5, ctxOf(buzz, buzz))).toEqual([]);
    expect(run(eager(), 30, ctxOf({ red: 10 }, buzz))).toEqual([]); // under minTotal
    expect(run(eager(), 30, ctxOf(buzz, buzz, { g: { jess: { free: false } } }))).toEqual([]);
    expect(run(eager(), 30, ctxOf(buzz, buzz, { g: { jess: { x: 40 } } }))).toEqual([]);
    expect(run(eager(), 30, { ...ctxOf(buzz, buzz), floorFree: false })).toEqual([]);
    expect(run(eager(), 3, ctxOf(buzz, buzz)).length).toBeGreaterThan(0);
  });

  it('when they agree, one asks, each names hers and the other says the same; Amy notes the ranking', () => {
    const c = eager();
    const buzz = { red: 100, green: 40 };
    const steps = run(c, 40, ctxOf(buzz, buzz));
    expect(steps.map((s) => s.kind ?? s.type)).toEqual(['rankAsk', 'rankTop', 'rankAgree', 'note']);
    expect(steps.find((s) => s.type === 'note').girl).toBe('amy');
    expect(steps.find((s) => s.kind === 'rankTop').spec).toBe('red');
    expect(c.last.ranking).toEqual(['red', 'green']);
    expect(c.last.agree).toBe(true);
  });

  it('when they disagree each names her own, and the first says so', () => {
    const c = eager(() => 0.9); // Jess does not go first; no swap
    const steps = run(c, 60, ctxOf({ red: 100, green: 40 }, { red: 10, green: 90 }));
    const tops = steps.filter((s) => s.kind === 'rankTop');
    expect(tops.map((s) => s.spec)).toEqual(['red', 'green']);
    expect(steps.map((s) => s.kind).filter(Boolean)).toContain('rankDisagree');
    expect(steps.some((s) => s.type === 'swap')).toBe(false);
    expect(c.last.agree).toBe(false);
    expect(c.last.ranking).toEqual(['green', 'red']); // 130 against 110... green leads together
  });

  it('now and then they swap to settle it: each sits on the other\'s pick, then both give a verdict', () => {
    const c = eager(() => 0.1); // swap roll passes
    const steps = run(c, P.swapStay + 100, ctxOf({ red: 100, green: 40 }, { red: 10, green: 90 }));
    const swap = steps.find((s) => s.type === 'swap');
    expect(swap).toBeTruthy();
    expect(Object.values(swap.picks).sort()).toEqual(['green', 'red']);
    const verdicts = steps.filter((s) => s.kind === 'rankVerdict');
    expect(verdicts.map((s) => s.girl).sort()).toEqual(['amy', 'jess']);
    expect(steps.indexOf(verdicts[0])).toBeGreaterThan(steps.indexOf(swap));
  });

  it('then waits out the cooldown before comparing again', () => {
    const c = eager();
    const buzz = { red: 100, green: 40 };
    run(c, 40, ctxOf(buzz, buzz));
    expect(c.busy).toBe(false);
    expect(run(c, P.cooldown - 30, ctxOf(buzz, buzz))).toEqual([]);
    expect(run(c, 60, ctxOf(buzz, buzz)).length).toBeGreaterThan(0);
  });

  it('has nothing to plan if one has felt nothing on the quads that exist', () => {
    expect(eager().plan(girls({}, { red: 5 }), () => true)).toBeNull();
    expect(eager().plan(girls({ red: 5 }, { red: 5 }), (id) => id !== 'red')).toBeNull();
  });
});

describe("Amy's logbook ranking", () => {
  it('is one line, replaced by the next, and has no quad in front of it', () => {
    const b = new Logbook();
    const e = b.writeRanking(['Green', 'Orange', 'Red']);
    expect(formatEntry(e)).toBe('0:00  Buzz ranking: Green, Orange, Red.');
    expect(b.writeRanking(['Green', 'Orange', 'Red'])).toBeNull(); // nothing changed
    b.write({ quad: 'Blue', what: { kind: 'walk', finding: 'walkBelt' } });
    b.writeRanking(['Orange', 'Green']);
    expect(b.entries.filter((x) => x.ranking)).toHaveLength(1);
    expect(b.lines().some((l) => l.includes('Orange, Green'))).toBe(true);
    expect(b.writeRanking([])).toBeNull();
  });
});

describe('her lines', () => {
  it('both girls have every one, written out for every quad, and nobody is called he, she or they', () => {
    for (const key of Object.keys(AMY_RANK_LINES)) expect(JESS_RANK_LINES[key], key).toBeTruthy();
    for (const spec of Object.keys(QUAD_PHRASES)) {
      expect(AMY_RANK_LINES[`rankTop:${spec}`].lines.length).toBeGreaterThan(0);
      expect(JESS_RANK_LINES[`rankTop:${spec}`].lines.length).toBeGreaterThan(0);
    }
    const flat = (l) => (Array.isArray(l) ? l : l.lines);
    const all = [...Object.values(AMY_RANK_LINES), ...Object.values(JESS_RANK_LINES)].flatMap(flat).join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
