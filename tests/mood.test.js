import { describe, it, expect } from 'vitest';
import { Mood, unease, moodState } from '../src/npc/mood.js';
import { Needs } from '../src/npc/needs.js';
import { walkPace } from '../src/npc/intent.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

const calm = { thrill: 0, together: false, warmed: false, chill: 0 };
const run = (mood, needs, ctx, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t++) {
    const e = mood.update(1, needs, ctx, P);
    if (e) events.push(e);
  }
  return events;
};

describe('her mood', () => {
  it('is more uneasy with more pressing, and not at all with nothing wanted', () => {
    expect(unease(new Needs())).toBe(0);
    expect(unease(new Needs({ warmth: 1, purpose: 1, excitement: 1, company: 1, rest: 1 }))).toBeCloseTo(1);
    expect(unease(new Needs({ warmth: 1 }))).toBeGreaterThan(unease(new Needs({ rest: 1 })));
  });

  it('sinks over minutes when she is cold and bored, and says so once', () => {
    const m = new Mood(0);
    const events = run(m, new Needs({ warmth: 1, purpose: 1, excitement: 0.8, company: 0.5 }), calm, 900);
    expect(m.value).toBeLessThan(P.moodLowAt);
    expect(m.state).toBe('low');
    expect(events).toEqual(['low']);
  });

  it('does not swing in a few seconds', () => {
    const m = new Mood(0.1);
    run(m, new Needs({ warmth: 1, purpose: 1 }), calm, 5);
    expect(m.value).toBeGreaterThan(0.05);
  });

  it('is lifted by a good ride', () => {
    const m = new Mood(-0.6);
    run(m, new Needs(), { ...calm, thrill: 1 }, 60);
    expect(m.value).toBeGreaterThan(0);
  });

  it('rises when she is content and with someone', () => {
    const m = new Mood(0);
    const events = run(m, new Needs(), { ...calm, together: true }, 900);
    expect(m.value).toBeGreaterThan(P.moodHighAt - 0.2);
    expect(m.value).toBeLessThanOrEqual(1);
    expect(events.length).toBeLessThanOrEqual(1);
  });

  it('keeps a spell until she is well clear of it', () => {
    expect(moodState(P.moodLowAt + 0.1, 'low', P)).toBe('low');
    expect(moodState(P.moodLowAt + 0.1, 'ok', P)).toBe('ok');
  });

  it('remarks no more than once a gap, however often she swings', () => {
    const p = { ...P, moodRemarkGap: 100000 };
    const m = new Mood(0);
    const cold = new Needs({ warmth: 1, purpose: 1, excitement: 1, company: 1, rest: 1 });
    const events = [];
    for (let i = 0; i < 4; i++) {
      for (let t = 0; t < 600; t++) events.push(m.update(1, cold, calm, p));
      for (let t = 0; t < 600; t++) events.push(m.update(1, new Needs(), { ...calm, thrill: 1, together: true }, p));
    }
    expect(events.filter(Boolean)).toHaveLength(1);
  });

  it('slows her walk low and quickens it high, and makes her less keen low', () => {
    const m = new Mood(-1);
    expect(m.pace(P)).toBeCloseTo(1 - P.moodPace);
    expect(m.keen(P)).toBeCloseTo(P.moodKeenLow);
    m.value = 1;
    expect(m.pace(P)).toBeCloseTo(1 + P.moodPace);
    expect(m.keen(P)).toBeCloseTo(P.moodKeenHigh);
    m.value = 0;
    expect(m.keen(P)).toBe(1);
    expect(walkPace(null, { wet: false, tired: 0, excited: 0, mood: 0.85 }, P).mul).toBeCloseTo(0.85);
  });
});
