import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { LAND_ROVER_SPEC as L } from '../src/vehicle/quadSpecs.js';
import { DASH_STYLES } from '../src/vehicle/dash.js';
import { canTow } from '../src/vehicle/tipTrailer.js';
import { featuresOf } from '../src/vehicle/quirks.js';
import { EngineModel } from '../src/engine/engineModel.js';
import { DEFAULT_ENGINE_PARAMS } from '../src/engine/engineParams.js';
import { AUDIO_PARAM_RANGES } from '../src/audio/audioParams.js';
import { LAYOUT } from '../src/world/layout.js';
import { LANDY_LAYOUT, LANDY_GROUND_OFFSET } from '../src/vehicle/landRoverModel.js';

describe('the Land Rover', () => {
  it('stands on its tyres at its size: the physics puts the ground where the model draws it, not inside the wheels', () => {
    const k = L.scale ?? 1;
    for (const w of LANDY_LAYOUT.wheels) {
      // Mount, down the suspension at rest, down the (scaled) wheel: the ground, in chassis space.
      const ground = w.y * k - L.vehicle.suspensionRestLength - w.radius * k;
      expect(ground).toBeCloseTo(LANDY_GROUND_OFFSET * k, 2);
    }
    expect(L.vehicle.wheelRadius).toBeCloseTo(LANDY_LAYOUT.wheels[0].radius * k, 2);
  });

  it('is a petrol four-speed manual with no synchromesh on first and second, a 4WD lever, a diff lock and no fuel tap', () => {
    expect(DASH_STYLES).toContain(L.dashStyle);
    expect(AUDIO_PARAM_RANGES.recBank).toContain(L.audio.recBank);
    expect(L.manual).toBe(true);
    expect(L.gearbox.gears).toBe(4);
    expect(L.gearbox.crashGears).toBe(2);
    expect(L.driveSwitch && L.diffLock).toBe(true);
    expect(L.engine.runsOnDiesel).toBeFalsy();
    expect(L.fuel.noTap).toBe(true);
  });

  it('idles at the pace of the old Jeep it is recorded from, so its beats play at their own speed', () => {
    const bank = JSON.parse(readFileSync('public/audio/engine-bank-landy.json', 'utf8'));
    const rpms = bank.grains.filter((g) => g.kind === 'idle' && g.ok !== false).map((g) => g.rpm / 4).sort((a, b) => a - b);
    const recorded = rpms[Math.floor(rpms.length / 2)];
    expect(L.idleRange[0]).toBeGreaterThan(recorded * 0.92);
    expect(L.idleRange[1]).toBeLessThan(recorded * 1.05);
    expect(L.engine.idleRpmWarm).toBeGreaterThanOrEqual(L.idleRange[0]);
    expect(L.engine.idleRpmWarm).toBeLessThanOrEqual(L.idleRange[1]);
  });

  it('runs out of puff at 50 to 55 mph in top', () => {
    const mph = (ms) => ms * 2.237;
    expect(mph(L.gearbox.topSpeed4)).toBeGreaterThan(50);
    expect(mph(L.gearbox.topSpeed4)).toBeLessThan(58);
    expect(L.vehicle.maxSpeed).toBeGreaterThanOrEqual(L.gearbox.topSpeed4);
  });

  it('can tow the little trailer from its own towing jaw', () => {
    expect(canTow({ towHitch: {} })).toBe(true);
    expect(canTow({})).toBe(false);
  });

  it('gets a quad\'s choke and gauge quirks, but none for a saddle it has not got', () => {
    const f = featuresOf(L);
    expect(f.choke).toBe(true);
    expect(f.fuelGauge).toBe(true);
    expect(f.seat).toBe(false);
    expect(f.tap).toBe(false);
  });

  it('sounds a swing on its starting handle as a clunk, not the starter motor', () => {
    const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...L.engine, initialTemperature: 1 });
    e.setIgnition(true);
    expect(e.pull(0.6)).not.toBeNull();
    e.update(1 / 60, { fuel: 1 });
    const types = e.events.map((ev) => ev.type);
    expect(types).toContain('handCrankOn');
    expect(types).not.toContain('starterOn');
  });

  it('still uses the starter motor on the key', () => {
    const e = new EngineModel({ ...DEFAULT_ENGINE_PARAMS, ...L.engine, initialTemperature: 1 });
    e.setIgnition(true);
    e.update(1 / 60, { starter: true, fuel: 1 });
    expect(e.events.map((ev) => ev.type)).toContain('starterOn');
  });
});


describe('where the bale trailer stands', () => {
  it('is clear of the straw bales, the little trailer and the north hedge, so nothing starts inside anything', () => {
    const at = LAYOUT.trailer;
    for (const [x, z] of LAYOUT.strawBaleSpots) expect(Math.hypot(at.x - x, at.z - z)).toBeGreaterThan(4);
    expect(Math.hypot(at.x - LAYOUT.tipTrailer.x, at.z - LAYOUT.tipTrailer.z)).toBeGreaterThan(6);
    expect(LAYOUT.fieldHalf - at.z).toBeGreaterThan(6); // the hedge is at fieldHalf; its body reaches about 2.5 m behind the axle
  });
});
