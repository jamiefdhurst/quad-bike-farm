import { describe, it, expect } from 'vitest';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { DEFAULT_VEHICLE_PARAMS } from '../src/vehicle/vehicleParams.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';
import { applyIdle } from '../src/vehicle/quadVariation.js';

function seededRandom(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DT = 1 / 60;

/** Two minutes warm at idle, blipping the throttle every 30 s. Returns the stall count and the idle's spread. */
function idleTwoMinutes(spec, idle, roughness, wear, seed, { braking = false, restart = false } = {}) {
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

describe('each quad has its own character', () => {
  it('idles in its own band, and no two quads share a roughness range', () => {
    const sorted = [...QUAD_SPECS].sort((a, b) => a.roughnessRange[0] - b.roughnessRange[0]);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].roughnessRange[0]).toBeGreaterThan(sorted[i - 1].roughnessRange[1]);
    for (const spec of QUAD_SPECS) expect(spec.idleRange[1] - spec.idleRange[0]).toBeLessThanOrEqual(300);
  });

  it('never stalls idling warm, new or worn right up to needing a service, nor on hard stops until halfway there', () => {
    for (const spec of QUAD_SPECS) {
      const params = { ...DEFAULT_ENGINE_PARAMS, ...spec.engine };
      for (const idle of spec.idleRange) {
        for (const roughness of spec.roughnessRange) {
          // As worn as it gets before it turns erratic (some quads are already there new).
          for (const wear of [0, Math.max(0, params.erraticFrom - roughness) / 2, Math.max(0, params.erraticFrom - roughness)]) {
            for (const seed of [1, 2, 3, 4, 5, 6]) {
              // Hard stops are only safe to about halfway there (a worn engine can die on one).
              // The manual quads stall on a hard stop with the clutch out by design (tests/manualQuads.test.js).
              for (const braking of !spec.manual && wear <= Math.max(0, params.erraticFrom - roughness) / 2 ? [false, true] : [false]) {
                const r = idleTwoMinutes(spec, idle, roughness, wear, seed, { braking });
                const what = `${spec.name} idle ${idle} roughness ${roughness} wear ${wear} seed ${seed}${braking ? ' braking' : ''}`;
                if (roughness + wear > params.erraticFrom) continue;
                expect(r.stalls, what).toBe(0);
                expect(r.running, what).toBe(true);
                if (!braking) expect(r.lo, what).toBeGreaterThan(idle * 0.4);
              }
            }
          }
        }
      }
    }
  }, 90000); // a sweep of every quad, idle, wear and seed: slow by design (about 10 s here, over 30 s on a CI runner)

  it('runs very erratically fully worn: stumbling, surging, and now and then dying, so it wants a service', () => {
    for (const spec of QUAD_SPECS) {
      const idle = (spec.idleRange[0] + spec.idleRange[1]) / 2;
      let stalls = 0;
      let lo = Infinity;
      let hi = 0;
      for (const seed of [1, 2, 3]) {
        const r = idleTwoMinutes(spec, idle, spec.roughnessRange[0], 1, seed, { restart: true });
        stalls += r.stalls;
        lo = Math.min(lo, r.lo);
        hi = Math.max(hi, r.hi);
      }
      // Six minutes in all: it dies now and then (about once every minute or two at most), and its idle is all over the place.
      expect(stalls, spec.name).toBeLessThan(9);
      expect(hi - lo, spec.name).toBeGreaterThan(idle * 0.9);
    }
  });

});
