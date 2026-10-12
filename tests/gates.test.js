import { describe, it, expect, vi } from 'vitest';
import { Gate, GateState, inTheWay, DEFAULT_GATE_PARAMS } from '../src/world/gates.js';

const collider = () => ({ on: true, setEnabled(v) { this.on = v; } });

describe('GateState', () => {
  it('swings over swingSeconds and stops at the end', () => {
    const g = new GateState(false);
    g.setOpen(true);
    g.update(DEFAULT_GATE_PARAMS.swingSeconds / 2);
    expect(g.amount).toBeCloseTo(0.5);
    g.update(10);
    expect(g.amount).toBe(1);
    expect(g.moving).toBe(false);
  });

  it('is solid until it is swung part way', () => {
    const g = new GateState(false);
    g.setOpen(true);
    g.update(0.1);
    expect(g.blocking).toBe(true);
    g.update(1);
    expect(g.blocking).toBe(false);
  });

  it('toggles from where it is heading', () => {
    const g = new GateState(true);
    g.toggle();
    expect(g.target).toBe(0);
    g.toggle();
    expect(g.target).toBe(1);
  });
});

describe('Gate', () => {
  it('swaps its colliders and the hedge gap as it opens', () => {
    const solid = collider();
    const swungSolid = collider();
    const gap = { shut: false };
    const pose = vi.fn();
    const g = new Gate({ id: 'a', x: 0, z: 0, open: false, solid, swungSolid, gap, pose });
    expect(solid.on).toBe(true);
    expect(swungSolid.on).toBe(false);
    expect(gap.shut).toBe(true);
    g.set(true);
    g.update(10);
    expect(solid.on).toBe(false);
    expect(swungSolid.on).toBe(true);
    expect(gap.shut).toBe(false);
    expect(pose).toHaveBeenLastCalledWith(1);
  });

  it('will not shut with something in the way, but will open', () => {
    const g = new Gate({ id: 'a', x: 10, z: 0, open: true });
    const r = g.set(false, [{ x: 11, z: 1 }]);
    expect(r.ok).toBe(false);
    expect(g.isOpen).toBe(true);
    expect(g.set(false, [{ x: 30, z: 0 }]).ok).toBe(true);
    expect(g.isOpen).toBe(false);
    expect(g.set(true, [{ x: 10, z: 0 }]).ok).toBe(true);
  });

  it('inTheWay returns the nearest blocker within the radius', () => {
    expect(inTheWay(0, 0, [{ x: 5, z: 0 }], 3)).toBeNull();
    expect(inTheWay(0, 0, [{ x: 2, z: 0 }], 3)).toEqual({ x: 2, z: 0 });
  });
});
