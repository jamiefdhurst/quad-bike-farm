import { describe, it, expect } from 'vitest';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { pickHistory, pickFaultChance, girlKnows, historyTopics, stillTinkered, DEFAULT_HISTORY_PARAMS as P } from '../src/vehicle/history.js';
import { FAULT_KINDS } from '../src/vehicle/faults.js';
import { createRandom } from '../src/core/random.js';
import { AMY_HISTORY_LINES as AMY_EARLY_HISTORY, JESS_HISTORY_LINES as JESS_EARLY_HISTORY, AMY_LATE_HISTORY_LINES, JESS_LATE_HISTORY_LINES, HISTORY_KINDS } from '../src/npc/historyLines.js';

const AMY_HISTORY_LINES = { ...AMY_EARLY_HISTORY, ...AMY_LATE_HISTORY_LINES }; // the quads recorded first and those added since, as the game merges them
const JESS_HISTORY_LINES = { ...JESS_EARLY_HISTORY, ...JESS_LATE_HISTORY_LINES };
import { quadKey, QUAD_PHRASES } from '../src/npc/quadNames.js';

const spec = { wearRange: [0.1, 0.5] };
const many = (n, f) => Array.from({ length: n }, (_, i) => f(createRandom(i + 1)));

describe('pickHistory', () => {
  it('keeps wear in the spec range, higher for a quad with more hours', () => {
    const lo = many(200, (r) => pickHistory(spec, r, { faultChance: 0, hoursT: 0 }).wear);
    const hi = many(200, (r) => pickHistory(spec, r, { faultChance: 0, hoursT: 1 }).wear);
    for (const w of [...lo, ...hi]) expect(w).toBeGreaterThanOrEqual(0.1);
    for (const w of [...lo, ...hi]) expect(w).toBeLessThanOrEqual(0.5);
    const mean = (a) => a.reduce((x, y) => x + y) / a.length;
    expect(mean(hi)).toBeGreaterThan(mean(lo) + 0.1);
  });

  it('gives one or two distinct faults at the fleet chance, none when it is zero', () => {
    expect(many(100, (r) => pickHistory(spec, r, { faultChance: 0 }).faults.length).every((n) => n === 0)).toBe(true);
    const all = many(300, (r) => pickHistory(spec, r, { faultChance: 1 }).faults);
    expect(all.every((f) => f.length >= 1 && f.length <= 2)).toBe(true);
    expect(all.some((f) => f.length === 2)).toBe(true);
    for (const faults of all) {
      expect(new Set(faults.map((f) => f.kind)).size).toBe(faults.length);
      for (const f of faults) {
        expect(FAULT_KINDS).toContain(f.kind);
        expect(f.level).toBeGreaterThanOrEqual(P.faultLevelLow);
        expect(f.level).toBeLessThanOrEqual(P.faultLevelHigh);
      }
    }
  });

  it('rolls the fleet chance within its range, and a seed repeats a quad', () => {
    for (const v of many(50, (r) => pickFaultChance(r))) {
      expect(v).toBeGreaterThanOrEqual(P.faultChanceLow);
      expect(v).toBeLessThanOrEqual(P.faultChanceHigh);
    }
    expect(pickHistory(spec, createRandom(9), { faultChance: 0.5 })).toEqual(pickHistory(spec, createRandom(9), { faultChance: 0.5 }));
  });

  it('tinkers about a quarter of quads, within the toolbox limits, and never one that opts out', () => {
    const t = many(1000, (r) => pickHistory(spec, r, { faultChance: 0 }).tinker);
    const n = t.filter(Boolean).length;
    expect(n).toBeGreaterThan(180);
    expect(n).toBeLessThan(320);
    for (const x of t.filter(Boolean)) {
      expect(x.limiter + x.mixture).toBeGreaterThan(0);
      expect(x.limiter).toBeLessThanOrEqual(P.stopTurnsMax);
      expect(x.mixture).toBeLessThanOrEqual(P.richClicksMax);
    }
    expect(many(300, (r) => pickHistory({ ...spec, tinkers: false }, r, { faultChance: 0 }).tinker).every((x) => x === null)).toBe(true);
  });

  it('says who had it out, mostly one of the girls', () => {
    const riders = many(1000, (r) => pickHistory(spec, r, { faultChance: 0 }).lastRider);
    expect(riders.filter((x) => x === null).length).toBeLessThan(180);
    expect(riders).toContain('amy');
    expect(riders).toContain('jess');
  });

  it('works for every real quad spec that has a wear range', () => {
    for (const s of QUAD_SPECS) {
      expect(s.wearRange, s.id).toBeTruthy();
      expect(s.wearRange[1], s.id).toBeLessThan(0.8); // below where an engine turns erratic
    }
  });
});

describe('girlKnows', () => {
  const history = { lastRider: 'jess', faults: [{ kind: 'belt', level: 0.3 }], tinker: { limiter: 2, mixture: 0 } };

  it('knows it all at accuracy 1 and nothing of the fault or tinkering at 0, naming the wrong rider', () => {
    expect(girlKnows(history, 1, () => 0.5)).toEqual({ rider: 'jess', faults: ['belt'], tinker: true });
    expect(girlKnows(history, 0, () => 0.5)).toEqual({ rider: 'amy', faults: [], tinker: false });
  });

  it('is right more often as Amy than as Jess', () => {
    const right = (acc) => many(1000, (r) => girlKnows(history, acc, r).rider === 'jess').filter(Boolean).length;
    expect(right(0.9)).toBeGreaterThan(right(0.5) + 250);
  });
});

describe('historyTopics', () => {
  const history = { lastRider: 'amy', faults: [{ kind: 'belt', level: 0.3 }], tinker: { limiter: 2, mixture: 1 } };
  const knows = { rider: 'amy', faults: ['belt'], tinker: true };
  const now = { faultsNow: () => true, settingsNow: { limiter: 2, mixture: 1 } };

  it('lists what she knows that is still true, minus what she has said', () => {
    expect(historyTopics(knows, history, now, new Set())).toEqual(['histRiderAmy', 'histBelt', 'histLimiter', 'histMixture']);
    expect(historyTopics(knows, history, now, new Set(['histRiderAmy', 'histBelt']))).toEqual(['histLimiter', 'histMixture']);
  });

  it('drops a fault that has been fixed and tinkering that has been put back', () => {
    const fixed = { faultsNow: () => false, settingsNow: { limiter: 0, mixture: 1 } };
    expect(historyTopics(knows, history, fixed, new Set())).toEqual(['histRiderAmy', 'histMixture']);
    expect(stillTinkered(history, null)).toEqual({ limiter: false, mixture: false });
  });
});

describe('history lines', () => {
  it('has every kind for both girls, for every quad, colour and nickname', () => {
    for (const kind of HISTORY_KINDS) {
      for (const id of Object.keys(QUAD_PHRASES)) {
        expect(AMY_HISTORY_LINES[quadKey(kind, id)].lines.length).toBeGreaterThan(0);
        expect(JESS_HISTORY_LINES[quadKey(kind, id)].lines.length).toBeGreaterThan(0);
      }
    }
  });

  it('never has the girls say "he", "she" or "they" about you, or use an em dash', () => {
    for (const bank of [AMY_HISTORY_LINES, JESS_HISTORY_LINES]) {
      for (const e of Object.values(bank)) for (const l of e.lines) expect(l).not.toMatch(/—|\b(he|she|they)\b/i);
    }
  });
});
