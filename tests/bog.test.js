import { describe, it, expect } from 'vitest';
import { Bog, bogGrip, DEFAULT_BOG_PARAMS } from '../src/vehicle/bog.js';

const DT = 1 / 60;
const run = (bog, seconds, s) => {
  for (let i = 0; i < seconds / DT; i++) bog.update(DT, s);
  return bog;
};

describe('a bog', () => {
  it('takes most of the grip in the middle and none outside', () => {
    expect(bogGrip(0)).toBe(1);
    expect(bogGrip(1)).toBeCloseTo(1 - DEFAULT_BOG_PARAMS.gripLoss, 5);
  });

  it('sinks a quad slowly sitting in it and quickly with its wheels spinning', () => {
    const sitting = run(new Bog(), 10, { bog: 1, spin: 0, speed: 0 });
    const spinning = run(new Bog(), 10, { bog: 1, spin: 4, speed: 0, drive: 2000 });
    expect(sitting.sink).toBeLessThan(0.2);
    expect(spinning.stuck).toBe(true);
  });

  it('holds a stuck quad harder than its tyres can push, and a lightly sunk one much less', () => {
    const stuck = run(new Bog(), 10, { bog: 1, spin: 4, drive: 2000 });
    expect(stuck.holdForce(300)).toBeGreaterThan(2200);
    const light = new Bog();
    light.sink = 0.15;
    expect(light.holdForce(300)).toBeLessThan(400);
  });

  it('works loose a little each time it is rocked, unless it is in too deep', () => {
    const b = new Bog();
    b.sink = 0.6;
    for (let i = 0; i < 6; i++) b.update(DT, { bog: 1, drive: i % 2 ? -1500 : 1500 });
    expect(b.sink).toBeLessThan(0.3);
    const deep = new Bog();
    deep.sink = 0.95;
    for (let i = 0; i < 6; i++) deep.update(DT, { bog: 1, drive: i % 2 ? -1500 : 1500 });
    expect(deep.sink).toBeGreaterThan(0.9);
  });

  it('rides back up moving through it, and is free once out', () => {
    const b = new Bog();
    b.sink = 0.5;
    run(b, 4, { bog: 1, speed: 4 });
    expect(b.sink).toBeLessThan(0.1);
    b.sink = 0.8;
    run(b, 2, { bog: 0, speed: 1 });
    expect(b.sink).toBe(0);
  });
});
