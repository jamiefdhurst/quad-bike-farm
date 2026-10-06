import { describe, it, expect } from 'vitest';
import { DashReader, DEFAULT_READING_PARAMS as P } from '../src/npc/dashReading.js';
import { AMY_READING_LINES, JESS_READING_LINES } from '../src/npc/readingLines.js';

const dash = (o = {}) => ({ fuelLamp: false, tempLamp: false, fuelLevel: 0.6, temperature: 0.8, ...o });
const ctx = (o = {}, girls = [{ id: 'amy', onBack: true }]) => ({ riding: true, girls, dash: dash(), speed: 4, throttle: 0.3, ...o });
const run = (r, c, seconds, dt = 0.5) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...r.update(dt, c));
  return events;
};

describe('reading the dash out', () => {
  it('Amy says the fuel is on the red as soon as the light comes on, once', () => {
    const r = new DashReader();
    expect(run(r, ctx(), 5)).toEqual([]);
    const c = ctx({ dash: dash({ fuelLamp: true, fuelLevel: 0.15 }) });
    expect(run(r, c, 1)).toEqual([{ girl: 'amy', what: 'fuel', late: false }]);
    expect(run(r, c, 200)).toEqual([]); // once for the spell
    run(r, ctx(), 1); // filled up: the spell is over
    expect(run(r, c, 1)).toEqual([{ girl: 'amy', what: 'fuel', late: false }]);
  });

  it('Amy says when it is hot, and when it is still cold and you are going hard', () => {
    const r = new DashReader();
    expect(run(r, ctx({ dash: dash({ tempLamp: true }) }), 1)[0]).toMatchObject({ what: 'hot' });
    const cold = new DashReader();
    const c = ctx({ dash: dash({ temperature: 0.2 }), speed: 8 });
    expect(run(cold, c, 1.5)).toEqual([]);
    expect(run(cold, c, 2)[0]).toMatchObject({ girl: 'amy', what: 'cold', late: false });
    expect(run(new DashReader(), ctx({ dash: dash({ temperature: 0.2 }), speed: 1, throttle: 0.1 }), 20)).toEqual([]); // pottering is fine
  });

  it('Jess says the fuel only when the tank is nearly empty, and the heat only after it has been hot a while', () => {
    const jess = [{ id: 'jess', onBack: true }];
    const r = new DashReader();
    expect(run(r, ctx({ dash: dash({ fuelLamp: true, fuelLevel: 0.15 }) }, jess), 30)).toEqual([]);
    expect(run(r, ctx({ dash: dash({ fuelLamp: true, fuelLevel: 0.02 }) }, jess), 1)).toEqual([{ girl: 'jess', what: 'fuel', late: true }]);
    const h = new DashReader();
    expect(run(h, ctx({ dash: dash({ tempLamp: true }) }, jess), 4)).toEqual([]);
    expect(run(h, ctx({ dash: dash({ tempLamp: true }) }, jess), 10)[0]).toMatchObject({ what: 'hot', late: true });
  });

  it('Jess tells you it was cold only once you have thrashed it and it has warmed up', () => {
    const jess = [{ id: 'jess', onBack: true }];
    const r = new DashReader();
    expect(run(r, ctx({ dash: dash({ temperature: 0.2 }), speed: 9 }, jess), 15)).toEqual([]);
    const events = run(r, ctx({ dash: dash({ temperature: 0.8 }), speed: 9 }, jess), 2);
    expect(events).toEqual([{ girl: 'jess', what: 'cold', late: true }]);
  });

  it('not unless she is on the back and you are riding, and not twice in quick succession', () => {
    expect(run(new DashReader(), ctx({ dash: dash({ fuelLamp: true }) }, [{ id: 'amy', onBack: false }]), 5)).toEqual([]);
    expect(run(new DashReader(), ctx({ riding: false, dash: dash({ fuelLamp: true }) }), 5)).toEqual([]);
    const r = new DashReader();
    const both = ctx({ dash: dash({ fuelLamp: true, tempLamp: true }) });
    expect(run(r, both, 5).length).toBe(1); // fuel now, the heat after the gap
    expect(run(r, both, P.gap + 1).length).toBe(1);
  });

  it('has lines for all three, for both', () => {
    for (const k of ['readFuel', 'readCold', 'readHot']) {
      expect(AMY_READING_LINES[k].lines.length).toBeGreaterThan(0);
      expect(JESS_READING_LINES[k].length).toBeGreaterThan(0);
    }
  });
});
