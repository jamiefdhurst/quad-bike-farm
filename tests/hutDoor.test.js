import { describe, it, expect } from 'vitest';
import { HutDoor, wantsShut, DOOR_OPEN_ANGLE } from '../src/world/hutDoor.js';
import { DEFAULT_HUT_PARAMS as P } from '../src/world/hut.js';

describe("the hut's door", () => {
  it('starts open, with the leaves back against the wall and the doorway clear', () => {
    const d = new HutDoor(P);
    expect(d.isOpen).toBe(true);
    expect(d.angle).toBeCloseTo(-DOOR_OPEN_ANGLE);
    expect(d.blocking).toBe(false);
  });

  it('swings shut over doorSeconds and then blocks the doorway', () => {
    const d = new HutDoor(P);
    expect(d.setOpen(false)).toBe(true);
    d.update(P.doorSeconds / 2);
    expect(d.angle).toBeLessThan(0);
    expect(d.angle).toBeGreaterThan(-DOOR_OPEN_ANGLE);
    d.update(P.doorSeconds);
    expect(d.angle).toBeCloseTo(0);
    expect(d.blocking).toBe(true);
  });

  it('opens again, and setting the state it is already in changes nothing', () => {
    const d = new HutDoor(P);
    expect(d.setOpen(true)).toBe(false);
    d.setOpen(false);
    d.update(5);
    expect(d.setOpen(true)).toBe(true);
    d.update(5);
    expect(d.blocking).toBe(false);
    expect(d.angle).toBeCloseTo(-DOOR_OPEN_ANGLE);
  });

  it('is shut behind the girls in rain or the dark, not on a fine day', () => {
    expect(wantsShut({ rain: 0.5, darkness: 0 }, P)).toBe(true);
    expect(wantsShut({ rain: 0, darkness: 0.9 }, P)).toBe(true);
    expect(wantsShut({ rain: 0, darkness: 0.1 }, P)).toBe(false);
  });
});
