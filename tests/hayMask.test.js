import { describe, it, expect } from 'vitest';
import { Haymaking, DEFAULT_HAY_PARAMS, CUT, BALED } from '../src/world/haymaking.js';
import { maskLayout, presence, fillMask, fillState, paintCells, MASK_TEXEL, MASK_MARGIN, EDGE_RAMP } from '../src/world/hayMask.js';
import { LAYOUT } from '../src/world/layout.js';

const rect = { minX: 40, maxX: 72, minZ: 50, maxZ: 68 };
const rect0 = () => ({ ...rect });

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

describe('repainting only the hay that changed (#1071)', () => {
  // A patch that isn't a whole number of cells or texels across, so the cells' edges fall between texels and a strip is left over at the far sides.
  const odd = { minX: 40.3, maxX: 71.6, minZ: 50, maxZ: 67.1 };
  const picture = (hay) => {
    const l = maskLayout(hay.rect);
    const data = new Uint8Array(l.cols * l.rows * 4);
    fillMask(data, l, hay);
    return { l, data };
  };
  const whole = (hay) => picture(hay).data;
  /** Drives the mower (or the baler) west to east through the patch's middle, repainting each event's cells, and returns the events' texel counts. */
  const pass = (hay, l, data) => {
    const wrote = [];
    const z = (hay.rect.minZ + hay.rect.maxZ) / 2;
    for (let x = hay.rect.minX - 2; x < hay.rect.maxX + 2; x += 2 / 60) {
      for (const e of hay.update(1 / 60, { x, z, heading: Math.PI / 2, speed: 2, working: true, day: 1 })) {
        if (e.type === 'cut' || e.type === 'baled') wrote.push(paintCells(data, l, hay, e.cells));
      }
    }
    return wrote;
  };

  it('a cut repainted cell by cell is the picture a full redraw gives', () => {
    for (const rect of [rect0(), odd]) {
      const hay = new Haymaking({ rect, params: { ...DEFAULT_HAY_PARAMS, cutNeeded: 1e9 } });
      hay.start();
      const { l, data } = picture(hay);
      const wrote = pass(hay, l, data);
      expect(wrote.length).toBeGreaterThan(5);
      expect(hay.count(CUT)).toBeGreaterThan(10);
      expect(data).toEqual(whole(hay));
    }
  });

  it('holds for the cells on the patch\'s edges and corners, whose colour runs out over the margin', () => {
    for (const rect of [rect0(), odd]) {
      const hay = new Haymaking({ rect });
      const { l, data } = picture(hay);
      const cells = [0, hay.cols - 1, hay.cols * (hay.rows - 1), hay.cells - 1, 3, hay.cols * 2, hay.cols * 3 - 1, hay.cols * 4 + 5];
      cells.forEach((i, n) => (hay.state[i] = n % 2 ? BALED : CUT));
      paintCells(data, l, hay, cells);
      expect(data).toEqual(whole(hay));
    }
  });

  it('touches only the changed cells\' texels: 16 for a cell in the middle, and none of a cell it was not given', () => {
    const hay = new Haymaking({ rect: rect0() });
    const { l, data } = picture(hay);
    const before = data.slice();
    const a = hay.cols * 4 + 5;
    const b = hay.cols * 6 + 9;
    hay.state[a] = CUT;
    hay.state[b] = CUT;
    expect(paintCells(data, l, hay, [a])).toBe((hay.cell / MASK_TEXEL) ** 2);
    let changed = 0;
    for (let o = 0; o < data.length; o += 4) if (data[o] !== before[o]) changed += 1;
    expect(changed).toBe(16);
    expect(data).not.toEqual(whole(hay)); // b is still standing in the picture
    paintCells(data, l, hay, [b]);
    expect(data).toEqual(whole(hay));
    expect(paintCells(data, l, hay, [])).toBe(0);
  });

  it('never rewrites the edge fade, in a cell\'s repaint or the colours\' full redraw', () => {
    const hay = new Haymaking({ rect: odd });
    const { l, data } = picture(hay);
    for (let o = 3; o < data.length; o += 4) data[o] = 7; // a fade no fillMask would write
    hay.state.fill(CUT);
    paintCells(data, l, hay, [0, hay.cells - 1]);
    fillState(data, l, hay);
    for (let o = 3; o < data.length; o += 4) if (data[o] !== 7) throw new Error(`the fade was rewritten at texel ${(o - 3) / 4}`);
    const full = whole(hay);
    for (let o = 0; o < data.length; o += 4) expect([data[o], data[o + 1], data[o + 2]]).toEqual([full[o], full[o + 1], full[o + 2]]);
  });

  it('on the new farm\'s Hay Meadow a pass of the mower then the baler repaints a few dozen texels an event, not the 107,000', () => {
    const hay = new Haymaking({ rect: LAYOUT.hayMeadow, params: { ...DEFAULT_HAY_PARAMS, cutNeeded: 1e9, balesNeeded: 1e6 } });
    hay.start();
    const { l, data } = picture(hay);
    expect(l.cols * l.rows).toBeGreaterThan(100000);
    const cut = pass(hay, l, data);
    expect(cut.length).toBeGreaterThan(50);
    expect(Math.max(...cut)).toBeLessThanOrEqual(16 * 8);
    expect(data).toEqual(whole(hay));
    // One cut cell out of the baler's way, or the baler runs out of cut grass and leaves every bale it still owes.
    const spare = hay.index((hay.rect.minX + hay.rect.maxX) / 2, hay.rect.minZ + (hay.rect.maxZ - hay.rect.minZ) / 4);
    expect(hay.state[spare]).toBe(0);
    hay.state[spare] = CUT;
    paintCells(data, l, hay, [spare]);
    hay.cut = hay.p.cutNeeded = hay.count(CUT); // the cutting is done: the same pass now bales
    const baled = pass(hay, l, data);
    expect(baled.length).toBeGreaterThan(50);
    expect(hay.count(BALED)).toBeGreaterThan(50);
    expect(data).toEqual(whole(hay));
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
    const cx = (m.minX + m.maxX) / 2;
    const cz = (m.minZ + m.maxZ) / 2;
    expect(inHayMeadow(LAYOUT, cx, cz)).toBe(true);
    expect(inHayMeadow(LAYOUT, cx, m.minZ - 3)).toBe(true); // its margin, not only the polygon
    expect(inHayMeadow(LAYOUT, cx, m.minZ - 30)).toBe(false);
    expect(inHayMeadow({ ...LAYOUT, hayMeadow: undefined }, 60, 60)).toBe(false);
  });
});
