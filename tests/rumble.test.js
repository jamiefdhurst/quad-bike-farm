import { describe, it, expect } from 'vitest';
import { Rumble, DEFAULT_RUMBLE_PARAMS as P, RUMBLE_RANGES, playRumble } from '../src/input/rumble.js';

const vib = (o = {}) => ({ intensity: 0, jolts: [], bars: { x: 0, y: 0 }, ...o });
const run = (r, v, seconds, opts, dt = 1 / 60) => {
  let out = null;
  for (let t = 0; t < seconds; t += dt) out = r.update(dt, typeof v === 'function' ? v(t) : v, opts) ?? out;
  return out;
};

describe('rumble', () => {
  it('has a range for every tunable', () => {
    expect(Object.keys(RUMBLE_RANGES).sort()).toEqual(Object.keys(P).sort());
  });

  it('is still when nothing shakes', () => {
    const out = run(new Rumble({ ...P }), vib(), 1);
    expect(out.low).toBe(0);
    expect(out.high).toBe(0);
  });

  it('puts the engine on the low motor only', () => {
    const out = run(new Rumble({ ...P }), vib({ intensity: 1 }), 1);
    expect(out.low).toBeGreaterThan(0.3);
    expect(out.high).toBe(0);
  });

  it('puts bars that move on the high motor', () => {
    const out = run(new Rumble({ ...P }), (t) => vib({ bars: { x: Math.sin(t * 60) * 0.004, y: 0 } }), 1);
    expect(out.high).toBeGreaterThan(0.1);
  });

  it('kicks the low motor for a jolt, then lets it die away', () => {
    const r = new Rumble({ ...P });
    r.update(1 / 60, vib());
    r.update(1 / 60, vib({ jolts: [1] }));
    expect(r.low).toBeGreaterThan(0.4);
    run(r, vib(), 1);
    expect(r.low).toBeLessThan(0.01);
  });

  it('gives the pillion less of the low motor and none of the bars', () => {
    const v = (t) => vib({ intensity: 1, bars: { x: Math.sin(t * 60) * 0.004, y: 0 } });
    const rider = run(new Rumble({ ...P }), v, 1, { rider: true });
    const back = run(new Rumble({ ...P }), v, 1, { rider: false });
    expect(back.low).toBeLessThan(rider.low);
    expect(back.high).toBe(0);
  });

  it('stays within 0..1 however hard it shakes', () => {
    const out = run(new Rumble({ ...P }), vib({ intensity: 2, jolts: [5, 5], bars: { x: 5, y: -5 } }), 1);
    expect(out.low).toBeLessThanOrEqual(1);
    expect(out.high).toBeLessThanOrEqual(1);
  });

  it('only sends an update every interval', () => {
    const r = new Rumble({ ...P });
    let sent = 0;
    for (let i = 0; i < 60; i++) if (r.update(1 / 60, vib({ intensity: 1 }))) sent++;
    expect(sent).toBeGreaterThanOrEqual(14);
    expect(sent).toBeLessThanOrEqual(16);
  });

  it('stops once, then says nothing, when you get off or switch it off', () => {
    const r = new Rumble({ ...P });
    run(r, vib({ intensity: 1 }), 0.5);
    expect(r.update(1 / 60, null)).toEqual({ low: 0, high: 0, duration: 0 });
    expect(r.update(1 / 60, null)).toBeNull();
    r.params.enabled = 0;
    expect(r.update(1 / 60, vib({ intensity: 1 }))).toBeNull();
  });

  it('plays dual-rumble on the first pad that can, and resets on a stop', () => {
    const calls = [];
    const pad = { connected: true, vibrationActuator: { playEffect: (...a) => calls.push(a), reset: () => calls.push('reset') } };
    expect(playRumble({ low: 0.5, high: 0.2, duration: 90 }, [null, { connected: true }, pad])).toBe(true);
    expect(calls[0][0]).toBe('dual-rumble');
    expect(calls[0][1]).toMatchObject({ strongMagnitude: 0.5, weakMagnitude: 0.2, duration: 90 });
    playRumble({ low: 0, high: 0, duration: 0 }, [pad]);
    expect(calls[1]).toBe('reset');
    expect(playRumble({ low: 1, high: 1, duration: 90 }, [])).toBe(false);
  });
});
