import { describe, it, expect } from 'vitest';
import { RiverWatch, DEFAULT_RIVER_WATCH_PARAMS as P } from '../src/npc/riverWatch.js';
import { AMY_RIVER_LINES, JESS_RIVER_LINES } from '../src/npc/riverLines.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, x: 10, z: 0, ...over.amy },
  { id: 'jess', free: true, x: 12, z: 0, ...over.jess },
];
const crossing = { x: 0, z: 0 };
const ctx = (over = {}) => ({ you: { x: 40, z: 0 }, crossing, drowned: false, girls: girls(), ...over });
// In the deep water well out from the crossing's middle, with both girls in earshot.
const deep = { you: { x: 30, z: 0 }, drowned: true, girls: girls({ amy: { x: 25 }, jess: { x: 27 } }) };
const out = { you: { x: 30, z: 0 }, girls: deep.girls };
const make = (random = () => 0) => new RiverWatch({ ...P }, random);

describe('coming to the crossing', () => {
  it('is remarked on once, as you come within reach of it', () => {
    const w = make();
    expect(w.update(0.1, ctx())).toEqual([]);
    expect(w.update(0.1, ctx({ you: { x: P.nearReach - 1, z: 0 } })).map((e) => e.type)).toEqual(['near']);
    expect(w.update(0.1, ctx({ you: { x: 2, z: 0 } }))).toEqual([]);
  });

  it('is not said again on the way back until the cooldown is up', () => {
    const w = make();
    w.update(0.1, ctx({ you: { x: 3, z: 0 } }));
    w.update(0.1, ctx());
    expect(w.update(0.1, ctx({ you: { x: 3, z: 0 } }))).toEqual([]);
    w.update(P.nearCooldown, ctx());
    expect(w.update(0.1, ctx({ you: { x: 3, z: 0 } })).map((e) => e.type)).toEqual(['near']);
  });

  it('is said by the girl the Jess chance picks, or by whoever is near and free if only one is', () => {
    const near = { you: { x: 3, z: 0 } };
    expect(make(() => 0.1).update(0.1, ctx(near))[0].girl).toBe('jess');
    expect(make(() => 0.9).update(0.1, ctx(near))[0].girl).toBe('amy');
    expect(make(() => 0.9).update(0.1, ctx({ ...near, girls: girls({ amy: { free: false } }) }))[0].girl).toBe('jess');
    expect(make().update(0.1, ctx({ ...near, girls: girls({ amy: { x: 300 }, jess: { free: false } }) }))).toEqual([]);
  });
});

describe('drowning it in the deep water', () => {
  it('is said once when it drowns, and again only after the cooldown', () => {
    const w = make();
    expect(w.update(0.1, ctx(deep)).map((e) => e.type)).toEqual(['stall']);
    expect(w.update(0.1, ctx(deep))).toEqual([]);
    w.update(0.1, ctx(out));
    expect(w.update(0.1, ctx(deep))).toEqual([]); // inside the cooldown
    w.update(P.stallCooldown, ctx(out));
    expect(w.update(0.1, ctx(deep)).map((e) => e.type)).toEqual(['stall']);
  });

  it('is said by nobody if nobody is near enough to hear', () => {
    const w = make();
    expect(w.update(0.1, ctx({ ...deep, girls: girls({ amy: { x: 200 }, jess: { x: 200 } }) }))).toEqual([]);
  });
});

describe('what they say', () => {
  it('has lines for both events for both girls, and never calls you he, she or they', () => {
    for (const key of ['riverNear', 'riverStall']) {
      expect(AMY_RIVER_LINES[key].lines.length).toBeGreaterThan(1);
      expect(JESS_RIVER_LINES[key].length).toBeGreaterThan(1);
      for (const l of [...AMY_RIVER_LINES[key].lines, ...JESS_RIVER_LINES[key]]) {
        expect(l).not.toMatch(/\b(he|she|they)\b/i);
        expect(l).not.toContain('—');
      }
    }
  });
});
