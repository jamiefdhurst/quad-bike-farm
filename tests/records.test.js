import { describe, it, expect } from 'vitest';
import { Records, JumpMeasure, formatTime, formatValue, RECORD_KINDS, DEFAULT_RECORD_PARAMS, RECORD_PARAM_RANGES } from '../src/world/records.js';

describe('records', () => {
  it('every tunable has a range', () => {
    expect(Object.keys(RECORD_PARAM_RANGES).sort()).toEqual(Object.keys(DEFAULT_RECORD_PARAMS).sort());
  });

  it('formats times and distances', () => {
    expect(formatTime(48.26)).toBe('48.3 s');
    expect(formatTime(83.4)).toBe('1:23.4');
    expect(formatTime(61)).toBe('1:01.0');
    expect(formatValue('jump', 12.34)).toBe('12.3 m');
  });

  it('keeps the lower time and the higher jump', () => {
    const r = new Records();
    expect(r.submit('climb', 'jess', 50, 'red').record).toBe(true);
    expect(r.submit('climb', 'amy', 55, 'blue').record).toBe(false);
    expect(r.submit('climb', 'you', 45, 'blue').record).toBe(true);
    expect(r.best('climb')).toEqual({ who: 'you', value: 45, quad: 'blue' });
    expect(r.submit('jump', 'you', 8, 'red').record).toBe(true);
    expect(r.submit('jump', 'amy', 6, 'red').record).toBe(false);
    expect(r.submit('jump', 'amy', 9, 'red').record).toBe(true);
  });

  it('a tie is not a record', () => {
    const r = new Records();
    r.submit('lap', 'amy', 70);
    expect(r.submit('lap', 'jess', 70).record).toBe(false);
  });

  it('keeps a best for each quad as well', () => {
    const r = new Records();
    r.submit('climb', 'you', 40, 'red');
    const slow = r.submit('climb', 'you', 70, 'green');
    expect(slow.record).toBe(false);
    expect(slow.quadBest).toBe(true);
    expect(r.bestOn('climb', 'green').value).toBe(70);
    expect(r.submit('climb', 'you', 75, 'green').quadBest).toBe(false);
  });

  it('ignores nonsense', () => {
    const r = new Records();
    expect(r.submit('nope', 'you', 5).record).toBe(false);
    expect(r.submit('lap', 'you', 0).record).toBe(false);
    expect(r.submit('lap', 'you', NaN).record).toBe(false);
  });

  it('has a line for every kind for the board', () => {
    const r = new Records();
    r.submit('drag', 'jess', 12.34);
    const lines = r.lines();
    expect(lines.map((l) => l.kind)).toEqual(Object.keys(RECORD_KINDS));
    expect(lines.find((l) => l.kind === 'drag').text).toBe('12.3 s  Jess');
    expect(lines.find((l) => l.kind === 'jump').text).toBe('not yet');
  });
});

describe('jump measure', () => {
  const fly = (m, steps) => {
    let out = null;
    for (const s of steps) out = m.update(0.1, s) ?? out;
    return out;
  };

  it('measures take-off to landing', () => {
    const m = new JumpMeasure();
    const air = Array.from({ length: 10 }, (_, i) => ({ airborne: true, x: i, z: 0 }));
    const r = fly(m, [{ airborne: false, x: 0, z: 0 }, ...air, { airborne: false, x: 10, z: 0 }]);
    expect(r.distance).toBeCloseTo(10, 5);
    expect(r.air).toBeCloseTo(1, 5);
  });

  it('ignores a hop', () => {
    const m = new JumpMeasure();
    expect(fly(m, [{ airborne: true, x: 0, z: 0 }, { airborne: true, x: 1, z: 0 }, { airborne: false, x: 2, z: 0 }])).toBe(null);
  });

  it('ignores a long drop that is not far', () => {
    const m = new JumpMeasure();
    const air = Array.from({ length: 8 }, () => ({ airborne: true, x: 0, z: 0 }));
    expect(fly(m, [...air, { airborne: false, x: 1, z: 0 }])).toBe(null);
  });
});
