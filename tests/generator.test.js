import { describe, it, expect } from 'vitest';
import { Generator, DEFAULT_GENERATOR_PARAMS, GENERATOR_PARAM_RANGES } from '../src/items/generator.js';

const make = (over = {}, rolls = [0]) => {
  let i = 0;
  return new Generator({ ...DEFAULT_GENERATOR_PARAMS, ...over }, () => rolls[Math.min(i++, rolls.length - 1)]);
};

describe('Generator', () => {
  it('has a range for every tunable', () => {
    expect(Object.keys(GENERATOR_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_GENERATOR_PARAMS).sort());
  });

  it('starts off, with no power', () => {
    const g = make();
    expect(g.running).toBe(false);
    expect(g.powered).toBe(false);
  });

  it('catches on a good pull and powers up', () => {
    const g = make({}, [0.1]);
    expect(g.pull()).toBe('caught');
    expect(g.powered).toBe(true);
  });

  it('coughs on a bad pull, and the next is likelier', () => {
    const g = make({}, [0.9, 0.9]);
    const first = g.chance;
    expect(g.pull()).toBe('coughed');
    expect(g.chance).toBeGreaterThan(first);
    g.update(2);
    expect(g.canPull).toBe(true);
  });

  it('never goes past the maximum chance', () => {
    const g = make({}, [0.99]);
    for (let i = 0; i < 20; i++) {
      g.pull();
      g.update(5);
    }
    expect(g.chance).toBeLessThanOrEqual(g.params.maxChance);
  });

  it('wheezes on an empty tank and does not start', () => {
    const g = make({ startLitres: 0 }, [0]);
    expect(g.pull()).toBe('dry');
    expect(g.running).toBe(false);
  });

  it('cannot be pulled while a pull is in hand or while it runs', () => {
    const g = make({}, [0.9, 0]);
    g.pull();
    expect(g.pull()).toBeNull();
    g.update(5);
    expect(g.pull()).toBe('caught');
    expect(g.pull()).toBeNull();
  });

  it('burns fuel running, more with the charger on, and stalls when dry', () => {
    const idle = make({}, [0]);
    const loaded = make({}, [0]);
    idle.pull();
    loaded.pull();
    idle.update(100, 0);
    loaded.update(100, 1);
    expect(loaded.fuel).toBeLessThan(idle.fuel);
    const g = make({ startLitres: 0.01 }, [0]);
    g.pull();
    expect(g.update(10)).toBe('stalled');
    expect(g.powered).toBe(false);
  });

  it('takes only red diesel, only when off, and only up to the top', () => {
    const g = make({ startLitres: 4 }, [0]);
    expect(g.add(1, 0)).toBe(0); // petrol
    expect(g.add(3, 1)).toBeCloseTo(1);
    expect(g.fuel).toBeCloseTo(5);
    const h = make({ startLitres: 1 }, [0]);
    h.pull();
    expect(h.add(1, 1)).toBe(0); // hot
  });

  it('switches off, and is off again in the morning with its fuel kept', () => {
    const g = make({}, [0]);
    g.pull();
    expect(g.stop()).toBe(true);
    expect(g.stop()).toBe(false);
    g.pull();
    g.update(5);
    g.update(60);
    const saved = JSON.parse(JSON.stringify(g));
    const h = make();
    h.restore(saved);
    expect(h.running).toBe(false);
    expect(h.fuel).toBeCloseTo(saved.fuel);
  });

  it('reports running rough when nearly dry', () => {
    const g = make({ startLitres: 0.1 }, [0]);
    g.pull();
    expect(g.low).toBe(true);
  });
});
