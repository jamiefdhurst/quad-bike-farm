import { describe, it, expect } from 'vitest';
import { DoorSwing, DEFAULT_DOOR_PARAMS as P } from '../src/vehicle/doorSwing.js';

const run = (d, seconds, ctx, dt = 0.1) => {
  let out;
  for (let t = 0; t < seconds; t += dt) out = d.update(dt, ctx);
  return out;
};
const none = { speed: 0, aboard: {}, boarding: {} };

describe('the doors', () => {
  it('stay shut with nobody about', () => {
    const d = new DoorSwing();
    expect(run(d, 3, none)).toEqual({ left: 0, right: 0 });
  });

  it('open only at the side somebody gets on, stay out for a few seconds, then shut', () => {
    const d = new DoorSwing();
    run(d, 1, none);
    let o = run(d, 1.5, { ...none, aboard: { right: true } }); // you get in at the driver's side
    expect(o.right).toBeGreaterThan(0.9);
    expect(o.left).toBe(0);
    o = run(d, P.seconds + 1.5, { ...none, aboard: { right: true } });
    expect(o.right).toBeLessThan(0.05); // shut again once you are in
    o = run(d, 1.5, none); // and out
    expect(o.right).toBeGreaterThan(0.9);
    expect(o.left).toBe(0);
  });

  it('open for a girl stepping in at the passenger side while she does, and not for the driver’s', () => {
    const d = new DoorSwing();
    const o = run(d, 2, { ...none, boarding: { left: true } });
    expect(o.left).toBeGreaterThan(0.9);
    expect(o.right).toBe(0);
    expect(run(d, 3, none).left).toBeLessThan(0.05);
  });

  it('never opens, and shuts, while it is moving', () => {
    const d = new DoorSwing();
    run(d, 2, { ...none, aboard: { left: true } });
    const o = run(d, 3, { speed: P.stopSpeed + 1, aboard: { left: true }, boarding: { left: true } });
    expect(o.left).toBeLessThan(0.05);
  });
});
