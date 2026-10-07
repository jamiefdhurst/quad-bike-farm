import { describe, it, expect } from 'vitest';
import { BarnFumes, fumesOutput, DEFAULT_FUMES_PARAMS as P } from '../src/world/barnFumes.js';
import { AMY_FUMES_LINES, JESS_FUMES_LINES } from '../src/npc/fumesLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

const engine = (o = {}) => ({ id: 'red', running: true, throttle: 0, twoStroke: false, diesel: false, inside: true, attended: false, ...o });
const ctx = (o = {}) => ({ wind: 0.3, engines: [engine()], girls: [], amyFree: false, ...o });
const run = (f, c, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.5) events.push(...f.update(0.5, c));
  return events;
};

describe('fumes in the barn', () => {
  it('only a running engine inside feeds it, more on the throttle, more from a two-stroke or a diesel', () => {
    expect(fumesOutput(engine({ running: false }), P)).toBe(0);
    expect(fumesOutput(engine({ inside: false }), P)).toBe(0);
    expect(fumesOutput(engine({ throttle: 1 }), P)).toBeGreaterThan(fumesOutput(engine(), P));
    expect(fumesOutput(engine({ twoStroke: true }), P)).toBeGreaterThan(fumesOutput(engine(), P));
    expect(fumesOutput(engine({ diesel: true }), P)).toBeGreaterThan(fumesOutput(engine(), P));
  });

  it('fills within a minute or so of idling, and a quad outside does nothing', () => {
    const f = new BarnFumes();
    run(f, ctx(), 60);
    expect(f.visible).toBe(true);
    expect(f.level).toBeGreaterThan(P.coughAt);
    const g = new BarnFumes();
    run(g, ctx({ engines: [engine({ inside: false })] }), 300);
    expect(g.level).toBe(0);
  });

  it('clears slowly once everything is off', () => {
    const f = new BarnFumes();
    run(f, ctx(), 120);
    const full = f.level;
    run(f, ctx({ engines: [] }), 30);
    expect(f.level).toBeLessThan(full);
    expect(f.level).toBeGreaterThan(full * 0.5);
    run(f, ctx({ engines: [] }), 400);
    expect(f.visible).toBe(false);
  });

  it('a free girl inside coughs once it is thick, not again straight away, and a girl outside does not', () => {
    const f = new BarnFumes();
    const girls = [{ id: 'amy', free: true, inside: true }, { id: 'jess', free: true, inside: false }, { id: 'busy', free: false, inside: true }];
    const events = run(f, ctx({ girls }), P.coughGap + 80).filter((e) => e.type === 'cough');
    expect(new Set(events.map((e) => e.girl))).toEqual(new Set(['amy']));
    expect(events.length).toBeLessThanOrEqual(2); // the gap holds her off between goes
  });

  it('Amy goes to the doorway for an unattended engine and switches it off after a few seconds', () => {
    const f = new BarnFumes();
    run(f, ctx(), 150);
    const events = [];
    let on = true;
    for (let t = 0; t < 10 && on; t += 0.5) {
      for (const e of f.update(0.5, ctx({ amyFree: true, engines: [engine({ running: on })] }))) {
        events.push(e);
        if (e.type === 'switchOff') on = false;
      }
    }
    expect(events.filter((e) => e.type === 'amyGoes')).toEqual([{ type: 'amyGoes', engine: 'red' }]);
    expect(events.filter((e) => e.type === 'switchOff')).toEqual([{ type: 'switchOff', engine: 'red' }]);
  });

  it('gives up if the engine stalls or someone gets on it before she arrives', () => {
    const f = new BarnFumes();
    run(f, ctx(), 150);
    f.update(0.5, ctx({ amyFree: true }));
    expect(f.going).not.toBeNull();
    const events = run(f, ctx({ amyFree: true, engines: [engine({ attended: true })] }), 10);
    expect(events.some((e) => e.type === 'switchOff')).toBe(false);
  });

  it('tells you off instead when you are on it, but not over and over', () => {
    const f = new BarnFumes();
    const events = run(f, ctx({ amyFree: true, engines: [engine({ attended: true })] }), 150);
    const tells = events.filter((e) => e.type === 'tell');
    expect(tells.length).toBeGreaterThan(0);
    expect(tells.length).toBeLessThan(5);
    expect(events.some((e) => e.type === 'switchOff')).toBe(false);
  });

  it('has lines for it', () => {
    for (const s of Object.keys(AMY_FUMES_LINES)) expect(VOICE_LINES).toHaveProperty(s);
    for (const s of Object.keys(JESS_FUMES_LINES)) expect(JESS_LINES).toHaveProperty(s);
    expect(AMY_FUMES_LINES.fumesSwitchOff.lines.length).toBeGreaterThan(0);
  });
});
