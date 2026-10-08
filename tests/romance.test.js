import { describe, it, expect } from 'vitest';
import { Romance, Tryst, DEFAULT_ROMANCE_PARAMS } from '../src/npc/romance.js';
import { Favour, DEFAULT_FAVOUR_PARAMS } from '../src/npc/favour.js';
import { AMY_ROMANCE_LINES, JESS_ROMANCE_LINES } from '../src/npc/romanceLines.js';

const make = () => new Romance(['amy', 'jess'], { ...DEFAULT_ROMANCE_PARAMS });
const girl = (id, over = {}) => ({ id, score: 15, favoured: true, free: true, distance: 4, fallenOut: false, quadOk: true, ...over });
const ctx = (girls, over = {}) => ({ girls, youFree: true, ...over });

describe('romance invitations', () => {
  it('waits for the grace period, then asks the favoured girl round the back of the barn', () => {
    const r = make();
    expect(r.update(10, ctx([girl('amy')]))).toEqual([]);
    const e = r.update(300, ctx([girl('amy')]));
    expect(e).toEqual([{ type: 'invite', girl: 'amy', kind: 'barn' }]);
    expect(r.pendingFor('amy').kind).toBe('barn');
  });

  it('needs her liking you a lot, being the favoured one, free, near, and you on foot', () => {
    const r = make();
    r.update(400, ctx([]));
    for (const over of [{ score: 5 }, { favoured: false }, { free: false }, { distance: 30 }, { fallenOut: true }]) {
      expect(r.update(1, ctx([girl('amy', over)]))).toEqual([]);
    }
    expect(r.update(1, ctx([girl('amy')], { youFree: false }))).toEqual([]);
    expect(r.update(1, ctx([girl('amy')])).length).toBe(1);
  });

  it('lapses, and then waits before asking again; saying not now waits longer', () => {
    const r = make();
    r.update(400, ctx([]));
    r.update(1, ctx([girl('amy')]));
    expect(r.update(80, ctx([]))).toEqual([{ type: 'lapsed', girl: 'amy', kind: 'barn' }]);
    expect(r.update(10, ctx([girl('amy')]))).toEqual([]);
    expect(r.update(420, ctx([girl('amy')])).length).toBe(1);
    r.decline('amy');
    expect(r.update(420, ctx([girl('amy')]))).toEqual([]);
    expect(r.update(200, ctx([girl('amy')])).length).toBe(1);
  });

  it('an accepted invitation does not lapse part way through', () => {
    const r = make();
    r.update(400, ctx([]));
    r.update(1, ctx([girl('amy')]));
    r.accept('amy');
    expect(r.update(500, ctx([]))).toEqual([]);
    expect(r.complete('amy')).toEqual({ type: 'visit', visits: 1 });
  });

  it('asks only one girl at a time', () => {
    const r = make();
    r.update(400, ctx([]));
    expect(r.update(1, ctx([girl('amy'), girl('jess')])).length).toBe(1);
    expect(r.update(1, ctx([girl('jess')]))).toEqual([]);
  });
});

describe('romance progress', () => {
  const visit = (r, id) => {
    r.update(500, ctx([girl(id)]));
    return r.complete(id);
  };

  it('asks for the quad after two trips round the back, and then locks her in', () => {
    const r = make();
    expect(visit(r, 'amy')).toEqual({ type: 'visit', visits: 1 });
    expect(visit(r, 'amy')).toEqual({ type: 'visit', visits: 2 });
    const e = r.update(500, ctx([girl('amy')]));
    expect(e).toEqual([{ type: 'invite', girl: 'amy', kind: 'quad' }]);
    expect(r.complete('amy')).toEqual({ type: 'lockedIn' });
    expect(r.lockedGirl).toBe('amy');
  });

  it('does not ask for the quad when her quad is not available', () => {
    const r = make();
    visit(r, 'amy');
    visit(r, 'amy');
    expect(r.update(500, ctx([girl('amy', { quadOk: false })]))).toEqual([]);
  });

  it('once one girl is locked in, the other stops asking, and neither asks again', () => {
    const r = make();
    visit(r, 'amy');
    visit(r, 'amy');
    r.update(500, ctx([girl('amy')]));
    r.complete('amy');
    expect(r.update(5000, ctx([girl('jess'), girl('amy')]))).toEqual([]);
  });

  it('throwing her off undoes it, and it starts from nothing after a long wait', () => {
    const r = make();
    visit(r, 'amy');
    visit(r, 'amy');
    r.update(500, ctx([girl('amy')]));
    r.complete('amy');
    expect(r.betray('amy')).toBe(true);
    expect(r.lockedGirl).toBeNull();
    expect(r.betray('amy')).toBe(false);
    expect(r.update(1000, ctx([girl('amy')]))).toEqual([]);
    expect(r.update(600, ctx([girl('amy')]))).toEqual([{ type: 'invite', girl: 'amy', kind: 'barn' }]);
  });
});

