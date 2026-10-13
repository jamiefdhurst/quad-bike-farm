import { describe, it, expect } from 'vitest';
import { BaleYard, SpikeLift, DEFAULT_SPIKE_PARAMS as P, SPIKE_PARAM_RANGES, BALE_SHAPE as S, silageDone } from '../src/items/baleSpike.js';

const flat = () => 0;
const mid = S.height / 2 - S.sink;
const back = { x: 0, z: -1 }; // the tractor faces +z, so out of its back is -z
const yard = (rows) => {
  const y = new BaleYard(rows.map(([id, x, z, yaw = 0]) => ({ id, x, y: 0, z, yaw })));
  y.settle(flat);
  return y;
};
const plateAt = (z, y = P.lowY) => ({ x: 0, y, z });

describe('the spike arms', () => {
  it('start at their starting height and stay in their travel', () => {
    const l = new SpikeLift({ ...P });
    expect(l.lift).toBe(P.startLift);
    for (let i = 0; i < 400; i++) l.update(0.1, { raise: true });
    expect(l.lift).toBe(1);
    expect(l.plateY).toBeCloseTo(P.highY, 5);
    for (let i = 0; i < 400; i++) l.update(0.1, { lower: true });
    expect(l.lift).toBe(0);
    expect(l.plateY).toBeCloseTo(P.lowY, 5);
  });

  it('need the engine running, and do nothing with both keys down', () => {
    const l = new SpikeLift({ ...P });
    expect(l.update(1, { raise: true, powered: false })).toBe(false);
    expect(l.update(1, { raise: true, lower: true })).toBe(false);
    expect(l.lift).toBe(P.startLift);
    expect(l.update(1, { raise: true })).toBe(true);
    expect(l.lift).toBeCloseTo(P.startLift + 1 / P.liftSeconds, 5);
  });

  it('has a range for every tunable', () => {
    for (const k of Object.keys(P)) expect(SPIKE_PARAM_RANGES[k], k).toBeTruthy();
  });
});

