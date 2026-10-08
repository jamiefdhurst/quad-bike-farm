import { describe, it, expect } from 'vitest';
import { flightVelocity, DEFAULT_FLIGHT_PARAMS } from '../src/player/flight.js';
import { Weather } from '../src/world/weather.js';

const none = { forward: 0, right: 0, up: 0 };

describe('flight', () => {
  it('stands still with no keys', () => {
    const v = flightVelocity(none, 0, 0, false);
    expect(Math.hypot(v.x, v.y, v.z)).toBe(0);
  });
  it('forward at yaw 0 goes down -z at the flying speed, and faster with shift', () => {
    const v = flightVelocity({ ...none, forward: 1 }, 0, 0, false);
    expect(v.z).toBeCloseTo(-DEFAULT_FLIGHT_PARAMS.speed);
    expect(flightVelocity({ ...none, forward: 1 }, 0, 0, true).z).toBeCloseTo(-DEFAULT_FLIGHT_PARAMS.fastSpeed);
  });
  it('forward follows where you look, up and down included', () => {
    const v = flightVelocity({ ...none, forward: 1 }, 0, Math.PI / 2, false);
    expect(v.y).toBeCloseTo(DEFAULT_FLIGHT_PARAMS.speed);
    expect(Math.abs(v.z)).toBeLessThan(1e-6);
  });
  it('sideways stays level and diagonals are no faster', () => {
    const v = flightVelocity({ forward: 1, right: 1, up: 1 }, 0.7, 0.4, false);
    expect(Math.hypot(v.x, v.y, v.z)).toBeCloseTo(DEFAULT_FLIGHT_PARAMS.speed);
    expect(flightVelocity({ ...none, right: 1 }, 0, 0.9, false).y).toBe(0);
  });
  it('Space goes straight up', () => {
    expect(flightVelocity({ ...none, up: 1 }, 1, 0.5, false).y).toBeCloseTo(DEFAULT_FLIGHT_PARAMS.speed);
  });
});

describe('Weather.setKind', () => {
  it('jumps to the kind, with its rain, and refuses an unknown one', () => {
    const w = new Weather('sunny');
    expect(w.setKind('rain')).toBe(true);
    expect(w.kind).toBe('rain');
    expect(w.rain).toBeGreaterThan(0);
    expect(w.setKind('hail')).toBe(false);
    expect(w.kind).toBe('rain');
  });
});
