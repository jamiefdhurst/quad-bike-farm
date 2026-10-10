import { describe, it, expect } from 'vitest';
import { DontFixIt, DEFAULT_DONTFIX_PARAMS as P } from '../src/npc/dontFixIt.js';
import { AMY_DONTFIX_LINES, JESS_DONTFIX_LINES } from '../src/npc/dontFixLines.js';

const girls = (o = {}) => [
  { id: 'amy', favourite: 'red', distance: 5, ...o.amy },
  { id: 'jess', favourite: 'green', distance: 5, ...o.jess },
];
const run = (d, wear, g = girls(), seconds = 1) => {
  const ev = [];
  for (let t = 0; t < seconds; t += 0.5) ev.push(...d.update(0.5, { units: [{ id: 'red', wear }, { id: 'green', wear: 0.1 }], girls: g }));
  return ev;
};

describe("don't fix it", () => {
  it('a service that takes the wear off her favourite makes her mind, once', () => {
    const d = new DontFixIt();
    expect(run(d, 0.6, girls(), 2)).toEqual([]);
    expect(run(d, 0.05)).toEqual([{ type: 'minds', girl: 'amy', unit: 'red' }]);
    expect(run(d, 0.05, girls(), 5)).toEqual([]);
  });

  it('only the girl whose favourite it is, and only if she is near enough to say', () => {
    const d = new DontFixIt();
    run(d, 0.6, girls(), 2);
    expect(run(d, 0.05, girls({ amy: { distance: P.hearRange + 5 } }))).toEqual([]);
    const e = new DontFixIt();
    run(e, 0.6, girls({ amy: { favourite: 'blue' }, jess: { favourite: 'red' } }), 2);
    expect(run(e, 0.05, girls({ amy: { favourite: 'blue' }, jess: { favourite: 'red' } })).map((x) => x.girl)).toEqual(['jess']);
  });

  it('a quad that was not rough, or a wear that creeps down slowly, does not count', () => {
    const smooth = new DontFixIt();
    run(smooth, 0.2, girls(), 2);
    expect(run(smooth, 0.0)).toEqual([]); // under roughFrom
    const slow = new DontFixIt();
    let wear = 0.6;
    const ev = [];
    for (let i = 0; i < 40; i++) {
      wear -= 0.02;
      ev.push(...run(slow, wear));
    }
    expect(ev).toEqual([]);
  });

  it('does not nag: a second fix inside the cooldown is not remarked on', () => {
    const d = new DontFixIt();
    run(d, 0.6, girls(), 2);
    expect(run(d, 0.05)).toHaveLength(1);
    run(d, 0.6, girls(), 2);
    expect(run(d, 0.05)).toEqual([]);
    run(d, 0.6, girls(), P.cooldown);
    expect(run(d, 0.05)).toHaveLength(1);
  });

  it('the debug button makes her mind now', () => {
    expect(new DontFixIt().force('jess', 'green')).toEqual({ type: 'minds', girl: 'jess', unit: 'green' });
  });
});

describe('her lines', () => {
  it('both girls have them, Jess says boring, Amy says she will miss it, and nobody is called he, she or they', () => {
    expect(AMY_DONTFIX_LINES.fixMinds.lines.some((l) => /miss/i.test(l))).toBe(true);
    expect(JESS_DONTFIX_LINES.fixMinds.some((l) => /boring/i.test(l))).toBe(true);
    const all = [...AMY_DONTFIX_LINES.fixMinds.lines, ...JESS_DONTFIX_LINES.fixMinds].join(' ');
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
