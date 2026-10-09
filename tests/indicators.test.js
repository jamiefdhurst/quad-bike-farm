import { describe, it, expect } from 'vitest';
import { Indicators, SIGNAL_MODES, DEFAULT_INDICATOR_PARAMS as P } from '../src/vehicle/indicators.js';

const run = (ind, seconds, steer = 0, powered = true) => {
  let last;
  for (let t = 0; t < seconds; t += 1 / 60) last = ind.update(1 / 60, steer, powered);
  return last;
};

describe('Indicators', () => {
  it('starts off and shows nothing', () => {
    const ind = new Indicators();
    expect(ind.mode).toBe('off');
    expect(run(ind, 1)).toEqual({ left: false, right: false });
  });

  it('toggles a mode with the same key and swaps with another', () => {
    const ind = new Indicators();
    expect(ind.press('left')).toBe('left');
    expect(ind.press('right')).toBe('right');
    expect(ind.press('right')).toBe('off');
    expect(ind.press('hazard')).toBe('hazard');
    expect(ind.press('nonsense')).toBe('hazard');
    expect(SIGNAL_MODES).toContain(ind.mode);
  });

  it('lights only its own side, and both for hazards', () => {
    const ind = new Indicators();
    ind.press('left');
    expect(ind.update(0.01, 0, true)).toEqual({ left: true, right: false });
    ind.press('right');
    expect(ind.update(0.01, 0, true)).toEqual({ left: false, right: true });
    ind.press('hazard');
    expect(ind.update(0.01, 0, true)).toEqual({ left: true, right: true });
  });

  it('flashes at the set rate and clicks on each change', () => {
    const ind = new Indicators();
    ind.press('hazard');
    let ons = 0;
    let offs = 0;
    for (let t = 0; t < 10; t += 1 / 60) {
      ind.update(1 / 60, 0, true);
      if (ind.click === 'on') ons++;
      if (ind.click === 'off') offs++;
    }
    expect(Math.abs(ons - 10 * P.flashRate)).toBeLessThanOrEqual(1);
    expect(Math.abs(offs - ons)).toBeLessThanOrEqual(1);
  });

  it('is dark without power but remembers its mode', () => {
    const ind = new Indicators();
    ind.press('left');
    expect(run(ind, 1, 0, false)).toEqual({ left: false, right: false });
    expect(ind.mode).toBe('left');
  });

  it('cancels itself after turning the way it points and straightening up', () => {
    const ind = new Indicators();
    ind.press('left');
    run(ind, 0.5, 0);
    expect(ind.mode).toBe('left'); // straight on: it stays
    run(ind, 0.5, 0.8);
    expect(ind.mode).toBe('left'); // mid turn
    run(ind, 0.2, 0);
    expect(ind.mode).toBe('off');
  });

  it('does not cancel for a turn the other way, or for the hazards', () => {
    const ind = new Indicators();
    ind.press('left');
    run(ind, 0.5, -0.8);
    run(ind, 0.2, 0);
    expect(ind.mode).toBe('left');
    ind.press('hazard');
    run(ind, 0.5, 0.8);
    run(ind, 0.5, 0);
    expect(ind.mode).toBe('hazard');
  });
});
