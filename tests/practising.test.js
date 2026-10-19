import { describe, it, expect } from 'vitest';
import { Practising, DEFAULT_PRACTISING_PARAMS as P } from '../src/npc/practising.js';
import { Skills, DEFAULT_SKILL_PARAMS } from '../src/npc/skills.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';
import { AMY_PRACTISING_LINES, JESS_PRACTISING_LINES } from '../src/npc/practisingLines.js';

const seq = (values) => {
  let i = 0;
  return () => values[i++ % values.length];
};
const girl = (o = {}) => ({ id: 'jess', sat: true, running: true, cold: false, level: { starting: 0.45, choke: 0.3 }, youDistance: 30, youOn: false, ...o });
const offerCtx = (o = {}) => ({ girls: [{ id: 'jess', free: true, unit: 'red', level: 0.45, ...o }] });
const params = (o = {}) => ({ ...P, startAfter: 0, ...o });

/** Runs a sitting in 0.1 s steps, calling `react` on each event; returns every event. */
function run(w, g, seconds, react = () => {}) {
  const all = [];
  for (let t = 0; t < seconds; t += 0.1) {
    for (const e of w.update(0.1, { girls: [g] })) {
      all.push(e);
      react(e);
    }
  }
  return all;
}

describe('offering to practise', () => {
  it('is an offer kind that meets a need', () => {
    expect(OFFER_KINDS.practise.satisfies.purpose).toBeGreaterThan(0);
  });

  it('is keener in Jess than Amy, and keener the worse she is at it', () => {
    const w = new Practising(params());
    const jess = w.offers(offerCtx())[0].weight;
    const amy = w.offers({ girls: [{ id: 'amy', free: true, unit: 'red', level: 0.45 }] })[0].weight;
    expect(jess).toBeGreaterThan(amy);
    expect(w.offers(offerCtx({ level: 0.1 }))[0].weight).toBeGreaterThan(w.offers(offerCtx({ level: 0.9 }))[0].weight);
  });

  it('offers nothing early on, when she is busy, with no quad, mid-sitting or cooling off', () => {
    expect(new Practising({ ...P, startAfter: 90 }).offers(offerCtx())).toEqual([]);
    const w = new Practising(params());
    expect(w.offers(offerCtx({ free: false }))).toEqual([]);
    expect(w.offers(offerCtx({ unit: null }))).toEqual([]);
    const e = w.take(w.offers(offerCtx())[0]);
    expect(e).toEqual({ type: 'go', girl: 'jess', unit: 'red' });
    expect(w.offers(offerCtx())).toEqual([]);
    w.drop('jess');
    expect(w.offers(offerCtx())).toEqual([]); // cooling off
    w.update(P.cooldown + 1, { girls: [] });
    expect(w.offers(offerCtx())).toHaveLength(1);
  });
});

