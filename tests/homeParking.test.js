import { describe, it, expect } from 'vitest';
import { DEFAULT_HOME_PARAMS as H, HOME_RESULTS_SKIPPED, nearBarn, pickHomeSpot, bringsItHome, jogging } from '../src/npc/homeParking.js';
import { DEFAULT_LINEUP_PARAMS as L, rowSlots } from '../src/npc/lineUp.js';
import { createRandom } from '../src/core/random.js';

const far = { x: 20, z: -30 };

describe('bringsItHome', () => {
  const ask = (over = {}, roll = 0.1) => bringsItHome({ result: 'bored', pos: far, hasPassenger: false, asked: false, ...over }, () => roll);

  it('brings it home when she has finished a drive out in the field and the roll is under the chance', () => {
    expect(ask({}, 0.1)).toBe(true);
    expect(ask({}, H.returnChance + 0.01)).toBe(false);
    for (const result of ['bored', 'scared', 'raced']) expect(ask({ result })).toBe(true);
  });

  it('does not when the drive was parking or failed, she was asked to stop, someone is on the back, or it is already by the barn', () => {
    for (const result of HOME_RESULTS_SKIPPED) expect(ask({ result })).toBe(false);
    expect(ask({ asked: true })).toBe(false);
    expect(ask({ hasPassenger: true })).toBe(false);
    expect(ask({ pos: { x: L.rowX + 5, z: L.rowZ } })).toBe(false);
  });

  it('does it about 65% of the time over many drives', () => {
    const random = createRandom(3);
    let n = 0;
    for (let i = 0; i < 2000; i++) if (bringsItHome({ result: 'bored', pos: far, hasPassenger: false, asked: false }, random)) n++;
    expect(n / 2000).toBeGreaterThan(0.6);
    expect(n / 2000).toBeLessThan(0.7);
  });
});

describe('nearBarn and pickHomeSpot', () => {
  it('knows what is near the barn', () => {
    expect(nearBarn({ x: L.rowX, z: L.rowZ })).toBe(true);
    expect(nearBarn({ x: L.rowX + H.nearRadius + 1, z: L.rowZ })).toBe(false);
  });

  it('finds a spot east of the row, clear of the others and of the row itself, facing the barn give or take', () => {
    const others = rowSlots(5).map((s) => ({ x: s.x, z: s.z }));
    for (let i = 0; i < 100; i++) {
      const spot = pickHomeSpot(others, createRandom(i + 1));
      expect(spot).not.toBeNull();
      expect(spot.x).toBeGreaterThanOrEqual(H.spotX - H.spotXSpread);
      expect(spot.x).toBeLessThanOrEqual(H.spotX + H.spotXSpread);
      expect(Math.abs(spot.z - L.rowZ)).toBeLessThanOrEqual(H.spotZSpread);
      expect(Math.abs(spot.yaw - L.yaw)).toBeLessThanOrEqual(0.5);
      for (const o of others) expect(Math.hypot(o.x - spot.x, o.z - spot.z)).toBeGreaterThanOrEqual(H.gap);
    }
  });

  it('gives up if the ground is full', () => {
    const full = [];
    for (let x = -50; x <= -36; x += 2) for (let z = L.rowZ - 16; z <= L.rowZ + 16; z += 2) full.push({ x, z });
    expect(pickHomeSpot(full, createRandom(1))).toBeNull();
  });
});

describe('jogging', () => {
  it('jogs from a way off and walks once close, with no flip-flopping between', () => {
    expect(jogging(false, H.jogFrom + 1)).toBe(true);
    expect(jogging(false, H.jogFrom - 1)).toBe(false);
    expect(jogging(true, H.jogFrom - 1)).toBe(true);
    expect(jogging(true, H.jogUntil + 0.5)).toBe(true);
    expect(jogging(true, H.jogUntil - 0.5)).toBe(false);
    expect(jogging(false, 0)).toBe(false);
  });
});
