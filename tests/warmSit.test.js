import { describe, it, expect } from 'vitest';
import { WarmSit, DEFAULT_WARMSIT_PARAMS as P } from '../src/npc/warmSit.js';
import { AMY_WARMSIT_LINES, JESS_WARMSIT_LINES } from '../src/npc/warmSitLines.js';

const girl = (o = {}) => ({ id: 'amy', ready: true, temperature: 0.1, warm: false, youDistance: 30, youOn: false, ...o });
const step = (w, g, dt = 0.5) => w.update(dt, { girls: [g] });
const sat = (random = () => 0.5) => {
  const w = new WarmSit({ ...P }, random);
  w.begin('amy');
  expect(step(w, girl()).map((e) => e.type)).toEqual(['in']);
  return w;
};

describe('deciding', () => {
  it('sits three times in four, and asks only if you are near enough to hear', () => {
    const rolls = (values) => {
      let i = 0;
      return () => values[i++ % values.length];
    };
    expect(new WarmSit({ ...P }, rolls([0.9])).decide(true, 3)).toBe('beside'); // over 0.75
    expect(new WarmSit({ ...P }, rolls([0.5, 0.9])).decide(true, 3)).toBe('sit'); // sits, doesn't ask
    expect(new WarmSit({ ...P }, rolls([0.5, 0.1])).decide(true, 3)).toBe('ask');
    expect(new WarmSit({ ...P }, rolls([0.5, 0.1])).decide(true, P.askRange + 5)).toBe('sit'); // too far to hear
    expect(new WarmSit({ ...P }, rolls([0.1, 0.1])).decide(false, 3)).toBe('beside'); // nowhere to sit
  });

  it('about three quarters of head starts are a sit over many', () => {
    let seed = 11;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const w = new WarmSit({ ...P, askChance: 0 }, rnd);
    let sits = 0;
    for (let i = 0; i < 2000; i++) if (w.decide(true, 30) === 'sit') sits++;
    expect(sits / 2000).toBeGreaterThan(0.7);
    expect(sits / 2000).toBeLessThan(0.8);
  });
});

describe('sitting while it warms', () => {
  it('settles when she is sat on it running; is lost if she never gets there or it dies', () => {
    const w = new WarmSit({ ...P }, () => 0.5);
    w.begin('amy');
    for (let t = 0; t < P.goTimeout - 5; t += 0.5) expect(step(w, girl({ ready: false }))).toEqual([]);
    expect(step(w, girl({ ready: false }), 10).map((e) => e.type)).toEqual(['lost']);
    const s = sat();
    expect(step(s, girl({ ready: false })).map((e) => e.type)).toEqual(['lost']);
  });

  it('notices it starting to smooth out, and is disappointed when it has, each once', () => {
    const w = sat();
    expect(step(w, girl({ temperature: P.smoothFrom - 0.05 }))).toEqual([]);
    expect(step(w, girl({ temperature: P.smoothFrom + 0.05 })).map((e) => e.type)).toEqual(['smoothing']);
    expect(step(w, girl({ temperature: 0.55 }))).toEqual([]);
    expect(step(w, girl({ temperature: 0.7, warm: true })).map((e) => e.type)).toEqual(['smooth']);
    expect(step(w, girl({ temperature: 0.8, warm: true }))).toEqual([]);
  });

  it('is slow to get off once you arrive: a line, then a few seconds, then off', () => {
    const w = sat();
    expect(step(w, girl({ youDistance: P.arriveRange - 1 })).map((e) => e.type)).toEqual(['slow']);
    expect(w.sitting('amy')).toBe(true);
    expect(step(w, girl({ youDistance: 1 }), 1)).toEqual([]);
    const ev = [];
    for (let t = 0; t < P.slowMax + 1; t += 0.5) ev.push(...step(w, girl({ youDistance: 1 })));
    expect(ev.map((e) => e.type)).toEqual(['off']);
    expect(w.has('amy')).toBe(false);
  });

  it('or if you simply get on it', () => {
    const w = sat();
    expect(step(w, girl({ youOn: true })).map((e) => e.type)).toEqual(['slow']);
  });

  it('gives up and gets off if nobody comes', () => {
    const w = sat();
    const ev = [];
    for (let t = 0; t < P.giveUpAfter + 5; t += 0.5) ev.push(...step(w, girl()));
    expect(ev.map((e) => e.type)).toEqual(['giveUp']);
  });
});

describe('her lines', () => {
  it('both girls have every one, with several for the disappointment, and nobody is called he, she or they', () => {
    for (const key of Object.keys(AMY_WARMSIT_LINES)) {
      expect(JESS_WARMSIT_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_WARMSIT_LINES[key].lines.length).toBeGreaterThan(0);
    }
    expect(AMY_WARMSIT_LINES.warmSitSmooth.lines.length).toBeGreaterThanOrEqual(4);
    expect(JESS_WARMSIT_LINES.warmSitSmooth.length).toBeGreaterThanOrEqual(4);
    const all = [...Object.values(AMY_WARMSIT_LINES).flatMap((l) => l.lines), ...Object.values(JESS_WARMSIT_LINES).flat()].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
