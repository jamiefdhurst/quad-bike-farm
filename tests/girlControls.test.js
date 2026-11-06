import { describe, it, expect } from 'vitest';
import { signalFor, pumpBrake, wetRemark, bowlNeedsDraining, lightsWanted, GIRL_CONTROLS_PARAMS as P, GIRL_CONTROLS_PARAM_RANGES } from '../src/npc/girlControls.js';
import { HerDrive } from '../src/npc/herDriving.js';
import { Indicators } from '../src/vehicle/indicators.js';
import { BrakeState } from '../src/vehicle/brakeState.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';
import { DEFAULT_COMPANION_PARAMS } from '../src/npc/companionParams.js';
import { CHARACTERS } from '../src/npc/characters.js';
import { AMY_CONTROLS_LINES, JESS_CONTROLS_LINES } from '../src/npc/controlsLines.js';
import { VOICE_LINES } from '../src/npc/voiceLines.js';
import { JESS_LINES } from '../src/npc/jessLines.js';

describe('indicators before a turn', () => {
  const from = { x: 0, z: 0 };
  const wp = { x: 0, z: 10 };

  it('signals left for a left turn (heading increases, as the bars) and right for a right', () => {
    expect(signalFor(from, wp, { x: 10, z: 10 }, 10)).toBe('left');
    expect(signalFor(from, wp, { x: -10, z: 10 }, 10)).toBe('right');
  });
  it('is quiet for a gentle bend, a far-off corner and the end of the route', () => {
    expect(signalFor(from, wp, { x: 1, z: 20 }, 10)).toBeNull();
    expect(signalFor(from, wp, { x: 10, z: 10 }, P.signalWithin + 1)).toBeNull();
    expect(signalFor(from, wp, null, 5)).toBeNull();
  });
  it('tunables have ranges', () => {
    for (const k of Object.keys(P)) expect(GIRL_CONTROLS_PARAM_RANGES, k).toHaveProperty(k);
  });
});

function driver(over = {}) {
  const d = Object.create(HerDrive.prototype);
  d.p = { ...DEFAULT_COMPANION_PARAMS, signalsChance: 1 };
  d.events = [];
  d.controlsT = 0;
  d.signalLeft = 0;
  d.wetSaid = false;
  d.index = 0;
  d.waypoints = [{ x: 0, z: 10 }, { x: 10, z: 10 }];
  d.random = () => 0;
  d.quad = { position: { x: 0, z: 0 }, signals: new Indicators(), brakes: new BrakeState() };
  Object.assign(d, over);
  return d;
}

describe('her driving working the controls', () => {
  it('puts the indicator on for the turn coming, and off again if the turn never came', () => {
    const d = driver();
    d.workControls(0.1, d.waypoints[0], 10);
    expect(d.quad.signals.mode).toBe('left');
    d.workControls(P.signalGive + 1, d.waypoints[0], 10);
    expect(d.quad.signals.mode).toBe('off');
  });
  it('does not signal when she is not in the habit, and says so once only for the corner', () => {
    const d = driver({ random: () => 0.99 });
    d.p.signalsChance = 0.5;
    d.workControls(0.1, d.waypoints[0], 10);
    expect(d.quad.signals.mode).toBe('off');
    d.workControls(0.1, d.waypoints[0], 10);
    expect(d.quad.signals.mode).toBe('off'); // she does not re-roll every frame
  });
  it('copes with a vehicle that has no indicators', () => {
    const d = driver();
    d.quad.signals = null;
    expect(() => d.workControls(0.1, d.waypoints[0], 10)).not.toThrow();
  });
  it('remarks on wet brakes once, and again only after they have dried', () => {
    const d = driver();
    d.quad.brakes.wet = 0.8;
    d.workControls(0.1, d.waypoints[0], 40);
    d.workControls(0.1, d.waypoints[0], 40);
    expect(d.events).toEqual(['wetBrakes']);
    d.quad.brakes.wet = 0;
    d.workControls(0.1, d.waypoints[0], 40);
    d.quad.brakes.wet = 0.8;
    d.workControls(0.1, d.waypoints[0], 40);
    expect(d.events).toEqual(['wetBrakes', 'wetBrakes']);
  });
});

describe('pumping wet brakes', () => {
  it('dabs the brake in pulses when wet and rolling, and not when dry or crawling', () => {
    const on = [];
    for (let t = 0; t < P.pumpEvery; t += 0.05) on.push(pumpBrake(t, 0.8, 5) > 0);
    expect(on.some(Boolean)).toBe(true);
    expect(on.some((x) => !x)).toBe(true);
    expect(pumpBrake(0, 0.1, 5)).toBe(0);
    expect(pumpBrake(0, 0.8, 0.5)).toBe(0);
  });
  it('actually dries them: brake pressure at speed wipes the pads (brakeState.js)', () => {
    const b = new BrakeState();
    b.wet = 0.8;
    const dt = 0.05;
    for (let t = 0; t < 20; t += dt) b.update(dt, { speed: 5, pressure: pumpBrake(t, b.wet, 5) });
    expect(b.wet).toBeLessThan(0.35);
  });
  it('wetRemark stays quiet for slightly damp brakes', () => {
    expect(wetRemark(false, 0.2).say).toBe(false);
  });
});

describe('2WD, the lights and the bowl', () => {
  it('lights go on when she drives in the dark and off when she has parked, but not for the work light', () => {
    expect(lightsWanted(true, 0.8, 'off', false)).toBe('low');
    expect(lightsWanted(true, 0.2, 'off', false)).toBeNull();
    expect(lightsWanted(true, 0.8, 'high', false)).toBeNull();
    expect(lightsWanted(false, 0.8, 'low', false)).toBe('off');
    expect(lightsWanted(false, 0.8, 'low', true)).toBeNull();
    expect(lightsWanted(false, 0.8, 'off', false)).toBeNull();
  });
  it('Amy drains a bowl with water in it, and leaves a clear one and a tapless fuel system alone', () => {
    const f = new FuelSystem({ ...DEFAULT_FUEL_PARAMS });
    expect(bowlNeedsDraining(f)).toBe(false);
    f.sediment = 0.6;
    expect(bowlNeedsDraining(f)).toBe(!f.params.noTap);
    expect(bowlNeedsDraining({ params: { noTap: true }, sediment: 1 })).toBe(false);
    expect(bowlNeedsDraining(null)).toBe(false);
  });
  it('Amy puts a quad back in 2WD far more often than Jess does', () => {
    const [amy, jess] = ['amy', 'jess'].map((id) => CHARACTERS.find((c) => c.id === id).params);
    expect(amy.puts2wdBack).toBeGreaterThan(jess.puts2wdBack);
    expect(amy.signalsChance).toBeGreaterThan(jess.signalsChance);
  });
});

describe('the lines', () => {
  it('are in both girls\' sets where both say them, and Jess says nothing Amy does not', () => {
    for (const k of Object.keys(AMY_CONTROLS_LINES)) expect(VOICE_LINES).toHaveProperty(k);
    for (const k of Object.keys(JESS_CONTROLS_LINES)) {
      expect(JESS_LINES).toHaveProperty(k);
      expect(VOICE_LINES).toHaveProperty(k);
    }
  });
});
