import { describe, it, expect } from 'vitest';
import { ElectricFence, createElectricFence, DEFAULT_FENCE_PARAMS as P, FENCE_PARAM_RANGES } from '../src/world/electricFence.js';
import { LAYOUT } from '../src/world/layout.js';
import { NOTICE_KINDS } from '../src/npc/attention.js';
import { NOTICE_REACTIONS } from '../src/npc/reactions.js';
import { AMY_FENCE_LINES, JESS_FENCE_LINES } from '../src/npc/fenceLines.js';
import { VibrationModel } from '../src/vibration/vibrationModel.js';

const layout = { hill: { fence: { z: 100, fromX: -50, toX: 30, gap: { at: 10, half: 3 } } } };
const make = (params) => new ElectricFence(createElectricFence(layout), { ...P, ...params });
const vehicle = (x, z, id = 'quad') => ({ id, kind: 'vehicle', points: [{ x, z }] });

describe('the electric fence', () => {
  it('has no fence if the layout has none', () => {
    expect(createElectricFence({})).toBeNull();
    expect(createElectricFence({ hill: {} })).toBeNull();
  });

  it('is in the real layout, with the gap on the climb line and the ends inside the pasture', () => {
    const f = createElectricFence(LAYOUT);
    const pasture = LAYOUT.hill.pasture;
    expect(f).toBeTruthy();
    expect(f.fromX).toBeGreaterThanOrEqual(pasture.minX);
    expect(f.toX).toBeLessThanOrEqual(pasture.maxX);
    expect(f.z).toBeGreaterThan(pasture.minZ);
    expect(f.z).toBeLessThan(pasture.maxZ);
    // The climb's line crosses the fence's z inside the gap.
    const pts = LAYOUT.hill.climb.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, z0] = pts[i];
      const [x1, z1] = pts[i + 1];
      if (z0 < f.z && z1 >= f.z) {
        const x = x0 + ((x1 - x0) * (f.z - z0)) / (z1 - z0);
        expect(Math.abs(x - f.gap.at)).toBeLessThan(f.gap.half);
      }
    }
  });

  it('is near a strand only along the wire and not in the gap', () => {
    const f = createElectricFence(layout);
    expect(f.near(0, 100.3, 0.5)).toBe(true);
    expect(f.near(0, 101, 0.5)).toBe(false);
    expect(f.near(10, 100, 0.5)).toBe(false); // in the gap
    expect(f.near(-60, 100, 0.5)).toBe(false); // past the end
    expect(f.spans()).toEqual([[-50, 7], [13, 30]]);
  });

  it('zaps a quad that touches it, once, then not again until the cooldown is over', () => {
    const fence = make({ zapCooldown: 2 });
    expect(fence.update(0.1, [vehicle(0, 100.2)]).filter((e) => e.type === 'zap')).toHaveLength(1);
    expect(fence.update(0.5, [vehicle(0, 100.2)]).filter((e) => e.type === 'zap')).toHaveLength(0);
    fence.update(2, []);
    expect(fence.update(0.1, [vehicle(0, 100.2)]).filter((e) => e.type === 'zap')).toHaveLength(1);
  });

  it('lets a quad through the gap and past either end', () => {
    const fence = make();
    expect(fence.update(0.1, [vehicle(10, 100)])).not.toContainEqual(expect.objectContaining({ type: 'zap' }));
    expect(fence.update(0.1, [vehicle(40, 100, 'b')])).not.toContainEqual(expect.objectContaining({ type: 'zap' }));
  });

  it('reaches further for a quad than for you on foot', () => {
    const fence = make();
    expect(fence.touching('vehicle', [{ x: 0, z: 100.6 }])).toBeTruthy();
    expect(fence.touching('foot', [{ x: 0, z: 100.6 }])).toBeNull();
    expect(fence.touching('foot', [{ x: 0, z: 100.2 }])).toBeTruthy();
  });

  it('uses whichever of the quad\'s points touches', () => {
    const fence = make();
    const hit = fence.touching('vehicle', [{ x: 0, z: 98 }, { x: 0, z: 99 }, { x: 0, z: 100.1 }]);
    expect(hit.z).toBe(100.1);
  });

  it('does nothing when switched off, and ticks when on', () => {
    const off = make({ live: 0 });
    expect(off.update(5, [vehicle(0, 100)])).toEqual([]);
    const on = make({ tickEvery: 1 });
    let ticks = 0;
    for (let i = 0; i < 100; i++) ticks += on.update(0.1, []).filter((e) => e.type === 'tick').length;
    expect(ticks).toBeGreaterThanOrEqual(9);
    expect(ticks).toBeLessThanOrEqual(11);
  });

  it('can be zapped on demand, ignoring the cooldown', () => {
    const fence = make();
    fence.update(0.1, [vehicle(0, 100)]);
    expect(fence.zapNow('quad', 'vehicle', 0, 100)).toMatchObject({ type: 'zap', id: 'quad' });
    expect(fence.lastZap.id).toBe('quad');
  });

  it('has a range for every tunable', () => {
    expect(Object.keys(FENCE_PARAM_RANGES).sort()).toEqual(Object.keys(P).sort());
  });
});

describe('the girls and the fence', () => {
  it('a zap is a noticed kind that makes a girl flinch', () => {
    expect(NOTICE_KINDS.zap).toBeTruthy();
    expect(NOTICE_REACTIONS.zap.reaction).toBe('flinch');
  });

  it('each girl has the same fence lines, in British English without dashes', () => {
    expect(Object.keys(JESS_FENCE_LINES).sort()).toEqual(Object.keys(AMY_FENCE_LINES).sort());
    for (const l of [...Object.values(JESS_FENCE_LINES), ...Object.values(AMY_FENCE_LINES).map((x) => x.lines)].flat()) expect(l).not.toMatch(/—|–/);
  });
});

describe('the jolt through a quad', () => {
  it('shakes the body and the camera', () => {
    const v = new VibrationModel();
    v.zap(5);
    expect(Math.abs(v.osc.heave.v)).toBeGreaterThan(0);
    expect(Math.abs(v.osc.camRoll.v)).toBeGreaterThan(0);
  });
});
