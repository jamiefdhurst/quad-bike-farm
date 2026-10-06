import { describe, it, expect } from 'vitest';
import { TractorWatch, DEFAULT_TRACTOR_WATCH_PARAMS as P } from '../src/npc/tractorWatch.js';
import { AMY_TRACTOR_LINES, JESS_TRACTOR_LINES } from '../src/npc/tractorLines.js';

const girls = (over = {}) => [
  { id: 'amy', free: true, x: 5, z: 0, ...over.amy },
  { id: 'jess', free: true, x: 8, z: 0, ...over.jess },
];
const tractor = (over = {}) => ({ x: 0, z: 0, running: false, keyOn: false, glowWaiting: false, caught: false, ...over });
const make = (random = () => 0) => new TractorWatch({ ...P }, random);

/** Steps for a number of seconds and returns every event. */
function run(w, seconds, ctx) {
  const events = [];
  for (let t = 0; t < seconds; t += 0.1) events.push(...w.update(0.1, ctx));
  return events;
}

describe('the key that does not stop it', () => {
  it('is laughed at once it has run on with the key off for a few seconds', () => {
    const w = make();
    const ctx = { tractor: tractor({ running: true, keyOn: false }), girls: girls() };
    expect(run(w, P.keyDelay - 0.5, ctx)).toEqual([]);
    expect(run(w, 1, ctx).map((e) => e.type)).toEqual(['key']);
  });

  it('is Jess most of the time and Amy otherwise, and whoever is near if only one is', () => {
    const jess = run(make(() => 0.1), 5, { tractor: tractor({ running: true }), girls: girls() });
    expect(jess[0].girl).toBe('jess');
    const amy = run(make(() => 0.9), 5, { tractor: tractor({ running: true }), girls: girls() });
    expect(amy[0].girl).toBe('amy');
    const only = run(make(() => 0.1), 5, { tractor: tractor({ running: true }), girls: girls({ jess: { x: 90 } }) });
    expect(only[0].girl).toBe('amy');
  });

  it('is said once, then not again until the cooldown, and not with the key on or the engine off', () => {
    const w = make();
    const ctx = { tractor: tractor({ running: true }), girls: girls() };
    expect(run(w, P.keyCooldown - 5, ctx)).toHaveLength(1);
    expect(run(w, 10, ctx)).toHaveLength(1);
    expect(run(make(), 20, { tractor: tractor({ running: true, keyOn: true }), girls: girls() })).toEqual([]);
    expect(run(make(), 20, { tractor: tractor({ running: false }), girls: girls() })).toEqual([]);
  });

  it('needs a free girl within earshot', () => {
    expect(run(make(), 10, { tractor: tractor({ running: true }), girls: girls({ amy: { x: 100 }, jess: { x: 100 } }) })).toEqual([]);
    expect(run(make(), 10, { tractor: tractor({ running: true }), girls: girls({ amy: { free: false }, jess: { free: false } }) })).toEqual([]);
  });
});

describe('waiting for the glow plugs', () => {
  it('gets one remark after a pause, from the nearer girl', () => {
    const w = make();
    const ctx = { tractor: tractor({ keyOn: true, glowWaiting: true }), girls: girls() };
    expect(run(w, P.glowDelay - 0.5, ctx)).toEqual([]);
    const said = run(w, 5, ctx);
    expect(said).toEqual([{ type: 'glow', girl: 'amy' }]);
  });

  it('starts over when the wait ends, and respects its cooldown', () => {
    const w = make();
    const waiting = { tractor: tractor({ keyOn: true, glowWaiting: true }), girls: girls() };
    expect(run(w, 5, waiting)).toHaveLength(1);
    run(w, 1, { tractor: tractor({ keyOn: true }), girls: girls() });
    expect(run(w, 5, waiting)).toEqual([]); // within the cooldown
    const later = make();
    run(later, 5, waiting);
    run(later, P.glowCooldown, { tractor: tractor({ keyOn: true }), girls: girls() });
    expect(run(later, 5, waiting)).toHaveLength(1);
  });
});

describe('it catching', () => {
  it('is remarked on, sometimes, with a cooldown', () => {
    const w = make();
    const caught = { tractor: tractor({ caught: true, keyOn: true }), girls: girls() };
    expect(w.update(0.1, caught).map((e) => e.type)).toEqual(['caught']);
    expect(w.update(0.1, caught)).toEqual([]);
    expect(make(() => 0.99).update(0.1, caught)).toEqual([]);
  });
});

describe('what they say', () => {
  it('has lines for every situation, for both of them', () => {
    for (const s of ['tractorKey', 'tractorGlow', 'tractorCaught']) {
      expect(AMY_TRACTOR_LINES[s].lines.length, s).toBeGreaterThan(1);
      expect(JESS_TRACTOR_LINES[s].length, s).toBeGreaterThan(1);
    }
  });

  it('keeps to the rules: no em dashes, and never he, she or they for you', () => {
    const all = [...Object.values(AMY_TRACTOR_LINES).flatMap((l) => l.lines), ...Object.values(JESS_TRACTOR_LINES).flat()];
    for (const l of all) {
      expect(l).not.toMatch(/—/);
      expect(l).not.toMatch(/\b(he|she|they)\b/i);
    }
  });
});
