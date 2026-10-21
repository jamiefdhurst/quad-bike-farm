import { describe, it, expect } from 'vitest';
import { setQuirk, setFault, clearFaults, fixEverything, problemSummary, quirkLabel, engineReadouts } from '../src/debug/vehicleDebug.js';
import { QuirkSet } from '../src/vehicle/quirks.js';
import { BrakeState } from '../src/vehicle/brakeState.js';
import { CarbIcing } from '../src/vehicle/carbIcing.js';
import { FrozenCable } from '../src/vehicle/frozenCable.js';
import { Spotlamps } from '../src/vehicle/spotlamps.js';
import { Faults } from '../src/vehicle/faults.js';
import { FuelSystem, DEFAULT_FUEL_PARAMS } from '../src/vehicle/fuelSystem.js';

const unitWith = () => ({
  engine: { fouling: 0.5, clog: 0.6, wear: 0.4, scuff: 0.3, overheat: 0.2, seized: true, water: 0.4, dieselSoak: 0.4, silencerBlown: 0.5, boiled: true, coolant: 0.2, coolantLeak: 2, battery: 1 },
  quad: { startTrouble: 3, faults: new Faults(), quirks: new QuirkSet(['tapStiff']), sump: { level: 0.2 }, fuel: Object.assign(new FuelSystem({ ...DEFAULT_FUEL_PARAMS }), { water: 0.05, sediment: 0.6 }), brakes: Object.assign(new BrakeState(), { wet: 0.8, binding: true }), iceCable: Object.assign(new FrozenCable(), { ice: 0.9 }), carbIce: Object.assign(new CarbIcing(), { ice: 0.7 }) },
});

describe('vehicle debug helpers', () => {
  it('adds and removes quirks, never both fuel gauge lies', () => {
    const q = new QuirkSet(['fuelHigh']);
    setQuirk(q, 'fuelSticks', true);
    expect(q.kinds).toEqual(['fuelSticks']);
    setQuirk(q, 'hornFlaky', true);
    setQuirk(q, 'fuelSticks', false);
    expect(q.kinds).toEqual(['hornFlaky']);
  });

  it('sets and clears faults', () => {
    const f = new Faults();
    setFault(f, 'belt', 0.7);
    expect(f.started.belt).toBe(true);
    expect(f.levels.belt).toBe(0.7);
    setFault(f, 'belt', 0);
    expect(f.started.belt).toBe(false);
    setFault(f, 'puncture', 0.5);
    setFault(f, 'carb', 0.5);
    clearFaults(f);
    expect(f.any).toBe(false);
    expect(f.tyre).toBe(-1);
  });

  it('fixes everything but leaves quirks', () => {
    const u = unitWith();
    setFault(u.quad.faults, 'cable', 0.8);
    u.quad.faults.hasChain = true;
    u.quad.faults.kept.chainOff = true;
    u.quad.faults.kept.chainLube = 0;
    expect(problemSummary(u)).toContain('chain off the sprocket');
    expect(problemSummary(u)).toContain('chain dry');
    expect(problemSummary(u)).toContain('seized');
    expect(problemSummary(u)).toContain('brake binding');
    expect(problemSummary(u)).toContain('throttle cable frozen');
    expect(problemSummary(u)).toContain('carb iced');
    expect(problemSummary(u)).toContain('water in the fuel');
    u.quad.fuel.wax = 0.7;
    expect(problemSummary(u)).toContain('diesel waxed 0.70');
    u.engine.thermostat = 0.7;
    u.engine.heatLocked = true;
    expect(problemSummary(u)).toContain('thermostat stuck 0.70');
    expect(problemSummary(u)).toContain('overheated');
    fixEverything(u);
    expect(u.quad.fuel.wax).toBe(0);
    expect(u.engine.thermostat).toBe(0);
    expect(u.engine.heatLocked).toBe(false);
    expect(problemSummary(u)).toBe('nothing wrong');
    expect(u.quad.quirks.kinds).toEqual(['tapStiff']);
    expect(u.quad.quirks.tapStiff).toBe(0);
    expect(u.quad.sump.level).toBe(1);
    expect(u.quad.fuel.water + u.quad.fuel.sediment + u.quad.fuel.bowlWater).toBe(0);
    expect(u.quad.faults.chainOff).toBe(false);
    expect(u.quad.faults.kept.chainLube).toBe(1);
    expect(u.quad.startTrouble).toBe(0); // a hard start is a problem the girls keep a quad alive for
  });

  it('lists badly aimed spotlamps as a problem, and putting it right aims them true but leaves them fitted', () => {
    const u = unitWith();
    u.quad.spotlamps = new Spotlamps(true);
    u.quad.spotlamps.fit(0.35);
    expect(problemSummary(u)).toContain('spotlamps aimed badly');
    fixEverything(u);
    expect(u.quad.spotlamps.aim).toBe(1);
    expect(u.quad.spotlamps.fitted).toBe(true);
    expect(problemSummary(u)).toBe('nothing wrong');
  });

  it('labels quirks readably', () => {
    expect(quirkLabel('headlightFlicker')).toBe('headlight flicker');
  });
});

describe('engineReadouts', () => {
  const eng = (params) => ({ params, heat: 0.4, pink: 0.3, soak: 0.6, overheat: 0, steam: 0, boiled: false, coolantPuddle: 0, glow: 0, nip: 0, tick: 0, oilBurn: 0, oilRich: 0, jetOn: 1, jetErr: 0, valveLoose: 0.2, valveTight: 0, chill: 0, sheltered: false });
  const keys = (params) => engineReadouts(eng(params)).map((m) => m.key);

  it('shows pinking and heat soak on an air-cooled petrol engine', () => {
    expect(keys({ strokes: 4 })).toEqual(expect.arrayContaining(['overheating', 'pinking', 'heatSoak', 'valves']));
    expect(engineReadouts(eng({ strokes: 4 })).find((m) => m.key === 'pinking').get(eng({ strokes: 4 }))).toBe(0.3);
  });

  it('leaves out what an engine cannot do', () => {
    expect(keys({ strokes: 4, waterCooled: true })).not.toContain('pinking');
    expect(keys({ strokes: 4, waterCooled: true })).toContain('steam');
    expect(keys({ strokes: 4, compressionIgnition: true })).toContain('glow');
    expect(keys({ strokes: 4 })).not.toContain('glow');
    expect(keys({ strokes: 2 })).toEqual(expect.arrayContaining(['jetting', 'oilRich']));
    expect(keys({ strokes: 2 })).not.toContain('valves');
  });

  it('has a unique key and a label for each', () => {
    for (const params of [{ strokes: 2 }, { strokes: 4 }, { strokes: 4, waterCooled: true }, { strokes: 4, compressionIgnition: true, waterCooled: true }]) {
      const list = engineReadouts(eng(params));
      expect(new Set(list.map((m) => m.key)).size).toBe(list.length);
      for (const m of list) expect(m.label.length).toBeGreaterThan(3);
    }
  });
});
