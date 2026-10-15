import { describe, it, expect } from 'vitest';
import { DECK, deckRows, deckY, deckGeometry, flareGeometry, skirtBottom, bulkheadGeometry } from '../src/vehicle/foremanDeck.js';

// The red quad's decks and flares (TODO 88): sculpted, so no straight edges, and kept inside the width and short of the tyres.
describe('the Foreman’s decks', () => {
  for (const which of ['front', 'rear']) {
    const spec = DECK[which];
    it(`${which}: the plan outline is pulled in at the inner end and the face's corners, never wider than the deck`, () => {
      const rows = deckRows(DECK, spec);
      expect(rows[0].half).toBeLessThan(DECK.half - 0.05); // a swept tail, not a square end
      expect(rows[rows.length - 1].half).toBeLessThan(DECK.half - 0.05); // the face's bottom corners are angled in
      for (const r of rows) expect(r.half).toBeLessThanOrEqual(DECK.half);
      const mid = rows.find((r) => r.g === 0 && Math.abs(r.z - spec.z0) > 0.25);
      expect(mid.half).toBeCloseTo(DECK.half, 6);
    });

    it(`${which}: the rows run from the inner end to the face without doubling back`, () => {
      const dir = Math.sign(spec.zf - spec.z0);
      const rows = deckRows(DECK, spec);
      for (let i = 1; i < rows.length; i++) expect((rows[i].z - rows[i - 1].z) * dir).toBeGreaterThanOrEqual(-1e-9);
      expect(rows[rows.length - 1].z).toBeCloseTo(spec.zf, 6);
      expect(rows[rows.length - 1].dy).toBeCloseTo(-spec.faceH, 6);
    });

    it(`${which}: crowned and rolled, highest nearer the middle than at the edge`, () => {
      const r = deckRows(DECK, spec).find((row) => row.g === 0 && Math.abs(row.z - spec.z0) > 0.25);
      expect(deckY(DECK, spec, r, 0.3)).toBeGreaterThan(deckY(DECK, spec, r, r.half));
      expect(deckY(DECK, spec, r, r.half - 0.002)).toBeLessThan(spec.top - DECK.edgeDrop * 0.7);
    });

    it(`${which}: the geometry stays inside the width and the flare hangs outside the deck's edge`, () => {
      const g = deckGeometry(which);
      g.computeBoundingBox();
      expect(g.boundingBox.max.x).toBeLessThanOrEqual(DECK.half + 1e-6);
      for (const side of [-1, 1]) {
        const f = flareGeometry(which, which === 'front' ? 0.62 : -0.62, side);
        f.computeBoundingBox();
        expect(Math.abs(side > 0 ? f.boundingBox.max.x : f.boundingBox.min.x)).toBeGreaterThan(DECK.half);
      }
    });

    it(`${which}: the skirt follows the arch over the tyre and sweeps down to the footboard at the inner end`, () => {
      const wz = which === 'front' ? 0.62 : -0.62;
      expect(skirtBottom(DECK, spec, wz, wz)).toBeGreaterThan(0.3 + 0.3); // clear of the tyre's top
      expect(skirtBottom(DECK, spec, wz, spec.z0)).toBeCloseTo(DECK.lowEdge, 6);
    });
  }

  for (const which of ['front', 'rear']) {
    it(`${which}: a wall closes the deck's inner end, from the side panel out, hanging from the deck to the footboard`, () => {
      const spec = DECK[which];
      for (const side of [-1, 1]) {
        const g = bulkheadGeometry(which, side);
        g.computeBoundingBox();
        const b = g.boundingBox;
        const xs = side > 0 ? [b.min.x, b.max.x] : [-b.max.x, -b.min.x];
        expect(xs[0]).toBeCloseTo(0.255, 6); // it starts at the side panel, so there is no slot between the panel and the wing
        expect(xs[1]).toBeLessThanOrEqual(deckRows(DECK, spec)[0].half + 1e-6);
        expect(b.min.y).toBeCloseTo(0.35, 6); // down to the footboard
        expect(b.max.y).toBeGreaterThan(spec.top - 0.1); // and up to the deck
        expect(Math.abs(b.max.z - spec.z0) < 0.05 || Math.abs(b.min.z - spec.z0) < 0.05).toBe(true); // at the deck's end
      }
    });
  }
});
