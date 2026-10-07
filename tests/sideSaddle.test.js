import { describe, it, expect } from 'vitest';
import { SideSaddleSlip, pickSideSaddle } from '../src/npc/sideSaddle.js';
import { DEFAULT_COMPANION_PARAMS as P } from '../src/npc/companionParams.js';

const calm = { speed: 8, lateral: 0, up: 0, side: 1, holding: false };
const run = (m, seconds, p = P, s = new SideSaddleSlip()) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.05) {
    const e = s.update(0.05, m, p);
    if (e) events.push(e);
  }
  return { s, events };
};

describe('picking side-saddle', () => {
  it('picks it with her chance and a side either way', () => {
    expect(pickSideSaddle({ sideSaddleChance: 0 }, () => 0)).toBe(0);
    expect(pickSideSaddle({ sideSaddleChance: 1 }, () => 0.1)).toBe(1);
    const seq = [0.1, 0.9];
    expect(pickSideSaddle({ sideSaddleChance: 1 }, () => seq.shift() ?? 0.9)).toBe(-1);
    expect(pickSideSaddle({ sideSaddleChance: 0.35 }, () => 0.5)).toBe(0);
  });
});

describe('slipping', () => {
  it('a gentle ride never has her slip', () => {
    expect(run({ ...calm, lateral: 2, up: 8 }, 60).events).toEqual([]);
  });

  it('a hard corner has her yelp and then slide off', () => {
    // Turning left (positive lateral) throws her to the right, which is the way her legs hang when side is -1.
    const { events } = run({ ...calm, lateral: 9, side: -1 }, 20);
    expect(events[0]).toBe('wobble');
    expect(events).toContain('off');
  });

  it('a big landing does it too', () => {
    expect(run({ ...calm, up: 60 }, 20).events).toContain('off');
  });

  it('is worse thrown the way her legs hang than the other way', () => {
    const toward = run({ ...calm, lateral: 6, side: -1 }, 1).s.slip;
    const away = run({ ...calm, lateral: 6, side: 1 }, 1).s.slip;
    expect(toward).toBeGreaterThan(away);
  });

  it('her arms round you hold her through what would have thrown her', () => {
    const hard = { ...calm, lateral: 6, side: -1 };
    expect(run(hard, 30).events).toContain('off');
    expect(run({ ...hard, holding: true }, 30).events).not.toContain('off');
  });

  it('she recovers, and can not slip when she is slow', () => {
    const s = run({ ...calm, lateral: 6, side: -1 }, 0.6).s;
    expect(s.slip).toBeGreaterThan(0);
    run(calm, 10, P, s);
    expect(s.slip).toBe(0);
    expect(run({ ...calm, speed: 1, lateral: 50, up: 200 }, 10).events).toEqual([]);
  });
});