describe('a sitting', () => {
  it('settles when she is sat on it, and is lost if she never gets there', () => {
    const w = new Practising(params(), () => 0.5);
    w.begin('jess');
    expect(run(w, girl({ sat: false }), P.goTimeout + 1).map((e) => e.type)).toEqual(['lost']);
    expect(w.has('jess')).toBe(false);
    w.begin('jess');
    expect(w.update(0.1, { girls: [girl()] }).map((e) => e.type)).toEqual(['in']);
    expect(w.sitting('jess')).toBe(true);
  });

  it('a poor starter stalls at the bite and restarts it; a good one rarely stalls', () => {
    const count = (level, type) => {
      let n = 0;
      for (let seed = 1; seed <= 40; seed++) {
        let s = seed * 7919;
        const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        const w = new Practising(params({ lengthMin: 60, lengthMax: 60 }), rnd);
        w.begin('jess');
        const g = girl({ level: { starting: level, choke: 0.9 } });
        const ev = run(w, g, 80, (e) => {
          if (e.type === 'stall') g.running = false;
          if (w.controls('jess').starter) g.running = true; // it catches on the first burst
        });
        n += ev.filter((e) => e.type === type).length;
      }
      return n;
    };
    expect(count(0.1, 'stall')).toBeGreaterThan(count(0.9, 'stall') * 2);
    expect(count(0.9, 'bite')).toBeGreaterThan(count(0.1, 'bite'));
  });

  it('after a stall she sits a moment, then works the starter, and counts it when it catches', () => {
    const w = new Practising(params({ biteStall: 1 }), seq([0.5, 0.5, 0.9, 0.9, 0.9]));
    w.begin('jess');
    const g = girl({ level: { starting: 0.5, choke: 0.5 } });
    const types = [];
    let starterAt = null;
    for (let t = 0; t < 40 && !types.includes('caught'); t += 0.1) {
      for (const e of w.update(0.1, { girls: [g] })) {
        types.push(e.type);
        if (e.type === 'stall') g.running = false;
      }
      if (w.controls('jess').starter && starterAt === null) starterAt = t;
      if (starterAt !== null && t > starterAt + 1) g.running = true; // it catches after a second of cranking
    }
    expect(types).toContain('stall');
    expect(starterAt).not.toBeNull();
    expect(types.indexOf('caught')).toBeGreaterThan(types.indexOf('stall'));
  });

  it('gives up and gets off if it will not restart', () => {
    const w = new Practising(params({ biteStall: 1 }), seq([0.5, 0.9]));
    w.begin('jess');
    const g = girl();
    const ev = run(w, g, 120, (e) => {
      if (e.type === 'stall') g.running = false;
    });
    const types = ev.map((e) => e.type);
    expect(types).toContain('gaveUp');
    expect(types.at(-1)).toBe('off');
    expect(ev.at(-1).keyOff).toBe(false);
    expect(w.has('jess')).toBe(false);
  });

  it('tries the choke, and remembers to push it off in time more often when she knows it', () => {
    const forgets = (level) => {
      let n = 0;
      for (let seed = 1; seed <= 60; seed++) {
        let s = seed * 104729;
        const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
        const w = new Practising(params({ lengthMin: 100, lengthMax: 100 }), rnd);
        w.begin('jess');
        n += run(w, girl({ level: { starting: 1, choke: level } }), 110).filter((e) => e.type === 'chokeLate').length;
      }
      return n;
    };
    expect(forgets(0.1)).toBeGreaterThan(forgets(0.95));
  });

  it('puts the choke on only while she is trying it, and the throttle only while she blips or bites', () => {
    const w = new Practising(params(), seq([0.3]));
    w.begin('jess');
    w.update(0.1, { girls: [girl()] });
    let sawChoke = false;
    run(w, girl(), 10, () => {
      if (w.controls('jess').choke > 0) sawChoke = true;
    });
    expect(sawChoke).toBe(true);
    const done = new Practising(params(), seq([0.5]));
    done.begin('jess');
    expect(done.controls('jess')).toEqual({ throttle: 0, choke: 0, starter: false }); // not yet sat
  });

  it('ends after her time, usually leaving it running for you, sometimes with the key off', () => {
    const w = new Practising(params({ lengthMin: 20, lengthMax: 20, keyOffChance: 1 }), seq([0.9]));
    w.begin('jess');
    const ev = run(w, girl({ level: { starting: 1, choke: 1 } }), 60);
    expect(ev.map((e) => e.type).slice(-2)).toEqual(['done', 'off']);
    expect(ev.at(-1).keyOff).toBe(true);
    const keep = new Practising(params({ lengthMin: 20, lengthMax: 20, keyOffChance: 0 }), seq([0.9]));
    keep.begin('jess');
    expect(run(keep, girl({ level: { starting: 1, choke: 1 } }), 60).at(-1).keyOff).toBe(false);
  });

  it('you coming over, or getting on, ends it', () => {
    const w = new Practising(params(), seq([0.9]));
    w.begin('jess');
    run(w, girl(), 5);
    const ev = run(w, girl({ youDistance: 1 }), 10).map((e) => e.type);
    expect(ev).toEqual(['slow', 'off']);
    w.begin('jess');
    run(w, girl(), 5);
    expect(run(w, girl({ youOn: true }), 1).map((e) => e.type)).toEqual(['lost']);
  });
});

describe('what it does for her skill', () => {
  it('practice counts for more than the ordinary, once the skill\'s own gap has gone by', () => {
    const s = new Skills(['jess']);
    const before = s.level('jess', 'starting');
    s.practice('jess', 'starting', P.gainScale);
    expect(s.level('jess', 'starting')).toBeCloseTo(before + DEFAULT_SKILL_PARAMS.practiceGain * P.gainScale);
    s.practice('jess', 'starting', P.gainScale); // too soon
    expect(s.level('jess', 'starting')).toBeCloseTo(before + DEFAULT_SKILL_PARAMS.practiceGain * P.gainScale);
  });

  it('a sitting of clean bites over a game makes the stalls rarer', () => {
    const s = new Skills(['jess']);
    for (let i = 0; i < 12; i++) {
      s.update(DEFAULT_SKILL_PARAMS.practiceGap + 1);
      s.practice('jess', 'starting', P.gainScale);
    }
    expect(s.level('jess', 'starting')).toBeGreaterThan(0.75);
  });
});

describe('what she says', () => {
  it('has the same lines for both girls, and no he, she or they about you', () => {
    expect(Object.keys(JESS_PRACTISING_LINES).sort()).toEqual(Object.keys(AMY_PRACTISING_LINES).sort());
    for (const set of [AMY_PRACTISING_LINES, JESS_PRACTISING_LINES]) {
      for (const v of Object.values(set)) {
        for (const l of v.lines ?? v) {
          expect(l).not.toMatch(/—/);
          expect(l).not.toMatch(/\b(he|she|they)\b/i);
        }
      }
    }
  });
});
