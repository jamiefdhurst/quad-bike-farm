import { describe, it, expect } from 'vitest';
import { BikeLean, DEFAULT_BIKE_PARAMS, leanForCurvature, steerForLean } from '../src/vehicle/bikeLean.js';

const base = { lean: 0, leanRate: 0, speed: 8, bars: 0, barAngle: 0.2, throttle: 0, brake: 0, grip: 1, safe: false, gentle: false };
const run = (bike, secs, s) => {
  let out;
  for (let i = 0; i < secs * 60; i++) out = bike.update(1 / 60, { ...s, lean: typeof s.lean === 'function' ? s.lean(bike) : s.lean });
  return out;
};

describe('bike lean', () => {
  it('turns lean into curvature and back', () => {
    const lean = leanForCurvature(8, 0.1);
    expect(lean).toBeGreaterThan(0);
    // The front wheel's angle for that lean follows the same corner: curvature is tan(angle) over the wheelbase.
    const steer = steerForLean(0.95, lean, 8);
    expect(Math.tan(steer) / 0.95).toBeCloseTo(0.1, 3);
  });

  it('puts a foot down at a walking pace: upright, bars steer, no falling', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const out = run(b, 2, { ...base, speed: 1, bars: 1, barAngle: 0.5, brake: 1, lean: 0.4 });
    expect(b.fallen).toBe(false);
    expect(out.steer).toBeCloseTo(0.5);
    expect(out.rollTorque).toBeLessThan(0); // pushing it back upright from a lean left
  });

  it('leans towards the bars at speed, and steers by the lean', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const out = run(b, 1, { ...base, bars: 0.5, lean: 0.2 });
    expect(b.command).toBeGreaterThan(0.1);
    expect(out.leaning).toBe(true);
    expect(out.steer).toBeCloseTo(steerForLean(DEFAULT_BIKE_PARAMS.wheelbase, 0.2, 8), 1);
    const right = run(new BikeLean({ ...DEFAULT_BIKE_PARAMS }), 1, { ...base, bars: -0.5, lean: -0.2 });
    expect(right.steer).toBeLessThan(0);
  });

  it('asks for less lean going slowly, and less again for a girl', () => {
    const slow = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const fast = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const girl = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    run(slow, 2, { ...base, speed: 4, bars: 1 });
    run(fast, 2, { ...base, speed: 9, bars: 1 });
    run(girl, 2, { ...base, speed: 9, bars: 1, gentle: true });
    expect(slow.command).toBeLessThan(fast.command);
    expect(girl.command).toBeLessThan(fast.command);
  });

  it('steps the rear out under power in a deep lean, and recovers when you ease off', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const deep = { ...base, lean: 0.62, bars: 1 };
    const out = run(b, 0.5, { ...deep, throttle: 1 });
    expect(b.rearSlide).toBeGreaterThan(0);
    expect(out.rearGrip).toBeLessThan(1);
    expect(b.fallen).toBe(false);
    run(b, 3, { ...deep, throttle: 0 });
    expect(b.rearSlide).toBe(0);
    expect(b.fallen).toBe(false);
  });

  it('tucks the front under a hard brake in a corner, and falls to the side it was leaning', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    run(b, 3, { ...base, lean: 0.55, bars: 1, brake: 1 });
    expect(b.fallen).toBe(true);
    expect(b.fallSide).toBe(1);
    expect(b.takeFall()).toBe(true);
    expect(b.takeFall()).toBe(false);
    // Lying down it is pushed over, not held up.
    const out = b.update(1 / 60, { ...base, lean: 1, brake: 1 });
    expect(out.rollTorque).toBeGreaterThan(0);
    b.recover();
    expect(b.fallen).toBe(false);
  });

  it('brakes straight in a straight line without trouble', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    run(b, 3, { ...base, brake: 1 });
    expect(b.fallen).toBe(false);
  });

  it('falls sooner on slippery ground', () => {
    const grass = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const mud = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    const s = { ...base, lean: 0.55, bars: 1, throttle: 0.3 };
    run(grass, 3, s);
    run(mud, 3, { ...s, grip: 0.25 });
    expect(grass.fallen).toBe(false);
    expect(mud.fallen).toBe(true);
  });

  it('never lets go of a bike nobody can fall off', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    run(b, 5, { ...base, lean: 0.9, bars: 1, brake: 1, throttle: 1, grip: 0.1, safe: true });
    expect(b.fallen).toBe(false);
  });

  it('goes down past the fall angle whatever else', () => {
    const b = new BikeLean({ ...DEFAULT_BIKE_PARAMS });
    run(b, 0.1, { ...base, lean: 1.2 });
    expect(b.fallen).toBe(true);
  });
});
