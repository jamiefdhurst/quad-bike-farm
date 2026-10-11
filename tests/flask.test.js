import { describe, it, expect } from 'vitest';
import { Flask, DEFAULT_FLASK_PARAMS as P, FLASK_PARAM_RANGES, sitLines } from '../src/npc/flask.js';
import { AMY_FLASK_LINES, JESS_FLASK_LINES } from '../src/npc/flaskLines.js';
import { OFFER_KINDS } from '../src/npc/chooser.js';

const fine = { rain: 0, darkness: 0, cold: false, sunny: true };
const girlCtx = (o = {}) => ({ girl: { free: true, seated: false, x: 0, z: 0, ...o.girl }, youDistance: 3, favoured: false, weather: fine, ...o, girl: { free: true, seated: false, x: 0, z: 0, ...o.girl } });
const offerCtx = (o = {}) => ({ girls: [{ id: 'amy', free: true, distance: 10 }], youDistance: 5, youSlow: true, weather: fine, ...o });

describe('flask offers', () => {
  it('waits for the start, the weather, you being near and slow, and the cooldown', () => {
    const f = new Flask({ ...P });
    expect(f.offers(offerCtx())).toEqual([]);
    f.update(P.startAfter + 1, { girl: null, youDistance: 0, weather: fine });
    expect(f.offers(offerCtx()).map((o) => o.girl)).toEqual(['amy']);
    expect(f.offers(offerCtx({ weather: { ...fine, rain: 0.5 } }))).toEqual([]);
    expect(f.offers(offerCtx({ weather: { ...fine, darkness: 0.9 } }))).toEqual([]);
    expect(f.offers(offerCtx({ youDistance: P.offerRange + 1 }))).toEqual([]);
    expect(f.offers(offerCtx({ youSlow: false }))).toEqual([]);
    expect(f.offers(offerCtx({ girls: [{ id: 'amy', free: false, distance: 5 }] }))).toEqual([]);
    expect(f.offers(offerCtx({ girls: [{ id: 'amy', free: true, distance: P.girlRange + 1 }] }))).toEqual([]);
  });

  it('is a chooser offer kind', () => expect(OFFER_KINDS.flask.satisfies).toBeTruthy());
});

describe('a session', () => {
  function run(f, ctx, seconds, dt = 0.5) {
    const events = [];
    for (let t = 0; t < seconds; t += dt) events.push(...f.update(dt, typeof ctx === 'function' ? ctx() : ctx));
    return events;
  }

  it('goes to the rock, pours, speaks and ends done with a cooldown', () => {
    const f = new Flask({ ...P });
    expect(f.begin('amy', 'asked')).toEqual({ type: 'go', girl: 'amy', how: 'asked' });
    expect(f.begin('jess', 'asked')).toBeNull();
    expect(run(f, girlCtx(), 5)).toEqual([]); // still on her way
    const events = run(f, girlCtx({ girl: { seated: true } }), P.pourSeconds + P.sitSeconds + 2);
    const types = events.map((e) => e.type + (e.line ?? ''));
    expect(types).toContain('pour');
    expect(types).toContain('sayflaskPour');
    expect(types).toContain('sayflaskView');
    expect(types).toContain('sayflaskSun');
    expect(types).not.toContain('sayflaskRomance');
    expect(events.at(-1)).toEqual({ type: 'end', girl: 'amy', why: 'done' });
    expect(f.active).toBe(false);
    expect(f.offers(offerCtx())).toEqual([]); // cooldown
  });

  it('adds the weather and romance lines', () => {
    expect(sitLines({ cold: true, sunny: false }, true).map((l) => l.line)).toEqual(['flaskView', 'flaskCold', 'flaskRomance']);
    expect(sitLines({ cold: false, sunny: false }, false).map((l) => l.line)).toEqual(['flaskView']);
  });

  it('packs up when you walk off, with no cooldown', () => {
    const f = new Flask({ ...P });
    f.begin('amy', 'asked');
    run(f, girlCtx({ girl: { seated: true } }), P.pourSeconds + 3);
    const events = run(f, girlCtx({ girl: { seated: true }, youDistance: P.stayRange + 5 }), P.leaveAfter + 1);
    expect(events.map((e) => e.line ?? e.why)).toEqual(['flaskLeft', 'left']);
    expect(f.cooldownUntil).toBe(0);
  });

  it('ends if the weather turns, she is lost, or she never gets there', () => {
    let f = new Flask({ ...P });
    f.begin('amy', 'asked');
    expect(run(f, girlCtx({ weather: { ...fine, rain: 0.8 } }), 1).at(-1).why).toBe('weather');
    f = new Flask({ ...P });
    f.begin('amy', 'asked');
    expect(run(f, { girl: null, youDistance: 1, weather: fine }, 1).at(-1).why).toBe('lost');
    f = new Flask({ ...P });
    f.begin('amy', 'asked');
    expect(run(f, girlCtx(), P.goTimeout + 2).at(-1).why).toBe('lost');
  });

  it('waits for a girl on a quad to get off first', () => {
    const f = new Flask({ ...P });
    expect(f.begin('jess', 'asked', { seated: true }).type).toBe('getOff');
    expect(run(f, girlCtx({ girl: { free: false } }), 3)).toEqual([]);
    expect(run(f, girlCtx(), 1)[0]).toEqual({ type: 'go', girl: 'jess' });
    const g = new Flask({ ...P });
    g.begin('jess', 'asked', { seated: true });
    expect(run(g, girlCtx({ girl: { free: false } }), P.getOffTimeout + 1).at(-1).why).toBe('lost');
  });
});

describe('flask tuning and lines', () => {
  it('has a range for every parameter', () => {
    expect(Object.keys(FLASK_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('gives both girls every line, never calling you he, she or they', () => {
    for (const key of Object.keys(AMY_FLASK_LINES)) {
      expect(JESS_FLASK_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_FLASK_LINES[key].lines.length).toBeGreaterThan(0);
    }
    expect(Object.keys(JESS_FLASK_LINES).sort()).toEqual(Object.keys(AMY_FLASK_LINES).sort());
    const all = [...Object.values(AMY_FLASK_LINES).flatMap((l) => l.lines), ...Object.values(JESS_FLASK_LINES).flat()].join(' ');
    expect(all).not.toMatch(/—|\b(he|she|they)\b/i);
  });
});
