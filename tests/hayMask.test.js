import { describe, it, expect } from 'vitest';
import { Haymaking, CUT, BALED } from '../src/world/haymaking.js';
import { maskLayout, presence, fillMask, MASK_TEXEL, MASK_MARGIN, EDGE_RAMP } from '../src/world/hayMask.js';

const rect = { minX: 40, maxX: 72, minZ: 50, maxZ: 68 };

describe('the hay patch as a picture', () => {
  it('covers the patch and its margin, a texel every half metre', () => {
    const l = maskLayout(rect);
    expect(l.minX).toBe(rect.minX - MASK_MARGIN);
    expect(l.cols * MASK_TEXEL).toBeGreaterThanOrEqual(32 + MASK_MARGIN * 2);
    expect(l.rows * MASK_TEXEL).toBeGreaterThanOrEqual(18 + MASK_MARGIN * 2);
  });

  it('is fully in well inside, half in on the edge and fully out well beyond it', () => {
    expect(presence(rect, 56, 59)).toBe(1);
    expect(presence(rect, 40, 59)).toBeCloseTo(0.5, 5);
    expect(presence(rect, 40 - EDGE_RAMP, 59)).toBe(0);
    expect(presence(rect, 0, 0)).toBe(0);
  });

  it('rounds the corners, so the far corner is further out than the side', () => {
    expect(presence(rect, 39, 49)).toBeLessThan(presence(rect, 39, 59));
  });

  it('marks cut cells red and baled ones green, and carries the edge cell\'s state outwards', () => {
    const hay = new Haymaking({ rect });
    hay.state[0] = CUT;
    hay.state[1] = BALED;
    const l = maskLayout(rect);
    const data = new Uint8Array(l.cols * l.rows * 4);
    fillMask(data, l, hay);
    const at = (x, z) => ((Math.floor((z - l.minZ) / MASK_TEXEL)) * l.cols + Math.floor((x - l.minX) / MASK_TEXEL)) * 4;
    expect([data[at(41, 51)], data[at(41, 51) + 1]]).toEqual([255, 0]);
    expect([data[at(43, 51)], data[at(43, 51) + 1]]).toEqual([255, 255]);
    expect(data[at(60, 60)]).toBe(0);
    expect(data[at(38.5, 51)]).toBe(255); // out past the first cell, still its colour
    expect(data[at(38.5, 51) + 3]).toBeLessThan(data[at(41, 51) + 3]);
  });
});

describe('the long grass and the rest of the field\'s ground cover', () => {
  it('puts tufts only in the meadow and its margin, thinning towards the edge, with none far out', async () => {
    const { tuftSpots } = await import('../src/world/hayView.js');
    let n = 0;
    const random = () => ((n = (n * 1664525 + 1013904223) >>> 0) / 4294967296);
    const spots = tuftSpots(rect, () => 0, random);
    expect(spots.length).toBeGreaterThan(5000);
    const inner = spots.filter((m) => m.elements[12] > rect.minX && m.elements[12] < rect.maxX && m.elements[14] > rect.minZ && m.elements[14] < rect.maxZ);
    expect(inner.length / spots.length).toBeGreaterThan(0.8);
    for (const m of spots) {
      expect(m.elements[12]).toBeGreaterThan(rect.minX - MASK_MARGIN - 0.01);
      expect(m.elements[12]).toBeLessThan(rect.maxX + MASK_MARGIN + 0.01);
    }
  });

  it('keeps the field\'s ordinary grass tufts out of the meadow and its margin', async () => {
    const { inHayMeadow } = await import('../src/world/props.js');
    const { LAYOUT } = await import('../src/world/layout.js');
    const m = LAYOUT.hayMeadow;
    expect(inHayMeadow(LAYOUT, (m.minX + m.maxX) / 2, (m.minZ + m.maxZ) / 2)).toBe(true);
    expect(inHayMeadow(LAYOUT, m.minX - 3, m.minZ - 3)).toBe(true);
    expect(inHayMeadow(LAYOUT, m.minX - 6, m.minZ)).toBe(false);
    expect(inHayMeadow({ ...LAYOUT, hayMeadow: undefined }, 60, 60)).toBe(false);
  });
});
