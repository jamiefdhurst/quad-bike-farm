import { describe, it, expect } from 'vitest';
import { Banter, BANTER_TIMING } from '../src/npc/banter.js';
import { BANTER } from '../src/npc/banterLines.js';
import { CHARACTERS } from '../src/npc/characters.js';

function seeded(seed = 7) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

/** Runs the banter for `seconds` with the same triggers each frame; returns who said what. */
function run(banter, seconds, triggers, floorFree = true) {
  const said = [];
  const speak = (who, text) => (said.push([who, text]), 1.5);
  for (let t = 0; t < seconds * 30; t++) banter.update(1 / 30, triggers, speak, floorFree);
  return said;
}

describe('what the girls say to each other', () => {
  const ids = CHARACTERS.map((c) => c.id);

  it('only has the two of them talking, in the moments the game raises', () => {
    for (const e of BANTER) {
      expect(BANTER_TIMING).toHaveProperty(e.when);
      for (const who of Object.values(e.roles ?? {})) expect(ids).toContain(who);
      for (const [who, text] of e.lines) {
        expect(ids).toContain(who);
        expect(text.length).toBeGreaterThan(1);
      }
      expect(e.lines.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('has something for every casting of every moment', () => {
    const casts = {
      talked: [['chosen', 'jealous']],
      riding: [['rider', 'watcher']],
      back: [['rider', 'watcher']],
      watching: [['driver', 'onlooker']],
      stuck: [['stuck', 'mocker']],
      sharing: [['driver', 'passenger']],
    };
    for (const [when, roleSets] of Object.entries(casts)) {
      for (const [r1, r2] of roleSets) {
        for (const [x, y] of [ids, [...ids].reverse()]) {
          const fits = BANTER.filter((e) => e.when === when && e.roles?.[r1] === x && e.roles?.[r2] === y);
          expect(fits.length, `${when} ${r1} ${x} ${r2} ${y}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it('plays a moment straight away, a line at a time, then waits before the next', () => {
    const banter = new Banter(BANTER, { random: seeded(1) });
    const trigger = { when: 'stuck', edge: true, roles: { stuck: 'jess', mocker: 'amy' } };
    const said = run(banter, 10, [trigger]);
    const exchange = BANTER.find((e) => e.lines[0][1] === said[0][1]);
    expect(exchange.roles).toEqual({ stuck: 'jess', mocker: 'amy' });
    expect(said.map(([, t]) => t)).toEqual(exchange.lines.map(([, t]) => t));
    // Same moment again straight after: too soon.
    expect(run(banter, 5, [trigger])).toEqual([]);
  });

  it('starts lasting situations only now and then, and not while someone else is talking', () => {
    const banter = new Banter(BANTER, { random: seeded(2) });
    expect(run(banter, 120, [{ when: 'idle' }], false)).toEqual([]);
    const said = run(banter, 120, [{ when: 'idle' }]);
    expect(said.length).toBeGreaterThan(0);
  });

  it('works through every exchange for a moment before repeating one', () => {
    const banter = new Banter(BANTER, { random: seeded(3) });
    const idle = BANTER.filter((e) => e.when === 'idle');
    const firsts = new Set();
    for (let i = 0; i < idle.length; i++) {
      banter.time += 1000;
      const said = run(banter, 15, [{ when: 'idle', edge: true }]);
      firsts.add(said[0][1]);
    }
    expect(firsts.size).toBe(idle.length);
  });
});
