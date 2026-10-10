import { describe, it, expect } from 'vitest';
import { Numbness, DEFAULT_NUMB_PARAMS as P } from '../src/npc/numbness.js';
import { AMY_NUMB_LINES, JESS_NUMB_LINES } from '../src/npc/numbLines.js';

const sit = (n, seconds, level, dt = 1) => {
  const ev = [];
  for (let t = 0; t < seconds; t += dt) ev.push(...n.update(dt, { sitting: true, level }));
  return ev;
};

describe('numbness', () => {
  it('builds on a seat that shakes enough: tingly first, numb later, and starts again', () => {
    const n = new Numbness({ ...P });
    const ev = sit(n, P.fullAfter + 10, P.shakeFull);
    expect(ev).toEqual(['tingle', 'numb']);
    expect(n.value).toBeLessThan(0.1); // reset once it has happened
  });

  it('the harder the shake, the sooner; below the shake that counts, never', () => {
    const when = (level) => {
      const n = new Numbness({ ...P });
      for (let t = 1; t < 2000; t++) if (n.update(1, { sitting: true, level }).includes('numb')) return t;
      return Infinity;
    };
    expect(when(1.2)).toBeLessThan(when(0.6));
    expect(when(P.shakeFrom - 0.1)).toBe(Infinity);
    expect(when(50)).toBeGreaterThan(P.fullAfter / P.shakeCap - 2); // capped
  });

  it('drains while she is not sitting on it, so a short sit leaves nothing', () => {
    const n = new Numbness({ ...P });
    sit(n, 60, 1);
    expect(n.value).toBeGreaterThan(0.3);
    for (let t = 0; t < 1 / P.drainPerSecond + 5; t++) n.update(1, { sitting: false });
    expect(n.value).toBe(0);
  });

  it('can tingle again on the next build-up, but only once in each', () => {
    const n = new Numbness({ ...P });
    const a = sit(n, P.fullAfter + 10, 1);
    const b = sit(n, P.fullAfter + 10, 1);
    expect(a.filter((e) => e === 'tingle')).toHaveLength(1);
    expect(b.filter((e) => e === 'tingle')).toHaveLength(1);
  });
});

describe('her lines', () => {
  it('both girls have every one, with the ones the item names, and nobody is called he, she or they', () => {
    for (const key of Object.keys(AMY_NUMB_LINES)) {
      expect(JESS_NUMB_LINES[key]?.length).toBeGreaterThan(0);
      expect(AMY_NUMB_LINES[key].lines.length).toBeGreaterThan(0);
    }
    const all = [...Object.values(AMY_NUMB_LINES).flatMap((l) => l.lines), ...Object.values(JESS_NUMB_LINES).flat()].join(' ');
    expect(all).toMatch(/My bum has gone numb/);
    expect(all).toMatch(/My legs have gone all tingly/);
    expect(all).not.toMatch(/\b(he|she|they)\b/i);
    expect(all).not.toMatch(/—/);
  });
});
