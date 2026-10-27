import { describe, it, expect } from 'vitest';
import { QuarryWatch, DEFAULT_QUARRY_WATCH_PARAMS as P, QUARRY_WATCH_PARAM_RANGES } from '../src/npc/quarryWatch.js';
import { AMY_QUARRY_LINES, JESS_QUARRY_LINES } from '../src/npc/quarryLines.js';
import { surfaceFeel, DEFAULT_SURFACE_PARAMS as S } from '../src/world/surfaces.js';
import { placesAt } from '../src/achievements/snapshot.js';
import { PLACES, ACHIEVEMENTS } from '../src/achievements/achievements.js';
import { LAYOUT } from '../src/world/layout.js';

const girls = [{ id: 'amy', free: true, x: 0, z: 0 }, { id: 'jess', free: true, x: 5, z: 0 }];
const step = (w, over = {}) => w.update(1, { you: { x: 0, z: 0 }, fromLip: 100, inPit: false, running: true, girls, ...over });

describe('what the girls say at the gravel pit', () => {
  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) {
      const [lo, hi] = QUARRY_WATCH_PARAM_RANGES[k];
      expect(P[k]).toBeGreaterThanOrEqual(lo);
      expect(P[k]).toBeLessThanOrEqual(hi);
    }
  });

  it('remarks once when you come to the lip, and not again for a good while', () => {
    const w = new QuarryWatch({ ...P }, () => 0.9);
    expect(step(w)).toEqual([]);
    const first = step(w, { fromLip: 5 });
    expect(first).toHaveLength(1);
    expect(first[0].type).toBe('near');
    expect(step(w, { fromLip: 4 })).toEqual([]);
    step(w, { fromLip: 100 });
    expect(step(w, { fromLip: 5 })).toEqual([]);
    for (let t = 0; t < P.nearCooldown; t++) step(w, { fromLip: 100 });
    expect(step(w, { fromLip: 5 }).map((e) => e.type)).toEqual(['near']);
  });

  it('remarks when your engine stops down in the pit, not elsewhere', () => {
    const w = new QuarryWatch({ ...P }, () => 0.9);
    step(w, { inPit: true, fromLip: -8 });
    expect(step(w, { inPit: true, fromLip: -8, running: false }).map((e) => e.type)).toEqual(['stall']);
    const other = new QuarryWatch({ ...P }, () => 0.9);
    step(other, { inPit: false });
    expect(step(other, { inPit: false, running: false })).toEqual([]);
    const walking = new QuarryWatch({ ...P }, () => 0.9);
    expect(step(walking, { inPit: true, fromLip: -8, running: false }).map((e) => e.type)).not.toContain('stall'); // you were never running, so nothing stalled
  });

  it('is said by whoever is near and free, Jess by the chance, and by nobody out of earshot or busy', () => {
    expect(step(new QuarryWatch({ ...P, jessChance: 1 }), { fromLip: 5 })[0].girl).toBe('jess');
    expect(step(new QuarryWatch({ ...P, jessChance: 0 }), { fromLip: 5 })[0].girl).toBe('amy');
    expect(step(new QuarryWatch({ ...P }), { fromLip: 5, girls: [{ id: 'amy', free: false, x: 0, z: 0 }, { id: 'jess', free: true, x: 500, z: 0 }] })).toEqual([]);
    expect(step(new QuarryWatch({ ...P, jessChance: 1 }), { fromLip: 5, girls: [{ id: 'amy', free: true, x: 0, z: 0 }, { id: 'jess', free: false, x: 1, z: 0 }] })[0].girl).toBe('amy');
  });

  it('gives both girls lines for each thing, in plain British English with no em dashes and none calling you he, she or they', () => {
    const amy = Object.keys(AMY_QUARRY_LINES);
    expect(amy).toEqual(['pitNear', 'pitStall', 'pitYou', 'pitRecord']);
    expect(Object.keys(JESS_QUARRY_LINES)).toEqual(amy);
    const all = [...Object.values(AMY_QUARRY_LINES).flatMap((l) => l.lines), ...Object.values(JESS_QUARRY_LINES).flat()];
    for (const text of all) {
      expect(text).not.toMatch(/—|–/);
      expect(text).not.toMatch(/\b(he|she|they)\b/i);
    }
    for (const k of amy) expect(JESS_QUARRY_LINES[k].length).toBeGreaterThanOrEqual(2);
  });
});

describe('the gravel pit underfoot and in the bucket list', () => {
  it('slips and drags on loose gravel, more the looser, wet or dry', () => {
    const bare = surfaceFeel(S, 0, 0, 0);
    const half = surfaceFeel(S, 0, 0, 0, 0, 0, 0.5);
    const full = surfaceFeel(S, 0, 0, 0, 0, 0, 1);
    expect(bare).toEqual({ grip: 1, roll: 1 });
    expect(full.grip).toBeCloseTo(S.gravelGrip);
    expect(full.roll).toBeCloseTo(S.gravelRoll);
    expect(half.grip).toBeLessThan(1);
    expect(half.grip).toBeGreaterThan(full.grip);
    expect(surfaceFeel(S, 0, 0, 1, 0, 0, 1).grip).toBeCloseTo(full.grip);
  });

  it('has a place and two achievements for it', () => {
    expect(PLACES).toContain('gravelPit');
    expect(ACHIEVEMENTS.map((a) => a.id)).toEqual(expect.arrayContaining(['gravel-pit', 'pit-climb']));
    expect(placesAt({ x: 140, z: -150 }, LAYOUT)).toContain('gravelPit');
    expect(placesAt({ x: 0, z: 0 }, LAYOUT)).not.toContain('gravelPit');
    expect(placesAt({ x: 150, z: -60 }, LAYOUT)).not.toContain('gravelPit');
  });
});