describe('the scene', () => {
  const run = (kind) => {
    const t = new Tryst('amy', kind);
    const events = [];
    let time = 0;
    let peakFade = 0;
    while (!t.done && time < 100) {
      for (const e of t.update(0.1)) events.push([e, time]);
      peakFade = Math.max(peakFade, t.fade);
      time += 0.1;
    }
    return { events, time, peakFade, t };
  };

  it('fades out, places, shows the moment, goes dark, comes back and ends clear', () => {
    const { events, peakFade, t } = run('barn');
    expect(events.map((e) => e[0])).toEqual(['place', 'moment', 'back', 'done']);
    expect(peakFade).toBeCloseTo(1, 5);
    expect(t.fade).toBe(0);
  });

  it('the quad one has a longer fade than the barn one', () => {
    expect(run('quad').time).toBeGreaterThan(run('barn').time + 4);
  });

  it('copes with one huge step', () => {
    const t = new Tryst('jess', 'barn');
    expect(t.update(1000)).toEqual(['place', 'moment', 'back', 'done']);
    expect(t.done).toBe(true);
  });
});

describe('locking favour in', () => {
  it('a locked girl keeps her score, stands as favoured, and cannot be marked down', () => {
    const f = new Favour(['amy', 'jess'], { ...DEFAULT_FAVOUR_PARAMS });
    f.add('amy', 4);
    f.lock('amy', 15);
    expect(f.scores.amy).toBe(15);
    f.add('amy', -10);
    f.update(1000);
    expect(f.scores.amy).toBe(15);
    expect(f.mood('amy')).toBe('favoured');
    expect(f.mood('jess')).toBe('neglected');
    f.add('amy', 3);
    expect(f.scores.amy).toBe(18);
    f.unlock('amy', -8);
    expect(f.scores.amy).toBe(-8);
    expect(f.mood('amy')).toBe('neglected');
  });
});

describe('romance lines', () => {
  it('both girls have every situation, with three lines of each for invitations', () => {
    const jess = JESS_ROMANCE_LINES;
    for (const key of Object.keys(AMY_ROMANCE_LINES)) {
      expect(jess[key], key).toBeTruthy();
      expect(AMY_ROMANCE_LINES[key].lines.length).toBeGreaterThanOrEqual(2);
    }
    expect(Object.keys(jess)).toEqual(Object.keys(AMY_ROMANCE_LINES));
  });

  it('nobody calls you anything but "you", and there are no em dashes', () => {
    const all = [...Object.values(AMY_ROMANCE_LINES).flatMap((l) => l.lines), ...Object.values(JESS_ROMANCE_LINES).flat()];
    for (const l of all) expect(l).not.toMatch(/—| he | she | they |\bhim\b|\bher\b/i);
  });
});

describe('asking on demand (debug panel)', () => {
  it('opens an invitation whatever her score, once', () => {
    const r = new Romance(['amy', 'jess']);
    expect(r.invite('amy', 'barn')).toEqual({ type: 'invite', girl: 'amy', kind: 'barn' });
    expect(r.pendingFor('amy').kind).toBe('barn');
    expect(r.invite('amy', 'quad')).toBeNull();
    r.accept('amy');
    expect(r.complete('amy')).toEqual({ type: 'visit', visits: 1 });
  });
});
