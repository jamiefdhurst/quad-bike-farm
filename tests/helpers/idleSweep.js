import { expect } from 'vitest';
import { EngineModel } from '../../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../../src/vehicle/vehicleParams.js';
import { applyIdle } from '../../src/vehicle/quadVariation.js';

// Each quad idling for two minutes in the engine model, for tests/quadCharacter*.test.js: the sweep of every quad was one test of 20 s that
// set how long `npm test` took, so it is a test for each quad, the manual ones in one file and the automatics in another (#1183).

export function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DT = 1 / 60;

/** Two minutes warm at idle, blipping the throttle every 30 s. Returns the stall count and the idle's spread. */
export function idleTwoMinutes(spec, idle, roughness, wear, seed, { braking = false, restart = false } = {}) {
  const params = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  applyIdle(params, { ...DEFAULT_VEHICLE_PARAMS, ...spec.vehicle }, idle);
  params.baseRoughness = roughness;
  const engine = new EngineModel({ ...params, initialTemperature: 1 }, { random: seededRandom(seed) });
  engine.wear = wear;
  engine.setIgnition(true);
  for (let i = 0; i < 600 && !engine.isRunning; i++) engine.update(DT, { starter: true });
  let stalls = 0;
  let lo = Infinity;
  let hi = 0;
  for (let i = 0; i < 120 / DT; i++) {
    const t = i * DT;
    // Braking: a hard stop from speed every 10 s, the clutch still engaged for the first second.
    const load = braking && t % 10 < 1 ? 1 : 0;
    engine.update(DT, { throttle: t % 30 > 29.4 ? 0.8 : 0, load });
    if (engine.events.some((e) => e.type === 'stalled')) {
      stalls++;
      if (restart) for (let j = 0; j < 600 && !engine.isRunning; j++) engine.update(DT, { starter: true });
    }
    if (t % 30 > 5 && t % 30 < 29) {
      lo = Math.min(lo, engine.rpm);
      hi = Math.max(hi, engine.rpm);
    }
  }
  return { stalls, lo, hi, running: engine.isRunning };
}

/**
 * The sweep for one quad: both ends of its idle and roughness ranges, new, half worn and as worn as it gets before it turns erratic, six
 * seeds each, idling two minutes warm without a stall, and hard stops until halfway there for the automatics. A run that would be past
 * erratic is not made at all (it used to be made and its answer thrown away).
 */
export function neverStallsIdling(spec) {
  const params = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
  for (const idle of spec.idleRange) {
    for (const roughness of spec.roughnessRange) {
      // As worn as it gets before it turns erratic (some quads are already there new).
      for (const wear of [0, Math.max(0, params.erraticFrom - roughness) / 2, Math.max(0, params.erraticFrom - roughness)]) {
        if (roughness + wear > params.erraticFrom) continue;
        for (const seed of [1, 2, 3, 4, 5, 6]) {
          // Hard stops are only safe to about halfway there (a worn engine can die on one).
          // The manual quads stall on a hard stop with the clutch out by design (tests/manualQuads.test.js).
          for (const braking of !spec.manual && wear <= Math.max(0, params.erraticFrom - roughness) / 2 ? [false, true] : [false]) {
            const r = idleTwoMinutes(spec, idle, roughness, wear, seed, { braking });
            const what = `${spec.name} idle ${idle} roughness ${roughness} wear ${wear} seed ${seed}${braking ? ' braking' : ''}`;
            expect(r.stalls, what).toBe(0);
            expect(r.running, what).toBe(true);
            if (!braking) expect(r.lo, what).toBeGreaterThan(idle * 0.4);
          }
        }
      }
    }
  }
}
