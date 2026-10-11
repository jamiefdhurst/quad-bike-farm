import { describe, it, expect } from 'vitest';
import { BrakeState, DEFAULT_BRAKE_PARAMS } from '../src/vehicle/brakeState.js';

const mid = () => 0.5;

describe('brake state', () => {
  it('gets wet driving through deep water, not stood in it or through a shallow film', () => {
    const b = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    b.update(2, { puddle: 1, speed: 0.2 });
    expect(b.wet).toBe(0);
    b.update(2, { puddle: 0.1, speed: 4 });
    expect(b.wet).toBe(0);
    b.update(1, { puddle: 1, speed: 4 });
    expect(b.wet).toBeGreaterThan(0.7);
    expect(b.grip).toBeLessThan(0.5);
  });

  it('dries faster when braked, and not at all stood still', () => {
    const slow = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    const fast = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    slow.wet = fast.wet = 1;
    slow.update(1, { speed: 4 });
    fast.update(1, { speed: 4, pressure: 1 });
    expect(fast.wet).toBeLessThan(slow.wet);
    const still = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    still.wet = 1;
    still.update(10, { speed: 0 });
    expect(still.wet).toBe(1);
  });

  it('a binding brake drags until a few metres free it with a clunk', () => {
    const b = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    b.setBinding(true);
    expect(b.drag).toBe(DEFAULT_BRAKE_PARAMS.bindDrag);
    b.update(0.5, { speed: 0.1 }); // rolling too slowly to count
    expect(b.binding).toBe(true);
    let steps = 0;
    while (b.binding && steps++ < 1000) b.update(0.1, { speed: 3 });
    expect(b.binding).toBe(false);
    expect(b.drag).toBe(0);
    expect(b.takeClunk()).toBe(true);
    expect(b.takeClunk()).toBe(false);
    expect(steps * 0.3).toBeGreaterThan(DEFAULT_BRAKE_PARAMS.bindMetres * 0.5);
  });

  it('fix dries and frees', () => {
    const b = new BrakeState(DEFAULT_BRAKE_PARAMS, mid);
    b.wet = 1;
    b.setBinding(true);
    b.fix();
    expect(b.wet).toBe(0);
    expect(b.binding).toBe(false);
  });
});
