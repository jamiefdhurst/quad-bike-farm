import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { ExhaustSmoke, DEFAULT_SMOKE_PARAMS } from '../src/effects/exhaustSmoke.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';

const engine = (temperature, dayTemp) => ({
  params: DEFAULT_ENGINE_PARAMS, isRunning: true, temperature, dayTemp, throttle: 0, mixture: 0, fouling: 0, oilRich: 0, cylinders: 1, pulses: [], events: [], state: 'running',
});

/** Runs a smoke system for `seconds` and counts the drops in the air at the end of each frame. */
function dropsSeen(temperature, dayTemp, seconds = 3) {
  const smoke = new ExhaustSmoke(new THREE.Scene(), () => 0, { ...DEFAULT_SMOKE_PARAMS });
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.5, 0);
  tip.updateMatrixWorld(true);
  let max = 0;
  for (let t = 0; t < seconds; t += 1 / 30) {
    smoke.update(1 / 30, engine(temperature, dayTemp), tip, { x: 0, y: 0, z: 0 });
    let n = 0;
    for (let i = 0; i < smoke.life.length; i++) if (smoke.life[i] >= 0 && smoke.heavy[i]) n++;
    max = Math.max(max, n);
  }
  return { max, smoke };
}

describe('drops from a cold exhaust', () => {
  it('drip from a cold engine in cold air', () => {
    expect(dropsSeen(0.1, 2).max).toBeGreaterThan(0);
  });
  it('do not drip from a warm engine or on a mild day', () => {
    expect(dropsSeen(0.9, 2).max).toBe(0);
    expect(dropsSeen(0.1, 20).max).toBe(0);
  });
  it('fall to the ground and are gone', () => {
    const { smoke } = dropsSeen(0.1, 2);
    const tip = new THREE.Object3D();
    const warm = engine(0.9, 2);
    for (let t = 0; t < 3; t += 1 / 30) smoke.update(1 / 30, warm, tip, { x: 0, y: 0, z: 0 });
    let n = 0;
    for (let i = 0; i < smoke.life.length; i++) if (smoke.life[i] >= 0 && smoke.heavy[i]) n++;
    expect(n).toBe(0);
  });
});
