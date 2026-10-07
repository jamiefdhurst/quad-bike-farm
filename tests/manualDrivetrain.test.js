import { describe, it, expect } from 'vitest';
import { ManualDrivetrain, DEFAULT_GEARBOX_PARAMS as G, gearLabel, pickWornGearbox } from '../src/vehicle/manualDrivetrain.js';
import { createRandom } from '../src/core/random.js';
import { DEFAULT_VEHICLE_PARAMS as V } from '../src/vehicle/vehicleParams.js';

const base = { dt: 1 / 60, clutchHeld: false, power: 1, running: true, throttle: 0, brake: 0, forwardSpeed: 0 };

/** Holds the controls for a number of seconds and returns the drivetrain. */
function run(d, seconds, s) {
  for (let t = 0; t < seconds; t += 1 / 60) d.update({ ...base, ...s });
  return d;
}

describe('the gear lever and clutch pedal', () => {
  it('starts in neutral with the clutch up', () => {
    const d = new ManualDrivetrain(V);
    expect(d.gear).toBe(0);
    expect(d.neutral).toBe(true);
    expect(d.pedal).toBe(0);
  });

  it('only changes into a gear with the clutch down, but finds neutral any time', () => {
    const d = new ManualDrivetrain(V);
    expect(d.select(1)).toBe('clutch');
    expect(d.gear).toBe(0);
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(1)).toBe('ok');
    expect(d.gear).toBe(1);
    expect(d.select(1)).toBe('same');
    run(d, 2, { clutchHeld: false });
    expect(d.select(2)).toBe('clutch');
    expect(d.select(0)).toBe('ok');
  });

  it('presses the pedal fast and lets it up slowly', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.2, { clutchHeld: true });
    expect(d.pedal).toBe(1);
    run(d, 0.2, { clutchHeld: false });
    expect(d.pedal).toBeGreaterThan(0.6);
    run(d, 1, { clutchHeld: false });
    expect(d.pedal).toBe(0);
    expect(d.clutch).toBe(1);
  });

  it('may only crank in neutral or with the clutch down', () => {
    const d = new ManualDrivetrain(V);
    expect(d.mayCrank).toBe(true);
    run(d, 0.5, { clutchHeld: true });
    d.select(2);
    expect(d.mayCrank).toBe(true);
    run(d, 2, {});
    expect(d.mayCrank).toBe(false);
  });

  it('labels the gates', () => {
    expect([-1, 0, 1, 2, 3].map(gearLabel)).toEqual(['R', 'N', '1', '2', '3']);
  });
});

describe('drive', () => {
  const inGear = (gear) => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(gear);
    return d;
  };

  it('gives no drive in neutral or with the clutch down', () => {
    expect(run(new ManualDrivetrain(V), 1, { throttle: 1 }).driveForce).toBe(0);
    const d = inGear(1);
    run(d, 0.2, { clutchHeld: true, throttle: 1 });
    expect(d.driveForce).toBe(0);
  });

  it('is strongest in first and weakest in third at a standstill', () => {
    const force = (gear) => run(inGear(gear), 2, { throttle: 1 }).driveForce;
    expect(force(1)).toBeGreaterThan(force(2));
    expect(force(2)).toBeGreaterThan(force(3));
    expect(force(1)).toBeCloseTo(V.maxDriveForce * G.torque1, -2);
  });

  it('stops pushing at the top speed of the gear', () => {
    const d = inGear(1);
    expect(run(d, 1, { throttle: 1, forwardSpeed: G.topSpeed1 + 0.1 }).driveForce).toBeLessThanOrEqual(0);
    expect(run(d, 1, { throttle: 1, forwardSpeed: G.topSpeed1 * 0.5 }).driveForce).toBeGreaterThan(0);
  });

  it('pushes backwards in reverse', () => {
    expect(run(inGear(-1), 2, { throttle: 1 }).driveForce).toBeLessThan(0);
  });

  it('creeps in first at idle with the clutch out, as a tractor does', () => {
    expect(run(inGear(1), 2, { throttle: 0 }).driveForce).toBeGreaterThan(0);
  });

  it('brakes the engine on a closed throttle while rolling in gear', () => {
    const d = run(inGear(2), 2, { throttle: 0, forwardSpeed: 3 });
    expect(d.driveForce).toBeLessThan(0);
    expect(d.coupled).toBe(true);
  });
});

describe('pulling away', () => {
  const dump = (gear, throttle) => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(gear);
    run(d, 3, { clutchHeld: false, throttle });
    return d.engineLoad;
  };

  it('drags the engine harder the higher the gear', () => {
    expect(dump(1, 0)).toBeLessThan(dump(2, 0));
    expect(dump(2, 0)).toBeLessThan(dump(3, 0));
    expect(dump(3, 0)).toBeGreaterThan(0.9);
  });

  it('is eased by opening the throttle', () => {
    expect(dump(3, 1)).toBeLessThan(dump(3, 0) * 0.2);
  });

  it('eases off as it gets up to speed, and is nothing in neutral', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(3);
    expect(run(d, 2, { forwardSpeed: G.topSpeed3 }).engineLoad).toBeLessThan(0.05);
    d.select(0);
    expect(run(d, 1, {}).engineLoad).toBe(0);
  });

  it('loads the engine when braking in gear while rolling, and not at a standstill', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(2);
    expect(run(d, 2, { forwardSpeed: 3, brake: 1, throttle: 0.5 }).engineLoad).toBeGreaterThan(0.9);
  });

  it('does nothing with the engine stopped', () => {
    const d = new ManualDrivetrain(V);
    run(d, 0.5, { clutchHeld: true });
    d.select(1);
    const s = run(d, 2, { running: false, throttle: 1 });
    expect(s.driveForce).toBe(0);
    expect(s.engineLoad).toBe(0);
  });
});