describe('the yard', () => {
  it('settles bales onto the ground and stacks one on another', () => {
    const y = yard([['a', 0, 0], ['b', 0.8, 0], ['c', 0.4, 0.3]]);
    y.get('c').y = 5; // dropped from above
    y.settle(flat);
    expect(y.get('a').y).toBeCloseTo(mid, 5);
    expect(y.get('c').y).toBeGreaterThan(y.get('a').y + 1);
  });

  it('only spears a bale the point is in, at about its height, with nothing on top', () => {
    const y = yard([['a', 0, -3], ['b', 5, 5]]);
    expect(y.spearable({ x: 0, y: P.lowY, z: -3 + 0.3 })?.id).toBe('a');
    expect(y.spearable({ x: 0, y: P.lowY, z: -2 })).toBeNull(); // short of it
    expect(y.spearable({ x: 0, y: 1.9, z: -3 })).toBeNull(); // over the top
    y.get('b').held = true;
    expect(y.spearable({ x: 5, y: P.lowY, z: 5 })).toBeNull();
    const stacked = yard([['a', 0, 0], ['b', 0.05, 0]]);
    stacked.get('b').y = 3;
    stacked.settle(flat);
    expect(stacked.spearable({ x: 0, y: P.lowY, z: 0 })).toBeNull(); // the top one has to come off first
    expect(stacked.spearable({ x: 0, y: stacked.get('b').y, z: 0 })?.id).toBe('b');
  });

  it('carries one bale at a time, hanging behind the plate', () => {
    const y = yard([['a', 0, -3], ['b', 0, -6]]);
    expect(y.spear(y.get('a'))).toBe(true);
    expect(y.spear(y.get('b'))).toBe(false);
    const plate = plateAt(-1.85, 1.2);
    for (let i = 0; i < 20; i++) y.carry(y.get('a'), 0.1, plate, back, 0.5, flat);
    const a = y.get('a');
    expect(a.z).toBeCloseTo(-1.85 - P.holdBehind, 3);
    expect(a.y).toBeCloseTo(1.2, 3);
    expect(a.yaw).toBe(0.5);
    expect(a.grounded).toBe(false);
  });

  it('rests on the ground when the arms are lowered, and is left once the tractor drives away', () => {
    const y = yard([['a', 0, -3]]);
    const a = y.get('a');
    y.spear(a);
    let z = -1.85;
    for (let i = 0; i < 20; i++) y.carry(a, 0.1, plateAt(z), back, 0, flat);
    expect(a.grounded).toBe(true);
    expect(a.y).toBeCloseTo(mid, 3);
    const landed = a.z;
    let event = null;
    for (let i = 0; i < 20 && !event; i++) {
      z += 0.1; // forward is +z
      event = y.carry(a, 0.1, plateAt(z), back, 0, flat);
      if (!event) expect(a.z).toBe(landed);
    }
    expect(event).toBe('left');
    expect(a.held).toBe(false);
    expect(y.held).toBeNull();
  });

  it('is lifted again if the arms rise while it is on the ground', () => {
    const y = yard([['a', 0, -3]]);
    const a = y.get('a');
    y.spear(a);
    for (let i = 0; i < 20; i++) y.carry(a, 0.1, plateAt(-1.85), back, 0, flat);
    expect(a.grounded).toBe(true);
    for (let i = 0; i < 20; i++) y.carry(a, 0.1, plateAt(-1.85, 1.4), back, 0, flat);
    expect(a.grounded).toBe(false);
    expect(a.y).toBeCloseTo(1.4, 3);
  });

  it('sets a bale down on top of another one', () => {
    const y = yard([['a', 0, -3], ['b', 0, -8]]);
    const b = y.get('b');
    y.spear(b);
    // Drive the spike so b hangs over a, then lower it.
    for (let i = 0; i < 30; i++) y.carry(b, 0.1, { x: 0, y: 2, z: -3 + P.holdBehind }, back, 0, flat);
    expect(b.z).toBeCloseTo(-3, 3);
    for (let i = 0; i < 30; i++) y.carry(b, 0.1, { x: 0, y: P.lowY, z: -3 + P.holdBehind }, back, 0, flat);
    expect(b.grounded).toBe(true);
    expect(b.y).toBeCloseTo(y.get('a').y + S.height, 3);
  });

  it('drops a bale that had one taken from under it', () => {
    const y = yard([['a', 0, 0], ['b', 0, 0.1]]);
    y.get('b').y = 3;
    y.settle(flat);
    const top = y.get('b').y;
    y.get('a').x = 20;
    y.settle(flat);
    expect(y.get('b').y).toBeLessThan(top);
    expect(y.get('b').y).toBeCloseTo(mid, 5);
  });

  it('follows hills', () => {
    const y = yard([['a', 0, 0]]);
    y.settle(() => 2);
    expect(y.get('a').y).toBeCloseTo(2 + mid, 5);
  });

  it('counts the bales standing in an area, not the one on the spike', () => {
    const rect = { minX: 0, maxX: 5, minZ: 0, maxZ: 5 };
    const y = yard([['a', 1, 1], ['b', 2, 2], ['c', 9, 9]]);
    expect(y.countIn(rect)).toBe(2);
    expect(silageDone(y, rect, 3)).toBe(false);
    y.get('a').held = true;
    expect(y.countIn(rect)).toBe(1);
    y.get('c').x = 3;
    y.get('c').z = 3;
    y.get('a').held = false;
    expect(silageDone(y, rect, 3)).toBe(true);
  });
});

describe('what the farm keeps of the bales', () => {
  it('puts moved bales back where they were left, stacked ones too', () => {
    const y = yard([['a', 0, 0], ['b', 10, 10], ['c', 20, 20]]);
    y.get('a').x = 7;
    y.get('a').z = -4;
    y.get('c').x = 7;
    y.get('c').z = -4.1;
    y.settle(flat);
    const saved = JSON.parse(JSON.stringify(y.toJSON()));
    const fresh = yard([['a', 0, 0], ['b', 10, 10], ['c', 20, 20]]);
    fresh.restore(saved, flat);
    for (const id of ['a', 'b', 'c']) {
      expect(fresh.get(id).x).toBeCloseTo(y.get(id).x, 1);
      expect(fresh.get(id).z).toBeCloseTo(y.get(id).z, 1);
      expect(fresh.get(id).y).toBeCloseTo(y.get(id).y, 1);
    }
  });

  it('ignores bales it no longer has and rubbish', () => {
    const y = yard([['a', 1, 2]]);
    y.restore([['gone', 5, 5, 0, 0], 'junk', ['a', 'x', 3]], flat);
    y.restore(null, flat);
    expect([y.get('a').x, y.get('a').z]).toEqual([1, 2]);
  });

  it('puts a bale that was on the spike down where it was', () => {
    const y = yard([['a', 3, 3]]);
    y.get('a').held = true;
    const saved = y.toJSON();
    y.restore(saved, flat);
    expect(y.get('a').held).toBe(false);
  });
});
