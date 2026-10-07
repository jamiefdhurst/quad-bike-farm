import { describe, it, expect } from 'vitest';
import { pickFleet, DEFAULT_FLEET_PARAMS } from '../src/vehicle/fleet.js';
import { QUAD_SPECS, EXTRA_SPECS } from '../src/vehicle/quadSpecs.js';
import { BODY_STYLES } from '../src/vehicle/quadModel.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { createRandom } from '../src/core/random.js';
import { LAYOUT } from '../src/world/layout.js';

describe('the fleet', () => {
  const games = Array.from({ length: 400 }, (_, i) => pickFleet(QUAD_SPECS, EXTRA_SPECS, createRandom(i)));

  it('is the same for the same seed', () => {
    expect(pickFleet(QUAD_SPECS, EXTRA_SPECS, createRandom(7)).map((s) => s.id)).toEqual(
      pickFleet(QUAD_SPECS, EXTRA_SPECS, createRandom(7)).map((s) => s.id),
    );
  });

  it('never has too few vehicles or more than there are parking slots', () => {
    for (const f of games) {
      expect(f.length).toBeGreaterThanOrEqual(DEFAULT_FLEET_PARAMS.minVehicles);
      expect(f.length).toBeLessThanOrEqual(LAYOUT.spawn.quads.length);
    }
  });

  it('varies: sometimes regulars are missing, sometimes extras turn up, sometimes both', () => {
    const regulars = (f) => f.filter((s) => QUAD_SPECS.includes(s)).length;
    expect(games.some((f) => regulars(f) < QUAD_SPECS.length)).toBe(true);
    expect(games.some((f) => regulars(f) === QUAD_SPECS.length)).toBe(true);
    expect(games.some((f) => f.length > regulars(f))).toBe(true);
    expect(games.some((f) => f.length === regulars(f))).toBe(true);
    expect(games.some((f) => f.some((s) => s.id === 'kids'))).toBe(true);
    expect(games.some((f) => f.some((s) => s.id === 'loan'))).toBe(true);
    expect(games.some((f) => f.some((s) => s.id === 'moto'))).toBe(true);
    expect(games.some((f) => f.filter((s) => EXTRA_SPECS.includes(s)).length === EXTRA_SPECS.length)).toBe(true);
    expect(games.some((f) => regulars(f) < QUAD_SPECS.length && f.length > regulars(f))).toBe(true);
  });

  it('has no duplicates', () => {
    for (const f of games) expect(new Set(f).size).toBe(f.length);
  });

  it('caps a full house at the parking slots', () => {
    const f = pickFleet(QUAD_SPECS, EXTRA_SPECS, () => 0.01, { ...DEFAULT_FLEET_PARAMS, extraChances: [0, 0, 0, 1], missingChances: [1, 0, 0] });
    expect(f).toHaveLength(DEFAULT_FLEET_PARAMS.maxVehicles);
    expect(f.filter((s) => EXTRA_SPECS.includes(s))).toHaveLength(EXTRA_SPECS.length);
  });

  it('keeps the regulars if only the minimum would be left', () => {
    const f = pickFleet(QUAD_SPECS, [], () => 0.99, { ...DEFAULT_FLEET_PARAMS, minVehicles: 5 });
    expect(f).toHaveLength(5);
  });
});

describe('extra vehicles', () => {
  it('name body and dash styles that exist, and have what the tuning needs', () => {
    for (const spec of EXTRA_SPECS) {
      expect(BODY_STYLES, spec.name).toContain(spec.style);
      expect(DASH_STYLES, spec.name).toContain(spec.dashStyle);
      expect(spec.idleRange[0], spec.name).toBeGreaterThanOrEqual(spec.safeIdle);
      expect(spec.engine.strokes === 2 ? spec.engine.popProne : 0.7, spec.name).toBe(0.7);
    }
  });

  it('have ids and names unlike the regulars', () => {
    const all = [...QUAD_SPECS, ...EXTRA_SPECS];
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    expect(new Set(all.map((s) => s.name)).size).toBe(all.length);
  });

  it("make the kids' quad small, slow and solo, and the loan quad smooth", () => {
    const kids = EXTRA_SPECS.find((s) => s.id === 'kids');
    const loan = EXTRA_SPECS.find((s) => s.id === 'loan');
    expect(kids.scale).toBeLessThan(1);
    expect(kids.solo).toBe(true);
    expect(kids.vehicle.wheelRadius).toBeCloseTo(0.3 * kids.scale, 3);
    expect(kids.idleRange[1]).toBeLessThan(QUAD_SPECS.find((q) => q.id === 'yellow').idleRange[0]); // a lower tickover than either two-stroke
    for (const s of QUAD_SPECS) expect(kids.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    for (const s of QUAD_SPECS) expect(loan.engine.wearPerMinute).toBeLessThan((s.engine?.wearPerMinute ?? 0.012) / 5);
    for (const s of QUAD_SPECS) expect(loan.roughnessRange[1]).toBeLessThanOrEqual(s.roughnessRange[0] + 0.001);
  });

  it('makes the mini moto a solo two-stroke with a pull-start, anyone may ride, and hidden outriggers that never go flat', async () => {
    const moto = EXTRA_SPECS.find((s) => s.id === 'moto');
    expect(moto.solo).toBe(true);
    expect(moto.owner).toBeUndefined();
    expect(moto.engine.strokes).toBe(2);
    expect(moto.engine.pullStart).toBe(true);
    expect(moto.engine.noStarter).toBe(true);
    expect(moto.vehicle.fourWheelDrive).toBe(0);
    for (const s of QUAD_SPECS) expect(moto.vehicle.maxSpeed).toBeLessThan(s.vehicle.maxSpeed ?? 17);
    const { MOTO_LAYOUT } = await import('../src/vehicle/miniMotoModel.js');
    const out = MOTO_LAYOUT.wheels.filter((w) => w.outrigger);
    expect(out).toHaveLength(2);
    for (const w of out) expect(w.driven).toBe(false);
    for (const w of MOTO_LAYOUT.wheels.filter((w) => !w.outrigger)) expect(w.x).toBe(0);
  });
});