describe('false neutral', () => {
  const rolls = (...values) => {
    let i = 0;
    return () => values[Math.min(i++, values.length - 1)];
  };

  it('can miss the gear if the change is rushed, leaving it in neutral', () => {
    const d = new ManualDrivetrain(V, G, rolls(0.1));
    run(d, 0.12, { clutchHeld: true }); // the pedal is down, but only just
    expect(d.canChange).toBe(true);
    expect(d.select(2)).toBe('missed');
    expect(d.gear).toBe(0);
    run(d, 0.3, { clutchHeld: true });
    expect(d.select(2)).toBe('ok'); // held a moment longer, it goes in
  });

  it('goes in cleanly once the pedal has been down a moment', () => {
    const d = new ManualDrivetrain(V, G, rolls(0));
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(2)).toBe('ok');
    expect(d.gear).toBe(2);
  });

  it('goes in when a rushed roll comes up lucky, and for a careful driver whatever the roll', () => {
    const lucky = new ManualDrivetrain(V, G, rolls(0.99));
    run(lucky, 0.12, { clutchHeld: true });
    expect(lucky.select(1)).toBe('ok');
    const careful = new ManualDrivetrain(V, G, rolls(0));
    run(careful, 0.12, { clutchHeld: true });
    expect(careful.select(1, true)).toBe('ok');
  });

  it('never misses neutral, and the timer restarts when the pedal comes up', () => {
    const d = new ManualDrivetrain(V, G, rolls(0));
    run(d, 0.5, { clutchHeld: true });
    expect(d.pedalDown).toBeGreaterThan(0.3);
    run(d, 1, { clutchHeld: false });
    expect(d.pedalDown).toBe(0);
    run(d, 0.12, { clutchHeld: true });
    expect(d.select(0)).toBe('same');
  });
});

describe('a worn gearbox', () => {
  const climbing = { forwardSpeed: 3, throttle: 1, slope: 0.25 };

  function worn(random) {
    const d = new ManualDrivetrain(V, G, random);
    run(d, 0.5, { clutchHeld: true });
    d.select(2);
    d.wear(2, 1);
    run(d, 1, { clutchHeld: false });
    return d;
  }

  it('jumps out of its worn gear under throttle on a climb, once', () => {
    const d = worn(() => 0);
    run(d, 0.1, climbing);
    expect(d.gear).toBe(0);
    expect(d.takeEvent()).toBe('jumped');
    expect(d.takeEvent()).toBe(null);
  });

  it('holds on the level, off the throttle, with the clutch down, or in another gear', () => {
    for (const s of [{ ...climbing, slope: 0 }, { ...climbing, throttle: 0.2 }, { ...climbing, clutchHeld: true }]) {
      const d = worn(() => 0);
      if (s.clutchHeld) run(d, 0.3, { clutchHeld: true }); // the pedal is already down, not just going down
      run(d, 0.3, s);
      expect(d.gear).toBe(2);
    }
    const other = new ManualDrivetrain(V, G, () => 0);
    run(other, 0.5, { clutchHeld: true });
    other.select(3);
    other.wear(2, 1);
    run(other, 1, { clutchHeld: false });
    run(other, 0.3, climbing);
    expect(other.gear).toBe(3);
  });

  it('is rarer when less worn, and a gearbox that is not worn never does it', () => {
    const count = (wear) => {
      let n = 0;
      let seed = 1;
      const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < 400; i++) {
        const d = new ManualDrivetrain(V, G, rand);
        run(d, 0.5, { clutchHeld: true });
        d.select(2, true);
        if (wear) d.wear(2, wear);
        run(d, 1, { clutchHeld: false });
        run(d, 1, climbing);
        if (d.gear === 0) n++;
      }
      return n;
    };
    expect(count(0)).toBe(0);
    expect(count(0.5)).toBeGreaterThan(40);
    expect(count(0.5)).toBeLessThan(count(1));
  });
});

describe('which gearbox is worn', () => {
  it('picks one candidate and one of its forward gears above first', () => {
    const cs = [{ id: 'red', gears: 4 }, { id: 'tractor', gears: 3 }];
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const r = createRandom(i);
      const w = pickWornGearbox(cs, r);
      const c = cs.find((x) => x.id === w.id);
      expect(w.gear).toBeGreaterThanOrEqual(2);
      expect(w.gear).toBeLessThanOrEqual(c.gears);
      expect(w.wear).toBeGreaterThanOrEqual(0.5);
      expect(w.wear).toBeLessThanOrEqual(1);
      seen.add(w.id);
    }
    expect(seen.size).toBe(2);
    expect(pickWornGearbox([], createRandom(1))).toBe(null);
  });
});

describe('gears with no synchromesh (the Land Rover)', () => {
  const landy = { ...G, gears: 4, crashGears: 2, crashSpeed: 1 };

  it('crunches and stays put going into first or second on the move, but takes third and fourth', () => {
    const d = new ManualDrivetrain(V, landy);
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(3, true, 6)).toBe('ok');
    expect(d.select(2, true, 4)).toBe('crunch');
    expect(d.gear).toBe(3);
    expect(d.select(1, true, 4)).toBe('crunch');
    expect(d.select(4, true, 6)).toBe('ok');
  });

  it('goes into first or second nearly stopped', () => {
    const d = new ManualDrivetrain(V, landy);
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(1, true, 0.5)).toBe('ok');
    expect(d.select(2, true, 0.8)).toBe('ok');
  });

  it('leaves a box with synchromesh alone however fast it is going', () => {
    const d = new ManualDrivetrain(V, { ...G, gears: 4 });
    run(d, 0.5, { clutchHeld: true });
    expect(d.select(1, true, 8)).toBe('ok');
  });
});
