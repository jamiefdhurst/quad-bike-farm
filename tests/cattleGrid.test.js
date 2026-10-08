import { describe, it, expect } from 'vitest';
import { LAYOUT } from '../src/world/layout.js';
import { createCattleGrid, gridRumble } from '../src/world/cattleGrid.js';
import { DEFAULT_VIBRATION_PARAMS } from '../src/vibration/vibrationParams.js';
import { VibrationModel } from '../src/vibration/vibrationModel.js';

const grid = createCattleGrid(LAYOUT);

describe('cattle grid', () => {
  it('sits across the road in the grass field\'s east gateway', () => {
    expect(grid.onGrid(LAYOUT.fieldHalf, LAYOUT.road.z)).toBe(true);
    expect(grid.onGrid(LAYOUT.fieldHalf - 5, LAYOUT.road.z)).toBe(false);
    expect(grid.onGrid(LAYOUT.fieldHalf + 5, LAYOUT.road.z)).toBe(false);
    expect(grid.onGrid(LAYOUT.fieldHalf, LAYOUT.road.z + 4)).toBe(false);
  });

  it('is wider than the tarmac and fits in the hedge gap', () => {
    expect(grid.maxZ - grid.minZ).toBeGreaterThan(2 * LAYOUT.road.halfWidth);
    expect(grid.maxZ - grid.minZ).toBeLessThan(2 * (LAYOUT.road.halfWidth + LAYOUT.road.verge));
  });

  it('counts the bars a wheel rolls over, in either direction, and none off the side', () => {
    const z = LAYOUT.road.z;
    const all = grid.barsBetween(grid.minX - 1, grid.maxX + 1, z);
    expect(all).toBe(Math.floor((grid.maxX - grid.minX) / grid.pitch));
    expect(grid.barsBetween(grid.maxX + 1, grid.minX - 1, z)).toBe(all);
    expect(grid.barsBetween(grid.minX - 1, grid.maxX + 1, grid.maxZ + 1)).toBe(0);
    expect(grid.barsBetween(grid.minX - 3, grid.minX - 1, z)).toBe(0);
  });

  it('has no grid if the layout has none', () => {
    expect(createCattleGrid({ ...LAYOUT, road: { ...LAYOUT.road, grid: undefined } })).toBeNull();
  });
});

describe('grid rumble', () => {
  const p = DEFAULT_VIBRATION_PARAMS;
  it('is silent when stopped or off the grid', () => {
    expect(gridRumble(0, 1, 0.16, p).rate).toBe(0);
    expect(gridRumble(8, 0, 0.16, p).size).toBe(0);
  });

  it('knocks faster with speed up to a limit, and harder', () => {
    const slow = gridRumble(1, 1, 0.16, p);
    const mid = gridRumble(3, 1, 0.16, p);
    const fast = gridRumble(15, 1, 0.16, p);
    expect(mid.rate).toBeGreaterThan(slow.rate);
    expect(fast.rate).toBe(p.gridMaxRate);
    expect(fast.size).toBeGreaterThan(slow.size);
  });

  it('shakes the vibration model, ridden or not, and only while on the grid', () => {
    const v = new VibrationModel({ ...p }, { random: () => 0.5 });
    const engine = { rpm: 0, roughness: 0, pulses: [] };
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      v.update(1 / 60, engine, 0);
      v.gridJolts(1 / 60, 6, 1, grid.pitch);
      peak = Math.max(peak, Math.abs(v.camera.y), Math.abs(v.body.heave));
    }
    expect(peak).toBeGreaterThan(0);
    const w = new VibrationModel({ ...p }, { random: () => 0.5 });
    for (let i = 0; i < 60; i++) {
      w.update(1 / 60, engine, 0);
      w.gridJolts(1 / 60, 6, 0, grid.pitch);
    }
    expect(w.body.heave).toBe(0);
  });
});
