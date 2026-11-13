import { describe, it, expect } from 'vitest';
import { Tailgate } from '../src/vehicle/tailgate.js';

describe('the Tor tailgate', () => {
  it('drops and raises over its swing time', () => {
    const g = new Tailgate();
    expect(g.toggle(0)).toBeNull();
    g.update(0.45);
    expect(g.open).toBeCloseTo(0.5);
    g.update(1);
    expect(g.open).toBe(1);
    g.toggle(0);
    g.update(2);
    expect(g.open).toBe(0);
    expect(g.shut).toBe(true);
  });

  it('will not come down while moving, and says why', () => {
    const g = new Tailgate();
    expect(g.toggle(3)).toMatch(/Stop first/);
    expect(g.want).toBe(false);
  });

  it('swings shut by itself when you drive off with it down', () => {
    const g = new Tailgate();
    g.toggle(0);
    g.update(2);
    g.update(0.1, { speed: g.p.shutSpeed + 1 });
    expect(g.want).toBe(false);
    g.update(2);
    expect(g.open).toBe(0);
  });
});
