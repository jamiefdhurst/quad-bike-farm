import { describe, it, expect } from 'vitest';
import { OUTFITS, withShirt } from '../src/npc/outfit.js';
import { QUAD_SPECS } from '../src/vehicle/quadSpecs.js';

describe('withShirt', () => {
  it('recolours the shirt and the polo together and leaves the rest alone', () => {
    const out = withShirt(OUTFITS.farmPolo, 0xe9c21b);
    expect(out.colors.shirt).toBe('#e9c21b');
    expect(out.polo).toBe('#e9c21b');
    expect(out.colors.shoes).toBe(OUTFITS.farmPolo.colors.shoes);
    expect(out.shorts).toBe(OUTFITS.farmPolo.shorts);
  });

  it('pads short hex numbers and does not change the original', () => {
    expect(withShirt(OUTFITS.jessPolo, 0x2e6b30).colors.shirt).toBe('#2e6b30');
    expect(withShirt(OUTFITS.jessPolo, 0x0000ff).colors.shirt).toBe('#0000ff');
    expect(OUTFITS.jessPolo.colors.shirt).toBe('#8e2238');
  });

  it('works for every quad colour', () => {
    for (const spec of Object.values(QUAD_SPECS)) expect(withShirt(OUTFITS.farmPolo, spec.bodyColor).colors.shirt).toMatch(/^#[0-9a-f]{6}$/);
  });
});
