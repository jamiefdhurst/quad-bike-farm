import { describe, it, expect } from 'vitest';
import { recordRowYs } from '../src/world/jobBoard.js';
import { tagText, tagLayout, BAYS } from '../src/workshop/tyreRackModel.js';
import { HEADING as ADS_HEADING, slipRect } from '../src/world/classifiedsView.js';
import { HEADING as PHOTOS_HEADING } from '../src/photos/photoBoard.js';
import { PhotoWall } from '../src/photos/photos.js';

// The barn's boards (#811): the records as a table with no lines overlapping, the tyre rack's tags with no number, a heading on each cork board and
// a slip's shadow where the slip is.
describe('the records table', () => {
  it('keeps every line at least a line of chalk apart, however many there are', () => {
    for (let n = 2; n <= 11; n++) {
      const ys = recordRowYs(n);
      for (let i = 1; i < n; i++) expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(28);
    }
  });

  it('stays on the board and leaves the heading clear', () => {
    const ys = recordRowYs(8);
    expect(ys[0]).toBeGreaterThan(100);
    expect(ys[ys.length - 1]).toBeLessThan(444 - 12);
  });
});

describe('the tyre rack tags', () => {
  it('say the size and no number', () => {
    for (const n of [1, 2, 5]) {
      const t = tagText('QUAD', n);
      expect(t.label).toBe('QUAD');
      expect(`${t.label}${t.none}`).not.toMatch(/\d/);
    }
  });

  it('say NONE for an empty bay', () => {
    expect(tagText('CAR', 0).none).toBe('NONE');
  });
});

describe('the cork boards', () => {
  it('each have a heading', () => {
    expect(ADS_HEADING).toBe('SMALL ADS');
    expect(PHOTOS_HEADING).toBe('PHOTOS');
  });

  it('pin slips below the heading, one under another, without touching', () => {
    for (let i = 0; i < 3; i++) {
      const r = slipRect(i);
      expect(r.y).toBeGreaterThan(62);
      if (i) expect(r.y).toBeGreaterThan(slipRect(i - 1).y + slipRect(i - 1).h);
    }
    expect(slipRect(2).y + slipRect(2).h).toBeLessThan(460);
  });

  it('deal photos below the heading', () => {
    const wall = new PhotoWall();
    let seed = 7;
    const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 40; i++) expect(wall.deal(random).y * 800 - 88 - 0.14 * 110).toBeGreaterThan(70);
  });
});

describe('the tyre rack tags (#939)', () => {
  // A deliberately wide stand-in for bold sans capitals (0.75 em a letter; Arial bold capitals average about 0.7), so the check holds on a wider font.
  const measure = (t, px) => t.length * px * 0.75;
  it('keeps every label clear of NONE, with the longest ones shrunk to fit', () => {
    for (const b of BAYS) {
      const l = tagLayout(measure, b.label);
      expect(l.labelX + l.labelW + 8, b.label).toBeLessThanOrEqual(l.noneX - l.noneW);
      expect(l.labelPx, b.label).toBeGreaterThanOrEqual(14);
    }
    const widest = BAYS.reduce((a, b) => (b.label.length > a.label.length ? b : a));
    expect(tagLayout(measure, widest.label).labelPx).toBeLessThan(26);
    expect(tagLayout(measure, 'CAR').labelPx).toBe(26);
  });
});
