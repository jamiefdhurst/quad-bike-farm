import { describe, it, expect } from 'vitest';
import { FaultShout, visibleFaults, DEFAULT_SHOUT_PARAMS as P } from '../src/npc/shoutFault.js';
import { AMY_SHOUT_LINES, JESS_SHOUT_LINES } from '../src/npc/shoutFaultLines.js';

// You at the origin heading +z (yaw 0), so behind you is negative z.
const you = (o = {}) => ({ x: 0, z: 0, yaw: 0, speed: 6, ...o });
const clean = { oil: 0, steam: 0, diesel: 0, tyre: 0, hanging: 0 };
const girls = (o = {}) => [
  { id: 'amy', x: 0, z: -8, watching: true, ...o.amy },
  { id: 'jess', x: 3, z: -10, watching: true, ...o.jess },
];
const run = (s, ctx, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += 0.25) events.push(...s.update(0.25, ctx));
  return events;
};
const make = () => new FaultShout({ ...P });

describe('shouting a fault', () => {
  it('sees only what is bad enough, worst first', () => {
    expect(visibleFaults(clean, P)).toEqual([]);
    expect(visibleFaults({ ...clean, tyre: 0.4 }, P)).toEqual(['tyre']);
    expect(visibleFaults({ ...clean, tyre: 0.9 }, P)).toEqual(['wobble']);
    expect(visibleFaults({ ...clean, oil: 0.6, steam: 0.5 }, P)).toEqual(['steam', 'smoke']);
    expect(visibleFaults({ ...clean, diesel: 0.5 }, P)).toEqual(['smoke']);
    expect(visibleFaults({ ...clean, hanging: 0.6 }, P)).toEqual(['hanging']);
  });

  it('Amy behind you shouts about smoke after a moment, and Jess later', () => {
    const s = make();
    const ctx = { quad: you(), signs: { ...clean, oil: 0.8 }, girls: girls() };
    expect(run(s, ctx, 0.75)).toEqual([]);
    const first = run(s, ctx, 3);
    expect(first.map((e) => e.girl)).toEqual(['amy', 'jess']);
    expect(first.every((e) => e.what === 'smoke')).toBe(true);
  });

  it('says nothing when the quad is fine, stopped, or she cannot see it', () => {
    expect(run(make(), { quad: you(), signs: clean, girls: girls() }, 10)).toEqual([]);
    expect(run(make(), { quad: you({ speed: 0.5 }), signs: { ...clean, steam: 0.6 }, girls: girls() }, 10)).toEqual([]);
    expect(run(make(), { quad: null, signs: {}, girls: girls() }, 10)).toEqual([]);
    const bad = { ...clean, tyre: 0.5 };
    expect(run(make(), { quad: you(), signs: bad, girls: girls({ amy: { z: -60 }, jess: { watching: false } }) }, 10)).toEqual([]);
    // Ahead of you, she sees your face, not your back.
    expect(run(make(), { quad: you(), signs: bad, girls: girls({ amy: { z: 10 }, jess: { z: 12 } }) }, 10)).toEqual([]);
  });

  it('alongside counts, and a girl who looks away has to start over', () => {
    const s = make();
    const bad = { ...clean, hanging: 0.8 };
    expect(run(s, { quad: you(), signs: bad, girls: girls({ amy: { x: 4, z: 0 } }) }, 2).map((e) => e.what)).toEqual(['hanging']);
    const t = make();
    run(t, { quad: you(), signs: bad, girls: girls() }, 1);
    run(t, { quad: you(), signs: bad, girls: girls({ amy: { watching: false } }) }, 1);
    expect(run(t, { quad: you(), signs: bad, girls: girls({ jess: { watching: false } }) }, 0.75)).toEqual([]);
  });

  it('does not repeat itself straight away, and one shout at a time', () => {
    const s = make();
    const ctx = { quad: you(), signs: { ...clean, steam: 0.6, tyre: 0.5 }, girls: girls({ jess: { watching: false } }) };
    // Steam first, being worse; the tyre waits out her gap; neither is said twice inside the same-thing gap.
    expect(run(s, ctx, 60)).toEqual([{ girl: 'amy', what: 'steam' }, { girl: 'amy', what: 'tyre' }]);
    expect(run(s, ctx, 20).map((e) => e.what)).toEqual(['steam']);
  });

  it('has lines for every situation, for both girls, all shouted', () => {
    for (const what of ['Smoke', 'Steam', 'Tyre', 'Wobble', 'Hanging']) {
      const k = `shout${what}`;
      expect(AMY_SHOUT_LINES[k].lines.length).toBeGreaterThan(1);
      expect(AMY_SHOUT_LINES[k].shout).toBe(true);
      expect(JESS_SHOUT_LINES[k].length).toBeGreaterThan(1);
    }
  });
});
