import { describe, it, expect } from 'vitest';
import { Sulking, DEFAULT_SULK_PARAMS as P } from '../src/npc/sulking.js';
import { CabShelter } from '../src/npc/cabShelter.js';
import { AMY_SULK_LINES, JESS_SULK_LINES } from '../src/npc/sulkLines.js';

const girl = (id, o = {}) => ({ id, free: true, neglected: false, cab: null, ...o });
const ctx = (a = {}, j = {}) => ({ girls: [girl('amy', a), girl('jess', j)] });
const run = (s, seconds, c) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...s.update(0.5, typeof c === 'function' ? c() : c));
  return events;
};
/** A sulker already sat in the cab. */
function sat(id = 'amy') {
  const s = new Sulking({ ...P }, () => 0.5);
  s.update(P.startAfter, ctx());
  s.begin(id);
  run(s, P.goDelayMax + 1, id === 'amy' ? ctx({ cab: 'going' }) : ctx({}, { cab: 'going' }));
  const inCab = id === 'amy' ? ctx({ cab: 'in' }) : ctx({}, { cab: 'in' });
  run(s, 1, inCab);
  expect(s.isIn(id)).toBe(true);
  return { s, inCab };
}

describe('who goes off to sulk', () => {
  it('the girl who came off worse in a falling out may', () => {
    const s = new Sulking({ ...P, fellOutChance: 1 }, () => 0.5);
    s.clock = P.startAfter + 1;
    expect(s.fellOut('race', 'jess', ['amy', 'jess'])).toBe('jess'); // the race's loser
    s.drop('jess');
    s.coolUntil = {};
    expect(s.fellOut('borrow', 'jess', ['amy', 'jess'])).toBe('amy'); // the one whose quad was taken
  });

  it('not before the game has got going, and only one at a time', () => {
    const s = new Sulking({ ...P, fellOutChance: 1 }, () => 0.5);
    expect(s.fellOut('race', 'jess', ['amy', 'jess'])).toBeNull();
    s.clock = P.startAfter + 1;
    s.fellOut('race', 'jess', ['amy', 'jess']);
    expect(s.fellOut('race', 'amy', ['amy', 'jess'])).toBeNull();
    expect(s.begin('amy')).toBe(false);
  });

  it('a neglected girl may sulk over a slight, and only if she is free', () => {
    const s = new Sulking({ ...P, slightChance: 1 }, () => 0.5);
    s.update(P.startAfter + 1, ctx());
    s.update(P.slightEvery + 1, ctx({ neglected: true, free: false }));
    expect(s.who).toBeNull();
    s.update(P.slightEvery + 1, ctx({ neglected: true }));
    expect(s.who).toBe('amy');
  });
});

describe('going and sitting', () => {
  it('storms off after a moment, once free, and is in when the cab says so', () => {
    const s = new Sulking({ ...P }, () => 0.5);
    s.begin('jess');
    expect(run(s, 1, ctx()).some((e) => e.type === 'go')).toBe(false);
    const ev = run(s, P.goDelayMax, ctx({}, { cab: 'going' }));
    expect(ev.filter((e) => e.type === 'go')).toEqual([{ type: 'go', girl: 'jess', why: 'forced' }]);
    expect(run(s, 1, ctx({}, { cab: 'in' })).map((e) => e.type)).toEqual(['in']);
  });

  it('gives up if she never gets there, and cools off before sulking again', () => {
    const s = new Sulking({ ...P }, () => 0.5);
    s.begin('amy');
    const ev = run(s, P.goDelayMax + P.goTimeout + 5, ctx());
    expect(ev.some((e) => e.type === 'over')).toBe(true);
    expect(s.who).toBeNull();
    expect(s.coolUntil.amy).toBeGreaterThan(s.clock);
  });

  it('gets out on her own after a while', () => {
    const { s, inCab } = sat('amy');
    const ev = run(s, P.stayMax + 5, inCab);
    expect(ev).toEqual([{ type: 'out', girl: 'amy', why: 'time' }]);
    expect(s.who).toBeNull();
  });

  it('it ends if the cab goes from under her', () => {
    const { s } = sat('jess');
    expect(run(s, 1, ctx()).map((e) => e.type)).toEqual(['over']);
  });
});

