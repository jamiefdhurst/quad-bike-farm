import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { coolingEffect, leakRate, stepPuddle, steamLevel, boilsOver, levelText, pickLeak } from '../src/engine/coolant.js';
import { gaugeReading } from '../src/engine/thermal.js';
import { tempGaugeFraction } from '../src/vehicle/tempGauge.js';
import { stepThermal } from '../src/engine/thermal.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { createRandom } from '../src/core/random.js';
import { AMY_COOLANT_LINES, JESS_COOLANT_LINES } from '../src/npc/coolantLines.js';

const P = { ...DEFAULT_ENGINE_PARAMS, waterCooled: true };
const seeded = (seed) => () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
const make = (coolant, leak = 1) => {
  const e = new EngineModel({ strokes: 2, waterCooled: true }, { random: seeded(11) });
  e.coolant = coolant;
  e.coolantLeak = leak;
  return e;
};

/** Runs a warm engine in full sun for `seconds`, idling, calling `each` after every step; returns the events counted by type. */
function idle(e, seconds, each = () => {}) {
  e.setTemperature(1);
  e.setIgnition(true);
  for (let t = 0; t < 10 && !e.isRunning; t += 0.05) e.update(0.05, { starter: true, choke: 0.3 });
  const counts = {};
  for (let t = 0; t < seconds; t += 0.1) {
    e.update(0.1, { ambient: 1 });
    for (const ev of e.events) counts[ev.type] = (counts[ev.type] ?? 0) + 1;
    each();
  }
  return counts;
}

describe('the coolant level', () => {
  it('cools fully above the ok level and not at all when dry', () => {
    expect(coolingEffect(1, P)).toBe(1);
    expect(coolingEffect(P.coolantOkAt, P)).toBe(1);
    expect(coolingEffect(P.coolantEmptyAt, P)).toBe(0);
    expect(coolingEffect(0.3, P)).toBeGreaterThan(0);
    expect(coolingEffect(0.3, P)).toBeLessThan(1);
  });

  it('leaks running, weeps only while the metal is hot when parked, and not at all without a leak', () => {
    expect(leakRate({ running: true, soak: 0, leak: 1 }, P)).toBe(P.coolantLeakRun);
    expect(leakRate({ running: false, soak: 0.1, leak: 1 }, P)).toBe(0);
    expect(leakRate({ running: false, soak: 0.8, leak: 1 }, P)).toBeCloseTo(P.coolantLeakRun * P.coolantParkedLeak);
    expect(leakRate({ running: true, soak: 1, leak: 0 }, P)).toBe(0);
  });

  it('grows a damp patch once it is down a little, and dries when it stops', () => {
    expect(stepPuddle(0, 10, { leaking: true, level: 1 }, P)).toBe(0);
    expect(stepPuddle(0, 10, { leaking: true, level: 0.8 }, P)).toBeGreaterThan(0);
    expect(stepPuddle(0.5, 10, { leaking: false, level: 0.8 }, P)).toBeLessThan(0.5);
  });

  it('steams only when low and hot, and for a while after a boil-over', () => {
    expect(steamLevel(0.9, 124, 0, P)).toBe(0);
    expect(steamLevel(0.1, 92, 0, P)).toBe(0);
    expect(steamLevel(0.1, P.coolantSteamC, 0, P)).toBe(0);
    expect(steamLevel(0.1, 124, 0, P)).toBeGreaterThan(0.5);
    expect(steamLevel(0.9, 92, 1, P)).toBe(1);
  });

  it('boils over only when hot with the radiator failing, and not again once it has', () => {
    expect(boilsOver(0.9, 124, false, P)).toBe(false);
    expect(boilsOver(0.2, 95, false, P)).toBe(false);
    expect(boilsOver(0.2, 124, false, P)).toBe(true);
    expect(boilsOver(0, 102, false, P)).toBe(true); // run dry, it boils barely over 100 °C
    expect(boilsOver(0.2, 124, true, P)).toBe(false);
  });

  it('says how full it is, and a seed picks a leak within the limits', () => {
    expect(levelText(1)).toBe('full');
    expect(levelText(0.05)).toBe('nearly dry');
    let leaking = 0;
    for (let i = 1; i < 60; i++) {
      const { leak, level } = pickLeak(createRandom(i), P);
      if (leak === 0) {
        expect(level).toBe(1);
        continue;
      }
      leaking++;
      expect(leak).toBeGreaterThanOrEqual(P.coolantLeakMin);
      expect(leak).toBeLessThanOrEqual(P.coolantLeakMax);
      expect(level).toBeGreaterThanOrEqual(P.coolantStartMin);
      expect(level).toBeLessThanOrEqual(P.coolantStartMax);
    }
    expect(leaking).toBeGreaterThan(10); // some games have one, some don't
    expect(leaking).toBeLessThan(50);
  });
});

describe('what a low radiator does to the heat', () => {
  it('lets an engine heat like an air-cooled one, and shows it on the gauge', () => {
    const idle = (radiator, fan) => {
      const s = { metalC: 88, coolantC: 88, fan };
      for (let t = 0; t < 600; t++) stepThermal(s, 1, { running: true, air: 12, ambient: 1, radiator }, { ...P, fanOnC: fan ? 0 : P.fanOnC, fanOffC: fan ? -1 : P.fanOffC });
      return s.coolantC;
    };
    expect(idle(0, false)).toBeGreaterThan(idle(1, false) + 10);
    expect(idle(0, true)).toBeCloseTo(idle(0, false), 5); // no fan help with no radiator
    const needle = (radiator) => tempGaugeFraction(gaugeReading(0, idle(radiator, false), 12, P));
    expect(needle(0)).toBeGreaterThan(needle(1) + 0.1);
  });
});

describe('the leaking orange', () => {
  it('only the orange is water-cooled', () => {
    expect(QUAD_SPECS.filter((s) => s.engine?.waterCooled).map((s) => s.id)).toEqual(['adder']);
  });

  it('with no leak, nothing is lost and it never boils', () => {
    const e = make(0.3, 0);
    const counts = idle(e, 600);
    expect(e.coolant).toBe(0.3);
    expect(counts.boilOver).toBeUndefined();
  });

  it('loses coolant while running, then steams and boils over once, leaving little behind', () => {
    const e = make(0.45, 3);
    // It boils only once the level is so low that the coolant's boiling point has come down to it (coolant.js `boilingC`), then runs
    // on near dry until it stalls hot, by when the damp patch may have dried: so the patch is read as it boils.
    let puddle = 0;
    const counts = idle(e, 3000, () => e.events.some((ev) => ev.type === 'boilOver') && (puddle = e.coolantPuddle));
    expect(counts.boilOver).toBe(1);
    expect(e.coolant).toBeLessThan(0.1);
    expect(puddle).toBeGreaterThan(0);
  });

  it('a full one stays cool and fine on the same day', () => {
    const e = make(1, 0);
    const counts = idle(e, 900);
    expect(counts.boilOver).toBeUndefined();
    expect(e.steam).toBe(0);
  });
});

describe('what the girls say', () => {
  it('has lines for each situation for both girls', () => {
    for (const k of ['coolantDamp', 'coolantSteam', 'coolantBoil']) {
      expect(AMY_COOLANT_LINES[k].lines.length).toBeGreaterThan(2);
      expect(JESS_COOLANT_LINES[k].length).toBeGreaterThan(2);
    }
  });
});
