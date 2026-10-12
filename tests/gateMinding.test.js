import { describe, it, expect } from 'vitest';
import { GateMinder, DEFAULT_GATE_MIND_PARAMS as P } from '../src/world/gateMinding.js';

const gate = (open) => ({ x: 80, z: 2, open });
const girl = (x, extra = {}) => ({ x, z: 2, speed: 3, going: true, ...extra });

describe('GateMinder', () => {
  it('opens a shut gate for a girl on the move who reaches it', () => {
    const m = new GateMinder(P);
    expect(m.update(0.1, gate(false), [girl(75)], [])).toBe('open');
  });

  it('leaves it shut for one stood about, one far off, or one riding on someone', () => {
    const m = new GateMinder(P);
    expect(m.update(0.1, gate(false), [girl(75, { speed: 0.1 })], [])).toBe(null);
    expect(m.update(0.1, gate(false), [girl(40)], [])).toBe(null);
    expect(m.update(0.1, gate(false), [girl(75, { going: false })], [])).toBe(null);
  });

  it('shuts a gate she opened once nobody has been near it for a while', () => {
    const m = new GateMinder(P);
    m.update(0.1, gate(false), [girl(75)], []);
    expect(m.update(1, gate(true), [girl(120)], [])).toBe(null);
    expect(m.update(P.shutAfter, gate(true), [girl(120)], [])).toBe('shut');
  });

  it('keeps it open while you or a girl are near, and starts the wait again', () => {
    const m = new GateMinder(P);
    m.update(0.1, gate(false), [girl(75)], []);
    m.update(P.shutAfter - 1, gate(true), [girl(120)], []);
    expect(m.update(1, gate(true), [girl(120)], [{ x: 85, z: 2 }])).toBe(null);
    expect(m.update(2, gate(true), [girl(120)], [])).toBe(null);
  });

  it('does not shut a gate you opened', () => {
    const m = new GateMinder(P);
    m.update(0.1, gate(false), [girl(75)], []);
    m.taken();
    expect(m.update(100, gate(true), [], [])).toBe(null);
  });
});
