import { describe, it, expect } from 'vitest';
import { ReadyWaiting, DEFAULT_READY_PARAMS as P } from '../src/npc/readyWaiting.js';
import { Horns } from '../src/npc/horns.js';
import { AMY_READY_LINES, JESS_READY_LINES } from '../src/npc/readyLines.js';

const girl = (id, o = {}) => ({ id, ready: true, youDistance: 30, youOn: false, ...o });
function run(w, seconds, ctx, step = 0.5) {
  const events = [];
  for (let t = 0; t < seconds; t += step) events.push(...w.update(step, { girls: [typeof ctx === 'function' ? ctx() : ctx].flat() }));
  return events;
}
const settled = (id) => {
  const w = new ReadyWaiting({ ...P }, () => 0.5);
  w.begin(id);
  run(w, 1, girl(id));
  expect(w.waiting(id)).toBe(true);
  return w;
};

describe('getting ready', () => {
  it('goes, then settles once she is sat on the running quad', () => {
    const w = new ReadyWaiting({ ...P }, () => 0.5);
    w.begin('jess');
    expect(run(w, 5, girl('jess', { ready: false })).length).toBe(0);
    expect(w.has('jess')).toBe(true);
    expect(w.waiting('jess')).toBe(false);
    expect(run(w, 1, girl('jess')).map((e) => e.type)).toEqual(['waiting']);
  });

  it('is lost if she never gets going', () => {
    const w = new ReadyWaiting({ ...P }, () => 0.5);
    w.begin('amy');
    const ev = run(w, P.goTimeout + 5, girl('amy', { ready: false }));
    expect(ev.map((e) => e.type)).toEqual(['lost']);
    expect(w.has('amy')).toBe(false);
  });

  it('is lost if the quad dies under her once she is waiting', () => {
    const w = settled('amy');
    expect(run(w, 1, girl('amy', { ready: false })).map((e) => e.type)).toEqual(['lost']);
  });
});

describe('waiting', () => {
  it('revs now and then, well apart', () => {
    const w = settled('amy');
    const revs = run(w, 100, girl('amy')).filter((e) => e.type === 'rev');
    expect(revs.length).toBeGreaterThanOrEqual(2);
    expect(revs.length).toBeLessThanOrEqual(5);
    expect(revs[0].seconds).toBe(P.revSeconds);
  });

  it('toots as the minute stretches: Jess before Amy, closer together and longer as it goes', () => {
    const toots = (id) => {
      const w = settled(id);
      const out = [];
      for (let t = 0; t < 120; t += 0.5) for (const e of w.update(0.5, { girls: [girl(id)] })) if (e.type === 'toot') out.push({ ...e, at: t });
      return out;
    };
    const jess = toots('jess');
    const amy = toots('amy');
    expect(jess[0].at).toBeLessThan(amy[0].at);
    expect(jess.length).toBeGreaterThan(amy.length);
    const gaps = jess.slice(1).map((e, i) => e.at - jess[i].at);
    expect(gaps[gaps.length - 1]).toBeLessThan(gaps[0]);
    expect(jess[0].length).toBe(P.tootLength);
    expect(jess[jess.length - 1].length).toBe(P.tootLongLength);
    expect(jess.filter((e) => e.impatient)).toHaveLength(1);
  });

  it('is done the moment you come back or get on', () => {
    const near = settled('jess');
    expect(run(near, 1, girl('jess', { youDistance: P.doneRange - 1 })).map((e) => e.type)).toEqual(['here']);
    expect(near.has('jess')).toBe(false);
    const on = settled('amy');
    expect(run(on, 1, girl('amy', { youOn: true })).map((e) => e.type)).toEqual(['here']);
  });

  it('gives up if you take too long, Jess sooner than Amy', () => {
    const endsAt = (id) => {
      const w = settled(id);
      for (let t = 0; t < 400; t += 0.5) {
        if (w.update(0.5, { girls: [girl(id)] }).some((e) => e.type === 'giveUp')) return t;
      }
      return Infinity;
    };
    expect(endsAt('jess')).toBeLessThan(endsAt('amy'));
    expect(endsAt('amy')).toBeLessThan(260);
  });

  it('sometimes switches it off as she gives up', () => {
    for (const [roll, keyOff] of [[0.1, true], [0.9, false]]) {
      const w = new ReadyWaiting({ ...P }, () => roll);
      w.begin('jess');
      run(w, 1, girl('jess'));
      const ev = run(w, P.giveUpJess + 5, girl('jess')).find((e) => e.type === 'giveUp');
      expect(ev.keyOff).toBe(keyOff);
    }
  });
});

describe('the horn', () => {
  it('sounds for the length she asks, and not while already at it', () => {
    const h = new Horns();
    expect(h.toot('jess', 0.5)).toBe(true);
    expect(h.beeping('jess')).toBe(true);
    expect(h.toot('jess', 0.5)).toBe(false);
    for (let i = 0; i < 12; i++) h.update(0.1, { you: { x: 0, z: 0, honking: false }, girls: [{ id: 'jess', x: 0, z: 0, yaw: 0, speed: 0, canHonk: true, driving: false }] });
    expect(h.beeping('jess')).toBe(false);
  });
});

describe('her lines', () => {
  it('both girls have every one, and nobody is called he, she or they', () => {
    for (const key of Object.keys(AMY_READY_LINES)) {
      expect(JESS_READY_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_READY_LINES[key].lines.length).toBeGreaterThan(0);
    }
    const all = [...Object.values(AMY_READY_LINES).flatMap((l) => l.lines), ...Object.values(JESS_READY_LINES).flat()].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