describe('knocking on the window', () => {
  const wait = (s, seconds) => run(s, seconds, ctx({ cab: 'in' }));

  it('Amy ignores the first, answers the second, and forgives on the third', () => {
    const { s } = sat('amy');
    expect(s.knock('amy').kind).toBe('ignored');
    wait(s, 4);
    expect(s.knock('amy').kind).toBe('answer');
    wait(s, 4);
    expect(s.knock('amy').kind).toBe('forgive');
    expect(run(s, 1, ctx({ cab: 'in' }))).toEqual([{ type: 'out', girl: 'amy', why: 'round' }]);
  });

  it('a neglected Amy wants one more knock', () => {
    const { s } = sat('amy');
    const kinds = [];
    for (let i = 0; i < 4; i++) {
      kinds.push(s.knock('amy', { neglected: true }).kind);
      wait(s, 4);
    }
    expect(kinds).toEqual(['ignored', 'answer', 'answer', 'forgive']);
  });

  it('Jess revs at you three times and then gives in', () => {
    const { s } = sat('jess');
    const kinds = [];
    for (let i = 0; i < 4; i++) {
      kinds.push(s.knock('jess').kind);
      run(s, 4, ctx({}, { cab: 'in' }));
    }
    expect(kinds).toEqual(['rev', 'rev', 'rev', 'relent']);
  });

  it('a knock that does not do it takes time off her sulk', () => {
    const { s } = sat('amy');
    const before = s.mine.until;
    s.knock('amy');
    expect(s.mine.until).toBeCloseTo(before - P.knockCut);
  });

  it('knocking too fast makes her worse, and starts the count again', () => {
    const { s } = sat('amy');
    const before = s.mine.until;
    const kinds = [];
    for (let i = 0; i < P.pushMax; i++) {
      kinds.push(s.knock('amy').kind);
      s.update(0.5, ctx({ cab: 'in' }));
    }
    expect(kinds).toContain('pushed');
    expect(s.mine.until).toBeGreaterThan(before);
  });

  it('nobody to knock on, nothing happens', () => {
    const s = new Sulking({ ...P }, () => 0.5);
    expect(s.knock('amy')).toBeNull();
    const { s: other } = sat('amy');
    expect(other.knock('jess')).toBeNull();
  });
});

describe('the cab', () => {
  it('knows when a girl is sulking in it, so nobody else gets in with her', () => {
    const c = new CabShelter(undefined, () => 0.5);
    const cabs = [{ id: 'landy', x: 0, z: 0, open: true, seats: 2, running: false, warm: true }, { id: 'utv', x: 3, z: 0, open: true, seats: 2, running: false, warm: false }];
    const e = c.force('amy', { girls: [{ id: 'amy', x: 1, z: 0, free: true, cab: null }], cabs, rain: 0, warmth: 1 }, 'sulk');
    expect(e).toMatchObject({ type: 'go', cab: 'landy', reason: 'sulk', start: true }); // a Land Rover, started for the heat
    expect(c.isSulkCab('landy')).toBe(true);
    expect(c.isSulkCab('utv')).toBe(false);
  });

  it('does not let her out on the weather or time: the sulk decides', () => {
    const c = new CabShelter(undefined, () => 0.5);
    const cabs = [{ id: 'landy', x: 0, z: 0, open: true, seats: 2, running: true, warm: true }];
    c.force('amy', { girls: [{ id: 'amy', x: 1, z: 0, free: true, cab: null }], cabs, rain: 0, warmth: 1 }, 'sulk');
    const inCab = { girls: [{ id: 'amy', x: 0, z: 0, free: false, cab: 'landy' }], cabs, rain: 0, warmth: 1 };
    const events = [];
    for (let t = 0; t < 600; t += 1) events.push(...c.update(1, inCab));
    expect(events.map((e) => e.type)).toEqual(['in']);
  });
});

describe('her lines', () => {
  it('both girls have lines for what she does, and nobody is called he, she or they', () => {
    for (const k of ['sulkGo', 'sulkPushed', 'sulkRound', 'sulkOut']) {
      expect(AMY_SULK_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_SULK_LINES[k].length).toBeGreaterThan(0);
    }
    expect(AMY_SULK_LINES.sulkAnswer.lines.length).toBeGreaterThan(0);
    expect(JESS_SULK_LINES.sulkAnswer.length).toBeGreaterThan(0);
    const all = [...Object.values(AMY_SULK_LINES).flatMap((l) => l.lines), ...Object.values(JESS_SULK_LINES).flat()].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
